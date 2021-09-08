import { getLineFeatures, getXMLtoJS } from './client.js';
import { polygon, featureCollection } from '@turf/helpers';
import bunyan from 'bunyan';
import config from 'config';
import { lineToPolygon, lineString } from '@turf/turf';
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
    return coastline;
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


    // // Iterate sectors to create objects
    // let volume;
    // let sector;
    // sectorsXml.Sectors.Sector.forEach(function(s){
    //     var sector = {
    //         ...s._attributes,
    //         standard_position: false,
    //         volumes: [],
    //         responsibleSectors: ("ResponsibleSectors" in s ? s.ResponsibleSectors._text.split(',') : [])
    //     };
    //     // console.log({sector: sector})
    //     // Iterate all Volumes to join with Sector
    //     var volumes = volumesXml.Volumes.Volume.filter(function(volume){
    //         // TODO - Iterate sector.Volumes._text.split(',') to match  
    //         if(sector.Name === volume._attributes.Name){
    //             // console.log("Matched Sector to Volume")
    //             // console.log({volume: volume});
    //             var newVol = {
    //                 ...volume._attributes,
    //                 boundaries: []
    //             };
    //             // Get feature
    //             var volumeBoundaries = volume.Boundaries._text.split(','); // ARAFURA
    //             // Iterate volume boundaries to join Features to Sector volumes
    //             volumeBoundaries.forEach(function(volumeBoundary){
    //                 // console.log({volumeBoundaries: volumeBoundary});
    //                 var feature = volumeBoundaryFeatures.filter(function(feature){
    //                     if(feature.properties.Name === volumeBoundary){
    //                         // console.log("Matched feature to Boundary")
    //                         // console.log({feature: volumeBoundary});
    //                         newVol.boundaries.push(feature);
    //                     };
    //                 })
    //             });
    //             // Attach volume attributes to feature properties
    //             // Push feature
    //             sector.volumes.push(newVol);
    //         }
    //         // return volume._attributes.Name == sector.Name;
    //     })
    //     // var volumes = volumesXml.Volumes.Volume.forEach(function(volume){
    //     //     console.log({volume: volume})
    //     //     var features = [];
    //     //     // Boundaries are CSV
    //     //     var volumeBoundaries = volume.Boundaries._text.split(','); // ARAFURA
    //     //     volumeBoundaries.forEach(function(volumeBoundary){
    //     //         // Get matching Feature for boundary.
    //     //         var feature = volumeBoundaryFeatures.find(obj => {
    //     //             if (obj.properties.Name === volumeBoundary){
    //     //                 console.log('Match obj.properties.Name === volumeBoundary')
    //     //             }
    //     //             return false;
    //     //         });
    //     //         // sector.volumes.push(feature);
    //     //     });
    //     // })
    //     if (config.get("map.sectors.standard").includes(sector.Callsign)){
    //         // console.log(`Standard pos ${element._attributes.Callsign}`);
    //         sector.standard_position = true;
    //     }
    //     sectors.push(sector);
    // })
    // // Iterate volume boundaries, add volume details to GeoJSON
    // // volumes.Volumes.Volume.forEach(function(volume){
    // //     var vol = {

    // //     }
    // //     console.log(volume)
    // // });

    // //         var match = sectors.Sectors.Sector.find((element) => {
    //     //     // Attach sector details to sectors
    //     //     if (element._attributes.FullName.toUpperCase() == volume.properties.Name){
    //     //         volume.properties = element._attributes;
    //     //     }
    //     //     // Flag standard sectors
    //     //     if (config.get("map.sectors.standard").includes(element._attributes.Callsign)){
    //     //         // console.log(`Standard pos ${element._attributes.Callsign}`);
    //     //         volume.properties.standard_position = true;
    //     //     }
    //     // });

    // // Union
    // // https://github.com/Turfjs/turf/tree/master/packages/turf-union

    // // Return FC
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