// import { feature, featureCollection, sector } from "@turf/turf";

function findGetParameter(parameterName) {
    var result = false,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
        tmp = item.split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
};

function getSectorByName(sectorName, json){
    var sector = json.find(e => {
        if(e.Name === sectorName){
            return e;
        };
    });
    if(sector === undefined){
        console.log(`Loading sector ${sectorName} failed`);
    }
    return sector;
}

function mergeSectors(sector, sectors, json){
    let mergedSector;
    // FSS don't have sector volumes, only responsible sectors.
    if(sector.volumes.length > 0){
        mergedSector = mergeBoundaries(sector);
    }
    if(sectors.length > 0){
        var sectorVolumes = [];
        // Union all sector volumes into a polygon
        sectors.forEach(function(e){
            var sector = getSectorByName(e, json);
            if(sector){
                var poly = mergeBoundaries(sector);
                sectorVolumes.push(poly);
            }
        });
        // Add self and union all sector volumes
        sectorVolumes.push(mergeBoundaries(sector));
        var mergedPoly = unionArray(sectorVolumes);
        mergedSector = mergedPoly;
    }
    if(mergedSector != undefined){
        mergedSector.properties = {...sector};
        delete mergedSector.properties.responsibleSectors
        delete mergedSector.properties.volumes
        return mergedSector;
    }
}

function mergeBoundaries(sector){
    var features = sector.volumes.map((volume) => volume.Boundaries.map((boundary) => boundary)).flat();
    if(features.length > 1){
        var union = unionArray(features);
        union.properties = { ...sector };
        delete union.properties.responsibleSectors;
        delete union.properties.volumes;
        return union;
    }else if (features.length == 1){
        features[0].properties = { ...sector };
        delete features[0].properties.responsibleSectors;
        delete features[0].properties.volumes;
        return features[0];
    }else{
        return false;
    }
}

function unionArray(array){
        const bufferKm = 0.2;
        var featureCollection = turf.featureCollection(array);
        if (featureCollection.length === 0) {
            return null
        }
        // buffer is a dirty dirty hack to close up some holes in datasets
        let ret = turf.buffer(featureCollection.features[0],bufferKm, {units: 'kilometers'});
        // let ret = featureCollection.features[0];

        turf.featureEach(featureCollection, function (currentFeature, featureIndex) {
            if (featureIndex > 0) {
                ret = turf.union(ret, turf.buffer(currentFeature,bufferKm, {units: 'kilometers'}))
                // ret = turf.union(ret, currentFeature);
            }
        });

        // Remove any holes added in union
        ret.geometry.coordinates.length = 1;

        return ret;
};

// async function getColourHex(vatsysId){
//     var res = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/atc/colours`);
//     var json = await res.json();
//     var colour = false;
//     colour = json.find((e) => {
//         if(e.id === vatsysId){
//             return e;
//         }
//     })
//     return colour.hex;
// }

