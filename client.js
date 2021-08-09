import NodeCache from 'node-cache';
import fetch from '@adobe/node-fetch-retry';
import { xml2js } from 'xml-js';
import dms2dec from 'dms2dec';
import { lineToPolygon, lineString } from '@turf/turf';
import bunyan from 'bunyan';
import { FetchError } from 'node-fetch';

var log = bunyan.createLogger({name: "vatsim-map", level: 30})
const cache = new NodeCache( { stdTTL: 15, checkperiod: 30 } );
const userAgent = "User-Agent: vatsim-map / 0.0.1 https://github.com/Kahn/vatsim-map"

/**
 * @typedef {Object} LineObj
 * @property {string} name
 * @property {Array.<{longitude, latitude}>} line
 * @property {Feature.Polygon} poly
 */

export function clearCache(){
    log.info('Clearing cache')
    cache.flushAll();
    return true;
}

export async function getVatsimData (url) {
    var ttlMs = cache.getTtl(url);
    let data;
    // VATSIM data is refreshed every 15s. Check 10s out from expiry.
    if (ttlMs == undefined || ttlMs - Date.now() <= 10000) {
        try{
            // Download fresh VATSIM data
            if(ttlMs == undefined){
                // If there is nothing cached - retry forever.
                const res = await fetch(url, {
                    retryOptions: {
                        retryMaxDuration: 30000, // Max 30s retrying
                        retryInitialDelay: 1000, // 1s initial wait
                        retryBackoff: 500 // 0.5s backoff
                    },
                    headers: {
                        'User-Agent': userAgent
                    }
                })
                .then(res => res.json())
                .then( data => {
                    return data;
                })
                log.trace({res: res});
                data = res;
            }else{
                // If there is an old cache, timeout quickly.
                const res = await fetch(url, {
                    retryOptions: {
                        retryMaxDuration: 2000,
                        retryInitialDelay: 500,
                        retryBackoff: 1.0 // no backoff
                    },
                    headers: {
                        'User-Agent': userAgent
                    }
                })
                .then(res => res.json())
                .then( data => {
                    return data;
                })
                log.trace({res: res});
                data = res;
            }
        log.info({
            cache: 'set',
            url: url,
            keys: Object.keys(data).length
        })
        cache.set(url, data, 30);
        }catch(err){
            if ( err instanceof FetchError) {
                // Failed to download - load from cache
                data = cache.get(url);
            } else {
                log.error(err);
            }
        };
    }else{
        data = cache.get(url);
        log.info({
            cache: 'get',
            url: url,
            keys: Object.keys(data).length
        })
    }
    return data;
}

export async function getVatsimAFV (url) {
    var data = cache.get("vatsimAFV");
    if (data == undefined) {
        const res = await fetch(url)
            .then(res => res.json())
            .then( data => {
                return data;
            })
            .catch(err => log.error(err));
        data = res;
        log.info({
            cache: 'set',
            url: url,
            keys: Object.keys(data).length
        });
        cache.set("vatsimAFV", data, 15);
    }else{
        log.info({
            cache: 'get',
            url: url,
            keys: Object.keys(data).length
        })
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
    var ttlMs = cache.getTtl(url);
    let data;
    // vatSys data is refreshed daily. Check 2 minutes out from expiry.
    if (ttlMs == undefined || ttlMs - Date.now() <= 120000) {
        try{
            // Download fresh vatSys data
            if(ttlMs == undefined){
                log.warn({
                    cache: 'miss',
                    url: url
                })
                // If there is nothing cached - retry forever.
                const res = await fetch(url, {
                    retryOptions: {
                        retryMaxDuration: 30000, // Max 30s retrying
                        retryInitialDelay: 1000, // 1s initial wait
                        retryBackoff: 500 // 0.5s backoff
                    },
                    headers: {
                        'User-Agent': userAgent
                    }
                })
                .then(res => res.text())
                .then( data => {
                    return data;
                })
                log.trace({res: res});
                data = await xml2js(res, {compact: true, spaces: 4});
            }else{
                // If there is an old cache, timeout quickly.
                log.info({
                    cache: 'hit',
                    url: url,
                    msg: 'near expiry'
                })
                const res = await fetch(url, {
                    retryOptions: {
                        retryMaxDuration: 2000,
                        retryInitialDelay: 500,
                        retryBackoff: 1.0 // no backoff
                    },
                    headers: {
                        'User-Agent': userAgent
                    }
                })
                .then(res => res.text())
                .then( data => {
                    return data;
                })
                log.trace({res: res});
                data = await xml2js(res, {compact: true, spaces: 4});
            }
        }catch(err){
            if ( err instanceof FetchError) {
                // Failed to download - load from cache
                data = cache.get(url);
            } else {
                log.error(err);
            }
        };
        
        log.trace({data: data});
        var features = xmlToFeatures(data);
        log.info({
            cache: 'set',
            url: url,
            objs: data.length
        })
        cache.set(url, features, 86400);
        return features;
    }else{
        data = cache.get(url);
        log.info({
            cache: 'get',
            url: url,
            objs: data.length
        })
        return data;
    }
}

function xmlToFeatures (data) {
    var polys = [];
    // Take vatSys lines and parse into line array
    // ±DDMMSS.SSSS±DDDMMSS.SSSS
    // (?<latD>[+-][0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]{3})(?<lonD>[+-][0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]{3})
    const re = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]{3})(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]{3})/g)

    if(data.Maps.Map.Line == undefined){
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
            log.error(err);
        }
    }else{
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
            log.error(err);
        }
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