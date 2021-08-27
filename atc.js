import { getLineFeatures, getXMLtoJS } from './client.js';
import { polygon, featureCollection } from '@turf/helpers';
import bunyan from 'bunyan';
import config from 'config';
import { sector } from '@turf/turf';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

//  sector:
//  properties:
//      name: ARA
//      callsign: BN-ARA_CTR
//      frequency: 133.700
//      fullname: Arafura
//      volumes: FeatureCollection
//      responsibleSectors: [ sectors ]
//  controller: VatsimController

export async function getATCSectors() {
    // Get volume polys
    var volumes = await getLineFeatures(config.get("data.vatsys.volumesUrl"));

    // Get sector details
    var sectors = await getXMLtoJS(config.get("data.vatsys.sectorsUrl"));
    // {
    //     _attributes: {
    //       FullName: 'Camden Surface Movement Control',
    //       Frequency: '121.900',
    //       Callsign: 'CN_GND',
    //       Name: 'CN SMC'
    //     }
    //   }

    // Union
    // https://github.com/Turfjs/turf/tree/master/packages/turf-union
    // Iterate sector maps, add sector details to GeoJSON
    volumes.forEach(function(sector){
        var match = sectors.Sectors.Sector.find((element) => {
            // console.log({sectorName: sector.properties.name});
            // console.log({elementCallsign: element._attributes.Callsign});
            if (element._attributes.Callsign == "TN_GND"){
                console.log("Match TN_GND");
            }
            // if (sector.properties.name == element._attributes.Callsign){
            //     console.log({match: element})
            // } else if (sector.properties.name == 'Y' + element._attributes.Callsign){
            //     console.log({match: element})
            // }
        });
    });

    // Return FC
    return featureCollection(volumes);
}

// export async function getATCSectorPolys(){
//     try{
//         var sectorPolys = await getLineFeatures(config.get("data.vatsys.maps.sectorsUrl"));
//         // var allVolumes = await getLineFeatures('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Volumes.xml');
//         // var sectors
//         return featureCollection(sectorPolys);
//     }catch(err){
//         console.log(err)
//         return false;
//     }
// }

// export async function getATCSectors(){
//     try{
//         var allSectors = await getXMLtoJS(config.get("data.vatsys.sectors.sectorsUrl"));
//         // var allVolumes = await getLineFeatures('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Volumes.xml');
//         // var sectors
//         return featureCollection(allSectors);
//     }catch(err){
//         console.log(err)
//         return false;
//     }
// }

// https://data.vatsim.net/v3/transceivers-data.json