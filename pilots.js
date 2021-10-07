import { getLineFeatures, getVatsimData, getOSMAerodromeData } from './client.js';
import { point, featureCollection } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import bunyan from 'bunyan';
import config from 'config';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

export async function getPilots(){
    try{
        var firs = await getLineFeatures(config.get('data.vatsys.fir_boundariesUrl'));
        var vatsimData = await getVatsimData();
        var aerodromes = await getOSMAerodromeData(config.get('data.osm.aerodromesArea'));
    }catch(err){
        log.error(err)
        return false;
    }
    try{
        return pilotsInFIR(firs, aerodromes, vatsimData);
    }catch(err){
        log.error(err)
        return false;
    }
}

function pilotsInFIR(firs, aerodromes, data){
    var pilotsInFIR = [];
    data.pilots.forEach(function(pilot) {
        var ppos = point(
            [(pilot.longitude), (pilot.latitude)],
            { pilot }
        );
        if(pointInFIR(ppos, firs) == true){
            // Enrich VATSIM data.
            ppos.properties.pilot.aerodrome = pointInAerodrome(ppos, aerodromes);
            ppos.properties.pilot.tag_alt = formatAltString(pilot.altitude);
            ppos.properties.pilot.tag_gs = (pilot.groundspeed / 10).toFixed(0);
            // Return only pilots inside filtered FIRs
            pilotsInFIR.push(ppos);
        }
    });
    return featureCollection(pilotsInFIR);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
function leftFillNum(num, targetLength) {
    return num.toFixed(0).toString().padStart(targetLength, 0);
}

function formatAltString(string){
    const transistionAltitudeThousands = 100;
    var alt = 0;
    // var fl = string.split('FL');
    // alt = (fl[1] == undefined ? fl[0] : fl[1]);
    alt = string/100; // 33000 -> 330, 1000 -> 10, 340 -> 3.4
    // Altitudes less than 500ft are probably not legal anyway (lets assume no one on VATSIM has LL approval),
    //  more likely they entered their FPL alt in FL. Fix the dumb here. PS: Sorry CONC
    if(alt <= 5){
        alt = alt * 100;
    }
    if (alt == 100){
        return 'A100';
    }else{
        return (alt <= transistionAltitudeThousands ? 'A0'+leftFillNum(alt, 2) : 'F'+alt.toFixed(0));
    };
};

// Flights in FIRs
function pointInFIR (point, firs) {
    var mappedFIRs = config.get("map.firs");
    var inFIR = false;
    firs.forEach(function(fir){
        if(mappedFIRs.includes(fir.properties.Name)) {
            if(booleanPointInPolygon(point,fir)){
                inFIR = true;
            }
        };
    });
    return inFIR;
}

// Flight at aerodromes
function pointInAerodrome (point, aerodromes){
    var inAerodrome = false;
    try{
        if(aerodromes == undefined){
            log.debug("Aerodromes not loaded");
        }else{
            aerodromes.features.forEach(function(aerodrome){
                if(aerodrome.properties.tags.icao != undefined){
                    if(booleanPointInPolygon(point,aerodrome)){
                        inAerodrome = aerodrome.properties.tags.icao;
                    }
                }
            })
        }
    }catch(err){
        if(err instanceof TypeError){
            log.trace(err)
        }else{
            log.error(err);
        }
    }
    return inAerodrome;
}

