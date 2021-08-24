import express from 'express';
import cors from 'cors';
import { clearCache, cacheStats } from './client.js';
import {getPilots} from './pilots.js';
import { getATCSectors } from './atc.js';
import config from 'config';

const app = express()
const PORT = config.get('app.http.port');
const HOST = config.get('app.http.host');

var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }

app.use('/static', express.static('public'));
app.use('/testdata', express.static('data'));

app.get('/v1/pilots', cors(), async (req, res) => {
    var pilots = await getPilots();
    if(pilots == false){
      res.sendStatus(500);
    }else{
      res.send(pilots)
    }
});

app.get('/v1/atc/sectors', cors(), async (req, res) => {
  var sectors = await getATCSectors();
  if(sectors == false){
    res.sendStatus(500);
  }else{
    res.send(sectors)
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
console.log(`Running on http://${HOST}:${PORT}`);

// Warm cache
getPilots();
// getATCSectors();