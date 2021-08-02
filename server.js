import express from 'express';
import cors from 'cors';
import { clearCache } from './client.js';
import {getPilots} from './pilots.js';
import { getATCSectors } from './atc.js';

const app = express()
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }

app.use('/static', express.static('public'));

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

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);

// Warm cache
getPilots();
getATCSectors();