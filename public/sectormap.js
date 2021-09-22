// import { feature, featureCollection, sector } from "@turf/turf";

function getSectorByName(sectorName, json){
    var sector = json.find(e => {
        if(e.Name === sectorName){
            return e;
        };
    });
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
            var poly = mergeBoundaries(sector);
            sectorVolumes.push(poly);
        });
        console.log(`rs array ${sector.Name}`)
        console.log(sectorVolumes);
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
    console.log(sector);
    console.log(features);
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
        var featureCollection = turf.featureCollection(array);
        if (featureCollection.length === 0) {
            return null
        }
        // buffer is a dirty dirty hack to close up some holes in datasets
        let ret = turf.buffer(featureCollection.features[0],0.3, {units: 'kilometers'});

        turf.featureEach(featureCollection, function (currentFeature, featureIndex) {
            if (featureIndex > 0) {
                ret = turf.union(ret, turf.buffer(currentFeature,0.3, {units: 'kilometers'}))
            }
        });
        return ret;
};

async function getColourHex(vatsysId){
    var res = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/atc/colours`);
    var json = await res.json();
    var colour = false;
    colour = json.find((e) => {
        if(e.id === vatsysId){
            return e;
        }
    })
    return colour.hex;
}

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
        stdSectors = turf.featureCollection(stdSectors);

        var allSectors = [];
        sectorsJson.forEach(sector => {
            if(sector.Callsign.includes("CTR")){
                var sector = mergeBoundaries(sector);
                if(sector != false){
                    allSectors.push(sector);
                }
            }
        });
        allSectors = turf.featureCollection(allSectors);
        SECTORS = allSectors;
        console.log(`SECTORS`)
        console.log(SECTORS);

        map.addSource('std', {
                    'type': 'geojson',
                    'data': stdSectors
                });

        map.addSource('nonstd', {
            'type': 'geojson',
            'data': allSectors
        });

        const stdLayout = {
            'text-field': ['format',
                ['get', 'Callsign'], {},
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

        const nonstdLayout = {
            'text-field': ['format',
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
        //     'id': 'stdPoly',
        //     'type': 'fill',
        //     'source': 'std', // reference the data source
        //     'layout': {},
        //     'paint': {
        //         'fill-color': await getColourHex('Infill')
        //         // 'fill-opacity': 0.3
        //     }
        // });
        map.addLayer({
            'id': 'stdLine',
            'type': 'line',
            'source': 'std', // reference the data source
            'layout': {},
            'maxzoom': 5,
            'paint': {
                'line-color': await getColourHex('GenericText'),
                'line-width': 1
                // 'fill-opacity': 0.3
            }
        });
        map.addLayer({
            'id': 'nonstdText',
            'type': 'symbol',
            'source': 'nonstd', // reference the data source
            'minzoom': 5,
            'layout': nonstdLayout,
            'paint': {
                'text-color': await getColourHex('NonInteractiveText')
            }
        });
        map.addLayer({
            'id': 'nonstdLine',
            'type': 'line',
            'source': 'nonstd',
            'layout': {},
            'minzoom': 5,
            'paint': {
            'line-color': await getColourHex('GenericText'),
            'line-width': 2
            }
        });

        map.addLayer({
            'id': 'stdText',
            'type': 'symbol',
            'source': 'std', // reference the data source
            'layout': stdLayout,
            'paint': {
                'text-color': await getColourHex('GenericText')
            }
        });

    }catch(err){
        // throw Error(err);
        console.log(err);
    }
};

const mapCenter = [134.9, -28.2];
const mapZoom = 4.3;

// Map BG ASDBackground

var SECTORS = false;

mapboxgl.accessToken = 'pk.eyJ1IjoiY3ljbG9wdGl2aXR5IiwiYSI6ImNqcDY0NnZnYzBmYjYzd284dzZudmdvZmUifQ.RyR4jd1HRggrbeZRvkv0xg';
var map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/cycloptivity/cksqo94ovrrk517lyn947vqw2',
    center: mapCenter, // starting position [lng, lat]
    zoom:  mapZoom, // starting zoom
    maxZoom: 7,
    attributionControl: false
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

map.addControl(new mapboxgl.AttributionControl({
customAttribution: '<a href="https://github.com/Kahn/vatsim-map">vatsim-map</a>'
}))

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
            feature['place_name'] = `${feature.properties.Callsign} (${feature.properties.Frequency})`;
            feature['center'] = turf.centroid(feature).geometry.coordinates;
            matchingFeatures.push(feature);
        }
        // Search by frequency
        if (
            feature.properties.Frequency
            .toLowerCase()
            .includes(query.toLowerCase())
            ) {
                feature['place_name'] = `${feature.properties.Callsign} (${feature.properties.Frequency})`;
                feature['center'] = turf.centroid(feature).geometry.coordinates;
                matchingFeatures.push(feature);
            }
    }
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

    map.addSource('graticule', {
        type: 'geojson',
        data: graticule
    });
    map.addLayer({
        id: 'graticule',
        type: 'line',
        source: 'graticule'
    });

    getATCSectors();


});