async function getATCSectors() {
    try{
        var sectorsResponse = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/atc/sectors`);
        var sectorsJson = await sectorsResponse.json();

        var stdSectors = [];
        sectorsJson.forEach(sector => {
            if(sector.standard_position === true){
                // Merge responsible sectors
                var mergedSector = mergeSectors(sector, sector.responsibleSectors, sectorsJson)
                stdSectors.push(mergedSector);
            }

        });

        var upperSectors = [];
        sectorsJson.forEach(sector => {
            if(sector.Callsign.includes("FSS") ||sector.Callsign.includes("CTR")){
                var sector = mergeBoundaries(sector);
                if(sector != false){
                    upperSectors.push(sector);
                }
            }
        });

        var tmaSectors = [];
        sectorsJson.forEach(sector => {
            if(sector.Callsign.includes("APP")){
                var sector = mergeBoundaries(sector);
                if(sector != false){
                    tmaSectors.push(sector);
                }
            }
        });

        var twrSectors = [];
        sectorsJson.forEach(sector => {
            if(sector.Callsign.includes("TWR")){
                var sector = mergeBoundaries(sector);
                if(sector != false){
                    twrSectors.push(sector);
                }
            }
        });

        SECTORS = turf.featureCollection(upperSectors.concat(tmaSectors,twrSectors));
        console.log(`debug geojson`)
        console.log(SECTORS);

        map.addSource('std', {
            'type': 'geojson',
            'data': turf.featureCollection(stdSectors)
        });

        map.addSource('upper', {
            'type': 'geojson',
            'data': turf.featureCollection(upperSectors)
        });

        map.addSource('tma', {
            'type': 'geojson',
            'data': turf.featureCollection(tmaSectors)
        });

        map.addSource('twr', {
            'type': 'geojson',
            'data': turf.featureCollection(twrSectors)
        });

        const stdLayout = {
            'text-field': ['format',
                ['get', 'Name'], {},
                //"\n", {},
                //['get', 'FullName'], {},
                "\n", {},
                ['get', 'Frequency'], {},
            ],
            'text-font': [
                'Open Sans Semibold',
                'Arial Unicode MS Bold'
            ],
            'text-size': 14,
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-ignore-placement': false
        };

        const twrTmaLayout = {
            'text-field': ['format',
                ['get', 'FullName'], {},
                "\n", {},
                ['get', 'Callsign'], {},
                "\n", {},
                ['get', 'Frequency'], {},
            ],
            'text-font': [
                'Open Sans Semibold',
                'Arial Unicode MS Bold'
            ],
            'text-size': 12,
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-ignore-placement': false
        };

        const nonstdLayout = {
            'text-field': ['format',
                ['get', 'FullName'], {},
                "\n", {},
                ['get', 'Callsign'], {},
                "\n", {},
                ['get', 'Frequency'], {},
            ],
            'text-font': [
                'Open Sans Semibold',
                'Arial Unicode MS Bold'
            ],
            'text-size': 10,
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-ignore-placement': false
        };

        // map.addLayer({
        //     'id': 'tmaPoly',
        //     'type': 'fill',
        //     'source': 'twr', // reference the data source
        //     'layout': {},
        //     'paint': {
        //         'fill-color': '#23d922',
        //         'fill-opacity': 0.2
        //     }
        // });
        // map.addLayer({
        //     'id': 'twrPoly',
        //     'type': 'fill',
        //     'source': 'tma', // reference the data source
        //     'layout': {},
        //     'paint': {
        //         'fill-color': '#ab0dde',
        //         'fill-opacity': 0.1
        //     }
        // });

        map.addLayer({
            'id': 'tmaLine',
            'type': 'line',
            'source': 'tma',
            'layout': {},
            'minzoom': 5,
            'paint': {
            'line-color': "#33cc99",
            'line-width': 3,
            'line-dasharray': [5, 5]
            }
        });

        map.addLayer({
            'id': 'twrLine',
            'type': 'line',
            'source': 'twr',
            'layout': {},
            'minzoom': 5,
            'paint': {
            'line-color': "#3b8df9",
            'line-width': 3,
            'line-dasharray': [1, 1]
            }
        });

        map.addLayer({
            'id': 'upperLine',
            'type': 'line',
            'source': 'upper',
            'layout': {},
            'minzoom': 5,
            'paint': {
            'line-color': "#949494",
            'line-width': 1
            }
        });

        map.addLayer({
            'id': 'stdLine',
            'type': 'line',
            'source': 'std', // reference the data source
            'layout': {},
            // 'maxzoom': 5,
            'paint': {
                'line-color': "#000",
                'line-width': 4
                // 'fill-opacity': 0.3
            }
        });

        map.addLayer({
          'id': 'stdText',
          'type': 'symbol',
          'source': 'std', // reference the data source
          'layout': stdLayout,
          'paint': {
              'text-color': "#000",
          }
      });

        map.addLayer({
            'id': 'upperText',
            'type': 'symbol',
            'source': 'upper', // reference the data source
            'minzoom': 5,
            'layout': nonstdLayout,
            'paint': {
                'text-color': "#646464",
            }
        });

        map.addLayer({
            'id': 'tmaText',
            'type': 'symbol',
            'source': 'tma', // reference the data source
            'minzoom': 8,
            'layout': twrTmaLayout,
            'paint': {
                'text-color': "#33cc99",
            }
        });

        map.addLayer({
            'id': 'twrText',
            'type': 'symbol',
            'source': 'twr', // reference the data source
            'minzoom': 8,
            'layout': twrTmaLayout,
            'paint': {
                'text-color': "#3b8df9",
            }
        });



    }catch(err){
        // throw Error(err);
        console.log(err);
    }
};
// Map BG ASDBackground

// Define global SECTORS to enable geocoder
var SECTORS = [false];

mapboxgl.accessToken = 'pk.eyJ1IjoiY3ljbG9wdGl2aXR5IiwiYSI6ImNqcDY0NnZnYzBmYjYzd284dzZudmdvZmUifQ.RyR4jd1HRggrbeZRvkv0xg';
var map = new mapboxgl.Map({
    container: 'map', // container ID
    // style: 'mapbox://styles/cycloptivity/cksqo94ovrrk517lyn947vqw2',
    style: 'mapbox://styles/cycloptivity/ckrai7rg601cw18p5zu4ntq27',
    //center: [134.9, -28.2 ],
    //zoom: 15,
    maxZoom: 8,
    attributionControl: false
    // projection: {
    //     name: "lambertConformalConic",
    //     center: [130, -25],
    //     parallels: [-12, -36.25]
    // }
    // projection name globe
});
// map.dragRotate.disable();
// map.touchZoomRotate.disableRotation();

async function getDataset() {
    var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/dataset`);
    var json = await response.json();
    dataset = json;
    return json;
};

