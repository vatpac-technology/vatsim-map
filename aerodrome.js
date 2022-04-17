import { getOSMAerodromeData, getOSMParkingPositionData } from './client.js';
import { point, featureCollection } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bunyan from 'bunyan';
import config from 'config';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

export async function getAerodromes(){
    try{
        var data = await getOSMAerodromeData(config.get('data.osm.aerodromesArea'));
        if(data){
            if(data.type === "FeatureCollection"){
                return data;
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
    const aerodromeConfig = config.get('map.majorAerodromes')
    var aerodromes = await getAerodromes();
    var majorAerodromes = [];

    try{
        aerodromes.features.forEach(function(element){
            aerodromeConfig.forEach(function(majorIcao){
                if(element.properties.tags.icao==majorIcao){
                    majorAerodromes.push(element);
                }
            });
        });
    }catch(e){}
    return majorAerodromes;
}

export async function getAerodromeBays(){
    try{
        var data = await getOSMParkingPositionData(config.get('data.osm.aerodromesArea'));
        if(data){
            if(data.type === "FeatureCollection"){
                return data;
            }else{
                return false;
            }
        };
    }catch(err){
        log.error(err)
        return false;
    }
}