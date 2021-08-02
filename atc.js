import { getLineFeatures } from './client.js';
import { polygon, featureCollection } from '@turf/helpers';

export async function getATCSectors(){
    try{
        var sectors = await getLineFeatures('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Maps/ALL_SECTORS.xml');
        return featureCollection(sectors);
    }catch(err){
        console.log(err)
        return false;
    }
}