import { getLineFeatures, getXMLtoJS, getVatsimAFV } from './client.js';
import { polygon, featureCollection } from '@turf/helpers';
import bunyan from 'bunyan';
import config from 'config';
import { 
    lineToPolygon,
    lineString,
    booleanIntersects,
    buffer,
    featureEach,
    union
} from '@turf/turf';
import { iso2dec } from './iso2dec.js';
import rgb2hex from 'rgb2hex';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

//  sector:
//  properties:
//      name: ARA
//      callsign: BN-ARA_CTR
//      frequency: 133.700
//      fullname: Arafura
//      volumes: FeatureCollection
//      responsibleSectors: [ sectors ]
//      standard_position: boolean
//  controller: VatsimController

export async function getCoastline(){
    var coastline = await getLineFeatures(config.get("data.vatsys.coastlineUrl"));
    return featureCollection(coastline);
}

export async function getColours(){
    var colours = [];
    var coloursXml = await getXMLtoJS(config.get("data.vatsys.coloursUrl"));
    coloursXml.Colours.Colour.forEach(function(e){
        var [r,g,b] = [e.R._text, e.G._text, e.B._text];
        var hex = rgb2hex(`rgb(${r},${g},${b})`);
        var colour = {
            id: e._attributes.id,
            use: e.Use._text,
            name: e.Name._text,
            hex: hex.hex
        }
        colours.push(colour);
    });

    return colours;
}

export async function getATCSectors() {
    var sectors = [];
    // Get volume GeoJSON
    // var volumeBoundaryFeatures = await getLineFeatures(config.get("data.vatsys.volumesUrl"));
    // Boundary = volume.properties.Name
    var volumesXml = await getLineFeatures(config.get("data.vatsys.volumesUrl"));
    // volume
        // properties
            // Name

    // Get sector details
    var sectorsXml = await getXMLtoJS(config.get("data.vatsys.sectorsUrl"));
    // {
    //     _attributes: {
    //       FullName: 'Camden Surface Movement Control',
    //       Frequency: '121.900',
    //       Callsign: 'CN_GND',
    //       Name: 'CN SMC'
    //     }
    //   }
    var sectors = [];
    sectorsXml.Sectors.Sector.forEach(function(s){
        var volumes = []
        if("Volumes" in s){
            // Get Volumes
            var v = s.Volumes._text.split(',')
            v.forEach(function(e){
                var volume = getVolume(e, volumesXml);
                volumes.push(volume);
            })
        }
        var sector = {
            ...s._attributes,
            standard_position: false,
            volumes: volumes,
            responsibleSectors: ("ResponsibleSectors" in s ? s.ResponsibleSectors._text.split(',') : [])
        };
        if (config.get("map.sectors.standard").includes(sector.Callsign)){
            sector.standard_position = true;
        }
        sectors.push(sector);
    });
    return sectors;
}

function getBoundary(boundaryName, volumesXml){
    // Find Boundary in XML
    var boundary = volumesXml.Volumes.Boundary.find(e => {
        if(e._attributes.Name === boundaryName){
            return e;
        }
    });
    // Transform boundary to polygon
    var lines = boundary._text.split('/');
    lines.forEach(function(line, index) {
        var dec = iso2dec(line);
        this[index] = [dec.longitude, dec.latitude];
      }, lines);
    return lineToPolygon(lineString(lines),{mutate: true, properties: boundary._attributes });
};

function getVolume(volumeName, volumesXml){
    // Find Volume in XML
    var volume = volumesXml.Volumes.Volume.find(e => {
        if(e._attributes.Name === volumeName){
            return e;
        }
    });
    var newVol = {
        ...volume._attributes
    }
    // Get Volume Boundaries
    var boundaryFeatures = []
    var boundaries = volume.Boundaries._text.split(',');
    boundaries.forEach(function(e){
        var boundary = getBoundary(e, volumesXml);
        boundaryFeatures.push(boundary);
    })
    newVol.Boundaries = boundaryFeatures;
    return newVol;
};

function uniq(a) {
    return Array.from(new Set(a));
}

function getSectorByName(sectorName, sectors){
    var sector = sectors.find(e => {
        if(e.Name === sectorName){
            return e;
        };
    });
    return sector;
}

function getSectorByCallsign(sectorName, sectors){
    var sector = sectors.find(e => {
        if(e.Callsign === sectorName){
            return e;
        };
    });
    return sector;
}

function mergeSectors(sector, sectors, json){
    let mergedSector;
    // FSS don't have sector volumes, only responsible sectors.
    if(sector.volumes.length > 0){
        mergedSector = mergeBoundaries(sector);
    }
    if(sectors.length > 0){
        var sectorVolumes = [];
        // Union all sector volumes into a polygon
        sectors.forEach(function(e){
            var sector = getSectorByName(e, json);
            var poly = mergeBoundaries(sector);
            sectorVolumes.push(poly);
        });
        // Add self and union all sector volumes
        sectorVolumes.push(mergeBoundaries(sector));
        var mergedPoly = unionArray(sectorVolumes);
        mergedSector = mergedPoly;
    }
    if(mergedSector != undefined){
        mergedSector.properties = {...sector};
        delete mergedSector.properties.responsibleSectors
        delete mergedSector.properties.volumes
        return mergedSector;
    }
}

