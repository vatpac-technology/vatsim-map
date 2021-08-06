import { getLineFeatures } from './client.js';
import { polygon, featureCollection } from '@turf/helpers';

export async function getATCSectors(){
    try{
        var allSectors = await getLineFeatures('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Maps/ALL_SECTORS.xml');
        // var allVolumes = await getLineFeatures('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Volumes.xml');
        // var sectors
        return featureCollection(allSectors);
    }catch(err){
        console.log(err)
        return false;
    }
}

// https://data.vatsim.net/v3/transceivers-data.json