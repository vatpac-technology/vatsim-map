import * as turf from '@turf/turf'
import { xml2js } from 'xml-js';
import dms2dec from 'dms2dec';
import fs from 'fs';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';

const cache = new NodeCache( { stdTTL: 15, checkperiod: 30 } );

export function clearCache(){
    console.log('Clearing cache')
    cache.flushAll();
    return true;
}

export async function getPilots(){
    console.log(cache.getStats());
    try{
        var firs = await getFIRBoundaries('https://raw.githubusercontent.com/vatSys/australia-dataset/master/Maps/FIR_BOUNDARIES.xml');
        firLineToPoly(firs);
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
        var ppos = turf.point(
            [(pilot.longitude), (pilot.latitude)],
            { pilot }
        );
        if(pointInFIR(ppos, fir) == true){
            pilotsInFIR.push(ppos);
        }
    });
    return turf.featureCollection(pilotsInFIR);
}

function checkHTTPStatus(res) {
    if (res.ok) { // res.status >= 200 && res.status < 300
        return res;
    } else {
        throw HTTPError(res.statusText);
    }
}

async function getVatsimData (url) {
    var data = cache.get("vatsimData");
    if (data == undefined) {
        console.log("getVatsimData cache miss")
        const res = await fetch(url)
            .then(checkHTTPStatus)
            .then(res => res.json())
            .then( data => {
                return data;
            })
            .catch(err => console.log(err));
        data = res;
        console.log(`Cached vatsimData len ${Object.keys(data).length}`)
        cache.set("vatsimData", data, 15);
    }else{
        console.log(`vatsimData len ${Object.keys(data).length}`)
        console.log("getVatsimData cache hit")
    }
    return data;
}

async function getFIRBoundaries (url) {
    // Extract vatSys firObjs into line arrays
    var firObjs = [];
    let xml;
    var data = cache.get("xml");
    if (data == undefined) {
        console.log("getFIRBoundaries cache miss")
        try{
            // Download and parse XML
            const res = await fetch(url)
            .then(checkHTTPStatus)
            .then(res => res.text())
            .then( data => {
                return data;
            })
            .catch(err => console.log(err));
            xml = await xml2js(res, {compact: true, spaces: 4});
        }catch(err){
            throw ParserError(err);
        }

        // Handle single Line Map
        if(Array.isArray(xml.Maps.Map.Line)){
            xml.Maps.Map.Line.forEach(function (line){
                firObjs.push(lineToFIR(line))
            });
        }else{
            firObjs.push(lineToFIR(xml.Maps.Map.Line))
        }
        console.log(`Cached firObjs len ${firObjs.length}`)
        cache.set("xml", firObjs, 86400);
    }else{
        console.log(`firObjs len ${firObjs.length}`)
        console.log("getFIRBoundaries cache hit")
    }
    return firObjs;
}

function firLineToPoly (firs) {
    // Line arrays into turf polys
    firs.forEach(function(fir){
        var poly = turf.lineToPolygon(turf.lineString(fir.line),{mutate: true});
        fir.poly = poly;
        // Dump GeoJSON poly for debugging in https://geojson.io
        // console.log(JSON.stringify(poly, null, 1));
        // fs.writeFile(`./out/${fir.name}.json`, JSON.stringify(poly, null, 1), 'utf8', function(err) {
        //     if (err) throw err;
        //     console.log(`./out/${fir.name}.json`);
        //     }
        // );
    });
    return firs;
}

function lineToFIR (line) {
    // Create new JS obj
    var fir = {
        name: line._attributes.Name,
        line: [],
        poly: null
    }
    // Take vatSys lines and parse into line array
    // ±DDMMSS.SSSS±DDDMMSS.SSSS
    // (?<latD>[+-][0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]{3})(?<lonD>[+-][0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]{3})
    // const re = new RegExp(/(?<lat>[+-][0-9]{6}\.[0-9]{3})(?<lon>[+-][0-9]{7}\.[0-9]{3})/g);
    const re = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]{3})(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]{3})/g)
    var lines = [...line._text.matchAll(re)];
    lines.forEach(function(l){
        // Convert vaySys DMS into decimal degrees
        // https://github.com/vatSys/xml-tools/blob/master/DotAIPtoXML/DotAIPtoXML/Coordinate.cs#L119
        var pos = {
            latitude: [
                parseInt(l.groups.latD),
                parseInt(l.groups.latM),
                parseFloat(l.groups.latS)
            ],
            latRef: (l.groups.latRef == '+') ? "N" : "S",
            longitude: [
                parseInt(l.groups.lonD),
                parseInt(l.groups.lonM),
                parseFloat(l.groups.lonS)
            ],
            lonRef: (l.groups.lonRef == '+') ? "E" : "W"
        }
        var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
        // Turf is geoJSON so we continue the stupidity here with long THEN lat.
        var a = [longitude, latitude]
        // Append extract arrays to fir.line array
        fir.line.push(a);
    });
    return fir
};

// Flights in FIRs
function pointInFIR (point, firs) {
    var mappedFIRs = [ "MELBOURNE_FIR", "BRISBANE_FIR" ];
    var inFIR = false;
    firs.forEach(function(fir){
        if(mappedFIRs.includes(fir.name)) {
            if(turf.booleanPointInPolygon(point,fir.poly)){
                console.log(`Matched in ${fir.name}`)
                inFIR = true;
            }
        };
    });
    return inFIR;
}

