import { getLineFeatures, getXMLtoJS, getVatsimAFV, getVatsimData } from './client.js';
import config from 'config';
import * as turf from '@turf/turf';
import { iso2dec } from './iso2dec.js';
import rgb2hex from 'rgb2hex';

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

export async function getOnlineControllers(){
    // Get the sector boundary information for the region.
    var sectors = await getATCSectors();
    // Get the vatsim data.
    var data = await getVatsimData();
    // Initate array for output.
    var onlineControllers = [];
    // Loop through each online controller to see if they should be included.
    data.controllers.forEach(function(controller) {
        // Check if they are FSS, CTR, APP or TWR.
        if (!controller.callsign.toUpperCase().includes("FSS") && 
            !controller.callsign.toUpperCase().includes("CTR") && 
            !controller.callsign.toUpperCase().includes("APP") && 
            !controller.callsign.toUpperCase().includes("TWR"))
        {
           return;
        }
        // Check if they are controller for the right region.
        if (!sectors.some(sector => sector.Callsign == controller.callsign.toUpperCase()))
        {
            return;
        }
        // OK to add to the output.
        onlineControllers.push(controller);
    });
    return onlineControllers;
}

export async function getOnlinePositions() {
    // Initiate variables to use.
    var onlineSectors = [];
    var sectorWithSubsectors = false;
    // Get the required data.
    var sectors = await getATCSectors();
    var stations = await getVatsimAFV();
    var onlineControllers = await getOnlineControllers();
    // If someone of the data missing, abort.
    if (!sectors || !stations || !onlineControllers) return;
    // Loop through each online controller to see if they should be included.
    onlineControllers.forEach(function(onlineController) {
        // Get the AFV stations for the controller.
        var station = stations.find(station => station.callsign == onlineController.callsign);
        // If no stations, move to the next controller.
        if (!station) return;
        // Get the sector for the position.
        var sector = sectors.find(sector => sector.Callsign == onlineController.callsign);
        // If no sector, move to the next controller.
        if (!sector) return;
        // Check std sectors and load sub sectors.
        if (sector.standard_position === true && sector.responsibleSectors.length > 0) {
            sectorWithSubsectors = mergeSectors(sector, sector.responsibleSectors,sectors);
            onlineSectors.push(sectorWithSubsectors);
        } else {
            onlineSectors.push(mergeBoundaries(sector));
        }
        // Check if controller is extending.
        var activeFrequencies = [];
        station.transceivers.forEach(function(transceiver){
            // Convert Hertz to Megahurts.
            var convertedFrequency = (transceiver.frequency/1000000).toFixed(3);
            // Check if already added.
            if (activeFrequencies.some(frequency => frequency == convertedFrequency)) return;
            // Add it to the list of active frequencies.
            activeFrequencies.push(convertedFrequency);
        });
        // if only 1 frequency, nothing else to do.
        if (activeFrequencies.length <= 1) return;
        // 
        activeFrequencies.forEach(function(activeFrequency) {
            // Get all the sectors that use that frequency (but only the same position type as the primary position).
            var frequencySectors = sectors.filter(sector => sector.Frequency == activeFrequency
                && sector.volumes.length > 0 && sector.Callsign.toUpperCase().endsWith(onlineController.callsign.toUpperCase().slice(-3)));
            // If nothing found, continue.
            if (!frequencySectors) return;
            var extendedSector;
            // Loops through each sector.
            frequencySectors.forEach(frequencySector => {
                // If the primary sector frequency, continue.
                if (frequencySector.Callsign == sector.Callsign) return;
                if (!extendedSector) 
                {
                    extendedSector = frequencySector;
                    return;
                }
                if (getDistanceInKm(sector, extendedSector) > getDistanceInKm(sector, frequencySector))
                {
                    extendedSector = frequencySector;
                }
            });
            if (!extendedSector) return;
            // Remove the existing entry.
            var existingIndex = onlineSectors.indexOf(onlineSectors.Callsign == extendedSector.Callsign);
            if (existingIndex > -1) {
                onlineSectors.splice(existingIndex, 1);
            }
            // Insert the updated entry.
            onlineSectors.push(mergeSectors(extendedSector, extendedSector.responsibleSectors, sectors));
        })
    });
    return turf.featureCollection(uniq(onlineSectors));
}

function getDistanceInKm(sector1, sector2) {
    var lon1 = sector1.volumes[0].Boundaries[0].geometry.coordinates[0][0][0];
    var lat1 = sector1.volumes[0].Boundaries[0].geometry.coordinates[0][0][1];
    var lon2 = sector2.volumes[0].Boundaries[0].geometry.coordinates[0][0][0];
    var lat2 = sector2.volumes[0].Boundaries[0].geometry.coordinates[0][0][1];
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}
  
function deg2rad(deg) {
    return deg * (Math.PI/180)
}
