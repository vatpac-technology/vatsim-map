import NodeCache from 'node-cache';
import fetch from 'node-fetch';
import { xml2js } from 'xml-js';
import dms2dec from 'dms2dec';
import { lineToPolygon, lineString } from '@turf/turf';

const cache = new NodeCache( { stdTTL: 15, checkperiod: 30 } );

/**
 * @typedef {Object} LineObj
 * @property {string} name
 * @property {Array.<{longitude, latitude}>} line
 * @property {Feature.Polygon} poly
 */

export function clearCache(){
    console.log('Clearing cache')
    cache.flushAll();
    return true;
}

function checkHTTPStatus(res) {
    if (res.ok) { // res.status >= 200 && res.status < 300
        return res;
    } else {
        throw HTTPError(res.statusText);
    }
}

export async function getVatsimData (url) {
    var data = cache.get("vatsimData");
    if (data == undefined) {
        const res = await fetch(url)
            .then(checkHTTPStatus)
            .then(res => res.json())
            .then( data => {
                return data;
            })
            .catch(err => console.log(err));
        data = res;
        console.log(`cache:set url:${url} keys:${Object.keys(data).length}`)
        cache.set("vatsimData", data, 15);
    }else{
        console.log(`cache:get url:${url} keys:${Object.keys(data).length}`)
    }
    return data;
}

export async function getVatsimAFV (url) {
    var data = cache.get("vatsimAFV");
    if (data == undefined) {
        const res = await fetch(url)
            .then(checkHTTPStatus)
            .then(res => res.json())
            .then( data => {
                return data;
            })
            .catch(err => console.log(err));
        data = res;
        console.log(`cache:set url:${url} keys:${Object.keys(data).length}`)
        cache.set("vatsimAFV", data, 15);
    }else{
        console.log(`cache:get url:${url} keys:${Object.keys(data).length}`)
    }
    return data;
}

/**
 * Gets a vatsys dataset URL and returns turf Features
 * @param {string} url 
 * @returns {import('@turf/turf').Feature}
 */
export async function getLineFeatures (url) {
    // Extract vatSys polys into object
    var data = cache.get(url);
    if (data == undefined) {
        try{
            // Download and parse XML
            const res = await fetch(url)
            .then(checkHTTPStatus)
            .then(res => res.text())
            .then( data => {
                return data;
            })
            .catch(err => console.log(err));
            data = await xml2js(res, {compact: true, spaces: 4});
        }catch(err){
            throw Error(err);
        }

        var features = xmlToFeatures(data);
        console.log(features);

        console.log(`cache:set url:${url} objs:${features.length}`)
        cache.set(url, features, 86400);
        return features;
    }else{
        console.log(`cache:get url:${url} objs:${data.length}`)
        return data;
    }
}

function xmlToFeatures (data) {
    var polys = [];
    // Take vatSys lines and parse into line array
    // ±DDMMSS.SSSS±DDDMMSS.SSSS
    // (?<latD>[+-][0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]{3})(?<lonD>[+-][0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]{3})
    const re = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]{3})(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]{3})/g)

    // Handle Maps - FIR Boundaries
    try{
        data.Maps.Map.Line.forEach(function(obj){
            var lineStringArr = [];
            var matches = [...obj._text.matchAll(re)];
            matches.forEach(function(match){
                // Convert vaySys DMS into decimal degrees
                // https://github.com/vatSys/xml-tools/blob/master/DotAIPtoXML/DotAIPtoXML/Coordinate.cs#L119
                var pos = {
                    latitude: [
                        parseInt(match.groups.latD),
                        parseInt(match.groups.latM),
                        parseFloat(match.groups.latS)
                    ],
                    latRef: (match.groups.latRef == '+') ? "N" : "S",
                    longitude: [
                        parseInt(match.groups.lonD),
                        parseInt(match.groups.lonM),
                        parseFloat(match.groups.lonS)
                    ],
                    lonRef: (match.groups.lonRef == '+') ? "E" : "W"
                }
                var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
                // Turf is geoJSON so we continue the stupidity here with long THEN lat.
                lineStringArr.push([longitude, latitude]);
            });
            polys.push(lineToPolygon(lineString(lineStringArr),{mutate: true, properties: {name: obj._attributes.Name}}));
        })
    }catch(err){
        console.log(err);
    }

    // Handle volumes
    try{
        data.Volumes.Boundary.forEach(function(obj){
            var lineStringArr = [];
            var matches = [...obj._text.matchAll(re)];
            matches.forEach(function(match){
                // Convert vaySys DMS into decimal degrees
                // https://github.com/vatSys/xml-tools/blob/master/DotAIPtoXML/DotAIPtoXML/Coordinate.cs#L119
                var pos = {
                    latitude: [
                        parseInt(match.groups.latD),
                        parseInt(match.groups.latM),
                        parseFloat(match.groups.latS)
                    ],
                    latRef: (match.groups.latRef == '+') ? "N" : "S",
                    longitude: [
                        parseInt(match.groups.lonD),
                        parseInt(match.groups.lonM),
                        parseFloat(match.groups.lonS)
                    ],
                    lonRef: (match.groups.lonRef == '+') ? "E" : "W"
                }
                var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
                // Turf is geoJSON so we continue the stupidity here with long THEN lat.
                lineStringArr.push([longitude, latitude]);
            });
            polys.push(lineToPolygon(lineString(lineStringArr),{mutate: true, properties: {name: obj._attributes.Name}}));
        })
    }catch(err){
        console.log(err);
    }
    
    return polys
};

// function firLineToPoly (firs) {
//     // Line arrays into turf polys
//     firs.forEach(function(fir){
//         var poly = turf.lineToPolygon(turf.lineString(fir.line),{mutate: true});
//         fir.poly = poly;
//     });
//     return firs;
// }