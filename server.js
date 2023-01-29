import express from 'express';
import cors from 'cors';
import { clearCache, cacheStats } from './client.js';
import {getPilots} from './pilots.js';
import { getATCSectors, getCoastline, getColours, getOnlinePositions } from './atc.js';
import { getAerodromes, getMajorAerodromes, getAerodromeBays } from './aerodrome.js';
import config from 'config';
import { getOSMAerodromeData } from './client.js';
import { getDataset } from './dataset.js';

const app = express()
const PORT = config.get('app.http.port');
const HOST = config.get('app.http.host');

var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }

app.get('/', cors(), async (req, res) => {
    res.send(`
    <ul>
    <li><a href="/static/sectormap.html">ATC sector map</a></li>
    <li><a href="/static/map.html?theme=light">Pilots map - light theme</a></li>
    <li><a href="/static/map.html?theme=dark">Pilots map - dark theme</a></li>
    </ul>
    ${config.get('app.name')} / ${config.get('app.version')} ${process.env.NODE_ENV || "dev"}
    `);
});

app.use('/static', express.static('public'));
app.use('/favicon.ico', express.static('public/favicon.ico'));

app.use('/testdata', express.static('data'));

app.get('/v1/dataset', cors(), async (req, res) => {
  var dataset = await getDataset();
  if(dataset == false){
    res.sendStatus(500);
  }else{
    res.send(dataset)
  }
});

app.get('/v1/pilots', cors(), async (req, res) => {
    var pilots = await getPilots();
    if(pilots == false){
      res.sendStatus(500);
    }else{
      res.send(pilots)
    }
});

app.get('/v1/flights/callsign/:callsign', cors(), async (req, res) => {
  const pilots = await getPilots();
  const feature = pilots.features.find(e => e.properties.pilot.callsign == req.params.callsign)
  if(feature == false){
    res.sendStatus(500);
  } else if(feature == undefined){
    res.sendStatus(404);
  }else{
    res.send(feature.properties.pilot)
  }
});

app.get('/v1/flights/cid/:cid', cors(), async (req, res) => {
  const pilots = await getPilots();
  const feature = pilots.features.find(e => e.properties.pilot.cid == req.params.cid)
  if(feature == false){
    res.sendStatus(500);
  } else if(feature == undefined){
    res.sendStatus(404);
  }else{
    res.send(feature.properties.pilot)
  }
});

app.get('/v1/flights/arrivals/:icaoCode', cors(), async (req, res) => {
  const pilotData = await getPilots();
  var features = false;
  var pilots = [];
  try{
    features = pilotData.features.filter(e => e.properties.pilot.flight_plan.arrival == req.params.icaoCode)
    features.forEach(function(e){pilots.push(e.properties.pilot)})
  } catch (e) {}

  if(features == false){
    res.sendStatus(500);
  }else{
    res.send(pilots)
  }
});

app.get('/v1/flights/departures/:icaoCode', cors(), async (req, res) => {
  const pilotData = await getPilots();
  var features = false;
  var pilots = [];
  try{
    features = pilotData.features.filter(e => e.properties.pilot.flight_plan.departure === req.params.icaoCode)
    features.forEach(function(e){pilots.push(e.properties.pilot)})
  } catch (e) {}

  if(features == false){
    res.sendStatus(500);
  }else{
    res.send(pilots)
  }
});

app.get('/v1/atc/sectors', cors(), async (req, res) => {
  var standardOnly = (req.query.standardOnly == undefined ? false : req.query.standardOnly.toString());
  var sectors = await getATCSectors();
  if (standardOnly == "true"){
    sectors = sectors.filter(function(sector) {
      return sector.standard_position == true;
    });
  }
  if(sectors == false){
    res.sendStatus(500);
  }else{
    res.send(sectors)
  }
});

app.get('/v1/atc/online', cors(), async (req, res) => {
  var sectors = await getOnlinePositions();
  if(sectors == false){
    res.sendStatus(500);
  }else{
    res.send(sectors)
  }
});

app.get('/v1/aerodromes', cors(), async (req, res) => {
  var data = await getAerodromes();
  if(data == false){
    res.sendStatus(500);
  }else{
    res.send(data)
  }
});

app.get('/v1/aerodromes/bays', cors(), async (req, res) => {
  var data = await getAerodromeBays();
  if(data == false){
    res.sendStatus(500);
  }else{
    res.send(data)
  }
});

app.get('/v1/aerodromes/major', cors(), async (req, res) => {
  var data = await getMajorAerodromes();
  if(data == false){
    res.sendStatus(500);
  }else{
    res.send(data)
  }
});


// app.get('/v1/aerodromes/:icao', cors(), async (req, res) => {
//   var data = await getAerodromes();
//   if(data == false){
//     res.sendStatus(500);
//   }else{
//     res.send(data)
//   }
// });

app.get('/v1/atc/coastline', cors(), async (req, res) => {
  var data = await getCoastline();
  if(data == false){
    res.sendStatus(500);
  }else{
    res.send(data)
  }
});

app.get('/v1/atc/colours', cors(), async (req, res) => {
  var data = await getColours();
  if(data == false){
    res.sendStatus(500);
  }else{
    res.send(data)
  }
});

app.get('/v1/cache/clear', cors(), (req, res) => {
  clearCache();
  return res.sendStatus(200);
});

app.get('/v1/cache/stats', cors(), (req, res) => {
  return res.send(cacheStats());
});

app.listen(PORT, HOST);
//console.log(`Running on http://${HOST}:${PORT}`);

// Fill OSM cache
getAerodromes();