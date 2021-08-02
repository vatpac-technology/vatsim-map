import { getLineFeatures, getVatsimData } from './client.js';
import { point, featureCollection } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

export async function getPilots(){
    try{
        var firs = await getLineFeatures('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Maps/FIR_BOUNDARIES.xml');
        var vatsimData = await getVatsimData('https://data.vatsim.net/v3/vatsim-data.json');
    }catch(err){
        console.log(err)
        return false;
    }
    try{
        return pilotsInFIR(firs, vatsimData);
    }catch(err){
        console.log(err)
        return false;
    }
}

function pilotsInFIR(fir, data){
    var pilotsInFIR = [];
    data.pilots.forEach(function(pilot) {
        var ppos = point(
            [(pilot.longitude), (pilot.latitude)],
            { pilot }
        );
        if(pointInFIR(ppos, fir) == true){
            pilotsInFIR.push(ppos);
        }
    });
    return featureCollection(pilotsInFIR);
}

// Flights in FIRs
function pointInFIR (point, firs) {
    var mappedFIRs = [ "MELBOURNE_FIR", "BRISBANE_FIR" ];
    var inFIR = false;
    firs.forEach(function(fir){
        if(mappedFIRs.includes(fir.properties.name)) {
            if(booleanPointInPolygon(point,fir)){
                inFIR = true;
            }
        };
    });
    return inFIR;
}

