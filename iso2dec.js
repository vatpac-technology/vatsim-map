import bunyan from 'bunyan';
import config from 'config';

import dms2dec from 'dms2dec';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

// https://virtualairtrafficsystem.com/docs/dpk/
// https://github.com/vatSys/xml-tools/blob/master/DotAIPtoXML/DotAIPtoXML/Coordinate.cs#L119
// Latitude and Longitude in Degrees:
//     ±DD.DDDD±DDD.DDDD         (eg +12.345-098.765)
const latlngd = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2}\.[0-9]+)(?<lonRef>[+-])(?<lonD>[0-9]{3}\.[0-9]+)/);
// Latitude and Longitude in Degrees and Minutes:
//     ±DDMM.MMMM±DDDMM.MMMM     (eg +1234.56-09854.321)
const latlngdm = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2}\.[0-9]+)(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2}\.[0-9]+)/);
// Latitude and Longitude in Degrees, Minutes and Seconds:
//     ±DDMMSS.SSSS±DDDMMSS.SSSS (eg +123456.7-0985432.1)
const latlngdms = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]+)(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]+)/);
// Latitude, Longitude (in Degrees) and Altitude:
//     ±DD.DDDD±DDD.DDDD±AAA.AAA         (eg +12.345-098.765+15.9)
const latlngdalt = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2}\.[0-9]+)(?<lonRef>[+-])(?<lonD>[0-9]{3}\.[0-9]+)(?<altitude>[+-][0-9]{1,3}\.[0-9]+)/);
// Latitude, Longitude (in Degrees and Minutes) and Altitude:
//     ±DDMM.MMMM±DDDMM.MMMM±AAA.AAA     (eg +1234.56-09854.321+15.9)
const latlngdmalt = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2}\.[0-9]+)(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2}\.[0-9]+)(?<altitude>[+-][0-9]{1,3}\.[0-9]+)/)
// Latitude, Longitude (in Degrees, Minutes and Seconds) and Altitude:
//     ±DDMMSS.SSSS±DDDMMSS.SSSS±AAA.AAA (eg +123456.7-0985432.1+15.9)
const latlngdmsalt = new RegExp(/(?<latRef>[+-])(?<latD>[0-9]{2})(?<latM>[0-9]{2})(?<latS>[0-9]{2}\.[0-9]+)(?<lonRef>[+-])(?<lonD>[0-9]{3})(?<lonM>[0-9]{2})(?<lonS>[0-9]{2}\.[0-9]+)(?<altitude>[+-][0-9]{1,3}\.[0-9]+)/);

function idl(latitude,longitude){
    // Partial implementation from https://docs.mapbox.com/mapbox-gl-js/example/line-across-180th-meridian/
    // To draw a line across the 180th meridian,
    // if the longitude of the second point minus
    // the longitude of original (or previous) point is >= 180,
    // subtract 360 from the longitude of the second point.
    // If it is less than 180, add 360 to the second point.

    if(longitude > 179 || longitude < -179){
        console.log({latitude: latitude, longitude: longitude})
    }

    // Since we don't know about lines, only points we clobber all points to suit Australia.
    if(longitude < 0){
        longitude = longitude + 360;
        console.log(longitude);
    }
    return {latitude: latitude, longitude: longitude};
}

export function iso2dec(string){
    switch(true) {
        case latlngdmsalt.test(string):
            log.debug("Matched DMS ALT")
            var match = string.match(latlngdmsalt);
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
            };
            var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
            return idl(latitude, longitude)
            // return {latitude: latitude, longitude: longitude};
        case latlngdmalt.test(string):
            log.debug("Matched DM ALT")
            var match = string.match(latlngdmalt);
            var pos = {
                latitude: [
                    parseInt(match.groups.latD),
                    parseFloat(match.groups.latM),
                    0
                ],
                latRef: (match.groups.latRef == '+') ? "N" : "S",
                longitude: [
                    parseInt(match.groups.lonD),
                    parseFloat(match.groups.lonM),
                    0
                ],
                lonRef: (match.groups.lonRef == '+') ? "E" : "W"
            };
            var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
            return idl(latitude, longitude)
            // return {latitude: latitude, longitude: longitude};
        case latlngdalt.test(string):
            log.debug("Matched D ALT")
            var match = string.match(latlngdalt);
            var pos = {
                latitude: [
                    parseFloat(match.groups.latD),
                    0,
                    0
                ],
                latRef: (match.groups.latRef == '+') ? "N" : "S",
                longitude: [
                    parseFloat(match.groups.lonD),
                    0,
                    0
                ],
                lonRef: (match.groups.lonRef == '+') ? "E" : "W"
            };
            var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
            return idl(latitude, longitude)
            // return {latitude: latitude, longitude: longitude};
        case latlngdms.test(string):
            log.debug("Matched DMS")
            var match = string.match(latlngdms);
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
            };
            var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
            return idl(latitude, longitude)
            // return {latitude: latitude, longitude: longitude};
        case latlngdm.test(string):
            log.debug("Matched DM")
            var match = string.match(latlngdm);
            var pos = {
                latitude: [
                    parseInt(match.groups.latD),
                    parseFloat(match.groups.latM),
                    0
                ],
                latRef: (match.groups.latRef == '+') ? "N" : "S",
                longitude: [
                    parseInt(match.groups.lonD),
                    parseFloat(match.groups.lonM),
                    0
                ],
                lonRef: (match.groups.lonRef == '+') ? "E" : "W"
            };
            var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
            return idl(latitude, longitude)
            // return {latitude: latitude, longitude: longitude};
        case latlngd.test(string):
            log.debug("Matched D")
            var match = string.match(latlngd);
            var pos = {
                latitude: [
                    parseFloat(match.groups.latD),
                    0,
                    0
                ],
                latRef: (match.groups.latRef == '+') ? "N" : "S",
                longitude: [
                    parseFloat(match.groups.lonD),
                    0,
                    0
                ],
                lonRef: (match.groups.lonRef == '+') ? "E" : "W"
            };
            var [ latitude, longitude ] = dms2dec(pos.latitude,pos.latRef,pos.longitude,pos.lonRef);
            return idl(latitude, longitude)
            // return {latitude: latitude, longitude: longitude};
        default:
            log.warn('iso2deg failed to match')
            return false;
    }
};