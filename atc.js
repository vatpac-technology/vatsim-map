import { getLineFeatures, getXMLtoJS, getVatsimAFV } from './client.js';
//import { polygon, featureCollection } from '@turf/helpers';
import bunyan from 'bunyan';
import config from 'config';
import * as turf from '@turf/turf';
import { iso2dec } from './iso2dec.js';
import rgb2hex from 'rgb2hex';
import c from 'config';

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
    return turf.featureCollection(coastline);
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
    var volumesXml = await getXMLtoJS(config.get("data.vatsys.volumesUrl"));
    // volume
        // properties
            // Name

    // Get sector details
    var sectorsXml = await getXMLtoJS(config.get("data.vatsys.sectorsUrl"));

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
        if (config.get("map.sectors.border").includes(sector.Callsign)){
            sector.border_position = true;
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
    return turf.lineToPolygon(turf.lineString(lines),{mutate: true, properties: boundary._attributes });
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

function mergeBoundaries(sector) {
    var features = sector.volumes.map((volume) => volume.Boundaries.map((boundary) => boundary)).flat();
    if (features.length > 1) {
        var union = unionArray(features);
        union.properties = { ...sector };
        delete union.properties.responsibleSectors;
        delete union.properties.volumes;
        return union;
    } else if (features.length == 1) {
        features[0].properties = { ...sector };
        delete features[0].properties.responsibleSectors;
        delete features[0].properties.volumes;
        return features[0];
    } else {
        return false;
    }
}

function unionArray(array){
    var featureCollection = turf.featureCollection(array);
    if (featureCollection.length === 0) {
        return null
    }
    let ret = featureCollection.features[0];

    turf.featureEach(featureCollection, function (currentFeature, featureIndex) {
        if (featureIndex > 0) {
            ret = turf.union(ret, currentFeature);
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
        // Keep only CTR, APP, and TWR
        if(station.callsign.toUpperCase().includes("CTR") === false && station.callsign.toUpperCase().includes("APP") === false && station.callsign.toUpperCase().includes("TWR") === false){
            delete stations[index];
        }else{

            // Join sectors by callsign
            var sector = sectors.find(function cb(element){
                if(element.Callsign === station.callsign){        

                    // Check std sectors and load sub sectors.
                    if(element.standard_position === true && element.responsibleSectors.length > 0){
                        var sectorWithSubsectors = mergeSectors(element, element.responsibleSectors,sectors);

                        onlineSectors.push(sectorWithSubsectors);
                    }else{
                        onlineSectors.push(mergeBoundaries(element));
                    }


                    // check if other frequencies are active and show them as online.
                    // this only works for ENR sectors.

                    var activeFrequencies = [];
                    station.transceivers.forEach(function(element){
                        // Hertz to Megahurts
                        element.frequency = element.frequency/1000000;
                        activeFrequencies.push(element.frequency.toFixed(3));
                    })

                    activeFrequencies = uniq(activeFrequencies);

                    activeFrequencies.forEach(function(frequency){
                        sectors.find(function cb(element){

                            if(element.Frequency === frequency && element.Callsign != station.callsign && element.Callsign.toUpperCase().includes("CTR")){
                                var sectorWithSubsectors = mergeSectors(element, element.responsibleSectors,sectors);

                                onlineSectors.push(sectorWithSubsectors);
                            }

                        })
                    })
                };
            });

            /*
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
            */
        }
    })


    return turf.featureCollection(uniq(onlineSectors));
}