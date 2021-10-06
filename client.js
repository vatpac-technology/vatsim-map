import NodeCache from 'node-cache';
import fetch from '@adobe/node-fetch-retry';
import { xml2js } from 'xml-js';
import { lineToPolygon, lineString } from '@turf/turf';
import bunyan from 'bunyan';
import { FetchError } from 'node-fetch';
import query_overpass from 'query-overpass';
import config from 'config';
import { iso2dec } from './iso2dec.js';
import {Mutex, Semaphore, withTimeout} from 'async-mutex';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

const cache = new NodeCache( { stdTTL: 15, checkperiod: 30 } );
const userAgent = `User-Agent: ${config.get('app.name')} / ${config.get('app.version')} ${config.get('app.url')}`

const mutex = new Mutex();

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

export function cacheStats(){
    var stats = cache.getStats();
    log.info({stats: stats});
    return stats;
}

export async function getOSMAerodromeData (areaName) {
    log.info(`getOSMAerodromeData`);
    var data = await mutex.runExclusive(async () => {
        log.info(`mutex locked`);
        var ttlMs = cache.getTtl(areaName);
        let data;
        if (ttlMs == undefined || ttlMs - Date.now() <= 120000) {
            log.info(`Querying OSM`);
            try{
                data = await query_overpass(
                    `area["name"="${areaName}"]->.boundaryarea;
                    (
                    nwr(area.boundaryarea)["aeroway"="aerodrome"];
                    );
                    out body;
                    >;
                    out skel qt;`,
                    function(err, data){
                        if(err){
                            log.error(err);
                        }else{
                            log.info({
                                cache: 'set',
                                area: areaName,
                                keys: Object.keys(data).length
                            })
                            cache.set(areaName, data, 86400);
                        }
                    },
                    { overpassUrl: config.get('data.osm.overpassUrl'), userAgent: `${config.get('app.name')}/${config.get('app.version')}` }
                );
                log.error({data: data});
            }catch(err){
                log.error(`Failed quering overpass`);
                log.error({err: err});
            }
        }else{
            log.info(`Return cached OSM response`);
            data = cache.get(areaName);
            log.info({
                cache: 'get',
                area: areaName,
                keys: Object.keys(data).length
            })
        }
        return data;
    });
    return data;
};

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
        log.debug({
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
        log.debug({
            cache: 'get',
            url: url,
            keys: Object.keys(data).length
        })
    }
    return data;
}

/**
 * Gets a vatsys XML URL and returns JS object
 * @param {string} url 
 * @returns Object
 */
 export async function getXMLtoJS (url) {
    // Extract vatSys XML into object
    var ttlMs = cache.getTtl(`getXMLtoJS-${url}`);
    let data;
    // vatSys data is refreshed daily. Check 2 minutes out from expiry.
    if (ttlMs == undefined || ttlMs - Date.now() <= 120000) {
        try{
            // Download fresh vatSys data
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
        log.info({
            cache: 'set',
            url: url,
            objs: data.length
        })
        cache.set(`getXMLtoJS-${url}`, data, 86400);
        return data;
    }else{
        data = cache.get(`getXMLtoJS-${url}`);
        log.info({
            cache: 'get',
            url: url,
            objs: data.length
        })
        return data;
    }
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

    if("Volumes" in data){
        // Handle volumes
        try{
            data.Volumes.Boundary.forEach(function(obj){
                var lines = obj._text.split('/');
                lines.forEach(function(line, index) {
                    var dec = iso2dec(line);
                    this[index] = [dec.longitude, dec.latitude];
                  }, lines);
                // Create GeoJSON poly
                if(lines.length > 0){
                    polys.push(lineToPolygon(lineString(lines),{mutate: true, properties: obj._attributes }));
                }
            })
        }catch(err){
            log.error(err);
        }
    };

    if ("Maps" in data) {
        // Handle Maps - FIR Boundaries
        try{
            data.Maps.Map.Line.forEach(function(obj){
                var lines = obj._text.split('/');
                lines.forEach(function(line, index) {
                    var dec = iso2dec(line);
                    this[index] = [dec.longitude, dec.latitude];
                  }, lines);
                // Create GeoJSON poly
                if(lines.length > 0){
                    polys.push(lineToPolygon(lineString(lines),{ properties: obj._attributes }));
                }
            })
        }catch(err){
            log.error(err);
            throw err;
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