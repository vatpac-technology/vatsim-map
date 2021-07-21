var turf = require('@turf/turf');
var xmlJs = require('xml-js');
var fs = require('fs');

// TODO - Real API client here
const vatsimData = require('./data/vatsim-data.json');

// Lines from https://github.com/vatSys/australia-dataset/blob/master/Maps/FIR_BOUNDARIES.xml
fs.readFile('./data/FIR_BOUNDARIES.xml', function(err, data){
    var res = xmlJs.xml2js(data, {compact: true, spaces: 4});
    // Iterate over each FIR Line
    res.Maps.Map.Line.forEach(function(vatSysLine) {
        // Create new JS obj
        var fir = {
            name: vatSysLine._attributes.Name,
            line: []
        }
        // Take vatSys lines and parse into line array
        const re = new RegExp(/(?<lat>[+-][0-9]{6}\.[0-9]{3})(?<lon>[+-][0-9]{7}\.[0-9]{3})/g);
        var str = vatSysLine._text;
        var lines = [...str.matchAll(re)];
        lines.forEach(function(line){
            var a = [line.groups.lat, line.groups.lon]
            // Append extract arrays to fir.line array
            fir.line.push(a);
        });
        console.log(fir)
    });        
});


// var poly = turf.lineToPolygon(MELBOURNE_FIR,{mutate: true});

// vatsimData.pilots.forEach(function(pilot) {
//   var ppos = turf.point([pilot.latitude, pilot.longitude]);
//   if(turf.booleanPointInPolygon(ppos, poly)){
//     console.log(pilot.callsign);
//   }
// });