import bunyan from 'bunyan';
import config from 'config';
import { getXMLtoJS } from './client.js';

var log = bunyan.createLogger({name: config.get('app.name'), level: config.get('app.log_level')});

export async function getDataset(){
    try{
        var profile = await getXMLtoJS(config.get('data.vatsys.profileUrl'));
        return profile;
    }catch(err){
        log.error(err)
        return false;
    }
}