(async () => {
    var dataset = await getDataset();
    map.addControl(new mapboxgl.AttributionControl({
        customAttribution: `vatSys ${dataset.Profile._attributes.Name} dataset <strong>AIRAC ${dataset.Profile.Version._attributes.AIRAC}${dataset.Profile.Version._attributes.Revision}</strong> | <a href="https://github.com/Kahn/vatsim-map">vatsim-map</a>`
    }))
})();

//options.localGeocoder Function? A function accepting the query string which performs local geocoding to supplement results from the Mapbox Geocoding API. Expected to return an Array of GeoJSON Features in the Carmen GeoJSON format.
function forwardGeocoder(query) {
    const matchingFeatures = [];
    for (const feature of SECTORS.features) {
        // Search by callsign
        if (
        feature.properties.Callsign
        .toLowerCase()
        .includes(query.toLowerCase())
        ) {
            feature['place_name'] = `${feature.properties.FullName} ${feature.properties.Callsign} (${feature.properties.Frequency})`;
            feature['center'] = turf.centroid(feature).geometry.coordinates;
            matchingFeatures.push(feature);
        }
        // Search by frequency
        if (
            feature.properties.Frequency
            .toLowerCase()
            .includes(query.toLowerCase())
            ) {
                feature['place_name'] = `${feature.properties.FullName} ${feature.properties.Callsign} (${feature.properties.Frequency})`;
                feature['center'] = turf.centroid(feature).geometry.coordinates;
                matchingFeatures.push(feature);
            }
        // Search by Name
        if (
            feature.properties.FullName
            .toLowerCase()
            .includes(query.toLowerCase())
            ) {
                feature['place_name'] = `${feature.properties.FullName} ${feature.properties.Callsign} (${feature.properties.Frequency})`;
                feature['center'] = turf.centroid(feature).geometry.coordinates;
                matchingFeatures.push(feature);
            }
    };
    return matchingFeatures;
}

map.addControl(
    new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        localGeocoder: forwardGeocoder,
        localGeocoderOnly: true,
        zoom: 6,
        marker: true,
        placeholder: 'Find sector or frequency'
    })
    );

// Thanks to https://github.com/mapbox/mapbox-gl-js/issues/10093#issuecomment-726192651
const graticule = {
    type: 'FeatureCollection',
    features: []
};
for (let lng = -170; lng <= 180; lng += 10) {
    graticule.features.push({
        type: 'Feature',
        geometry: {type: 'LineString', coordinates: [[lng, -90], [lng, 90]]},
        properties: {value: lng}
    });
}
for (let lat = -80; lat <= 80; lat += 10) {
    graticule.features.push({
        type: 'Feature',
        geometry: {type: 'LineString', coordinates: [[-180, lat], [180, lat]]},
        properties: {value: lat}
    });
}


map.on('load', function () {

    map.jumpTo({
        center: [findGetParameter('lon') || 134.9, findGetParameter('lat') || -28.2 ],
        zoom:  findGetParameter('zoom') || 4.3,
    })

    map.addSource('graticule', {
        type: 'geojson',
        data: graticule
    });
    map.addLayer({
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        'paint': {
            'line-color': "#dedede",
            'line-width': 0.5
        }
    });

    getATCSectors();


});
