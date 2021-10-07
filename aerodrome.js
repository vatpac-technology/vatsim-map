import { getOSMAerodromeData } from './client.js';
import { point, featureCollection } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bunyan from 'bunyan';
import config from 'config';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

export async function getAerodromes(){
    try{
        var aerodromes = await getOSMAerodromeData(config.get('data.osm.aerodromesArea'));
        if(aerodromes){
            if(aerodromes.type === "FeatureCollection"){
                return aerodromes;
            }else{
                return false;
            }
        };
    }catch(err){
        log.error(err)
        return false;
    }
}

export async function getMajorAerodromes(){
    const config = config.get('map.majorAerodromes')
    var aerodromes = getAerodromes();
    var majorAerodromes = [];

    aerodromes.forEach(function(element){
        config.forEach(function(majorIcao){
            if(element.properties.tags.icao==majorIcao){
                majorAerodromes.push(element);
            }
        });
    });
}