function mergeBoundaries(sector){
    var features = sector.volumes.map((volume) => volume.Boundaries.map((boundary) => boundary)).flat();
    if(features.length > 1){
        var union = unionArray(features);
        union.properties = { ...sector };
        delete union.properties.responsibleSectors;
        delete union.properties.volumes;
        return union;
    }else if (features.length == 1){
        features[0].properties = { ...sector };
        delete features[0].properties.responsibleSectors;
        delete features[0].properties.volumes;
        return features[0];
    }else{
        return false;
    }
}

function unionArray(array){
        const bufferKm = 0.1;
        var fc = featureCollection(array);
        if (fc.length === 0) {
            return null
        }
        // buffer is a dirty dirty hack to close up some holes in datasets
        let ret = buffer(fc.features[0],bufferKm, {units: 'kilometers'});
        // let ret = featureCollection.features[0];

        featureEach(fc, function (currentFeature, featureIndex) {
            if (featureIndex > 0) {
                ret = union(ret, buffer(currentFeature,bufferKm, {units: 'kilometers'}))
                // ret = turf.union(ret, currentFeature);
            }
        });

        // Remove any holes added in union
        ret.geometry.coordinates.length = 1;

        return ret;
};

function isAdjacentSector(sectorFrequency, primarySector, sectors){
    var adjacentSector = false;
    try{
        // Get sectors with matching frequency
        var sectorsWithFreq = sectors.filter(function cb(sector){
            if(parseFloat(sector.Frequency) === parseFloat(sectorFrequency)){
                return sector;
            };
        });
        sectorsWithFreq.forEach(function(sectorFrequencyMatch){
            var sfmFreq = parseFloat(sectorFrequencyMatch.Frequency)
            var sfFreq = parseFloat(sectorFrequency)
            // Match freqs where not own sector freq
            if(sfmFreq === sfFreq && sectorFrequencyMatch.Callsign != primarySector.properties.Callsign){
                var sectorsIntersect = booleanIntersects(primarySector, mergeBoundaries(sectorFrequencyMatch));
                if(sectorsIntersect){
                    // Return only sectors sharing a border
                    adjacentSector = sectorFrequencyMatch;
                }
            }
        });
    }finally{
        return adjacentSector;
    }
};

export async function getOnlinePositions() {
    var onlineSectors = [];
    var sectors = await getATCSectors();
    var stations = await getVatsimAFV();

    // SY_APP 124.400 AFV 124400000
    // iterate txvrs.element.transceivers.element frequency/1000000
    stations.forEach(function(station, index){
        var activePosition = false;
        // Keep only CTR, APP, and TWR
        if(station.callsign.toUpperCase().includes("CTR") === false && station.callsign.toUpperCase().includes("APP") === false && station.callsign.toUpperCase().includes("TWR") === false){
            delete stations[index];
        }else{
            var activeFrequncies = [];
            // Transform frequencies array
            station.transceivers.forEach(function(element){
                // Hertz to Megahurts
                element.frequency = element.frequency/1000000;
                activeFrequncies.push(element.frequency);
            })
            activeFrequncies = uniq(activeFrequncies);

            // Join sectors by callsign
            var sector = sectors.find(function cb(element){
                if(element.Callsign === station.callsign){
                    // Check std sectors and load sub sectors.
                    if(element.standard_position === true){
                        var sectorWithSubsectors = mergeSectors(element, element.responsibleSectors,sectors);
                        return sectorWithSubsectors;
                    }else{
                        return element;
                    }
                };
            });
            if(sector !== undefined){
                onlineSectors.push(mergeBoundaries(sector));
                activePosition = mergeBoundaries(sector);
            }

            if(activePosition !== false){
                // Join sectors by frequency
                // TODO - How to incrementally add sectors working outwards from the logged on sector?
                var extendedPoly = activePosition;
                activeFrequncies.forEach(function(element){
                    var adjacentSector = isAdjacentSector(element, extendedPoly, sectors);
                    if(adjacentSector !== false){
                        extendedPoly = unionArray([extendedPoly, sectorWithSubsectors])
                        if(adjacentSector.standard_position === true){
                            var sectorWithSubsectors = mergeSectors(adjacentSector, adjacentSector.responsibleSectors,sectors);
                            onlineSectors.push(sectorWithSubsectors);
                        }else{
                            onlineSectors.push(mergeBoundaries(adjacentSector));
                        }
                    }
                })
            }
        }
    })


    return featureCollection(uniq(onlineSectors));
}