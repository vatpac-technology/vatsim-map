async function getATCSectors() {
    try{
        var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/atc/sectors`);
        var json = await response.json();
        map.addSource('sectors', {
                    'type': 'geojson',
                    'data': json
                });
        // Add a new layer to visualize the polygon.
        map.addLayer({
        'id': 'sectors',
        'type': 'fill',
        'source': 'sectors', // reference the data source
        'layout': {},
        'paint': {
        'fill-color': '#0080ff', // blue color fill
        'fill-opacity': 0.1
        }
        });
        // Add a black outline around the polygon.
        map.addLayer({
        'id': 'outline',
        'type': 'line',
        'source': 'sectors',
        'layout': {},
        'paint': {
        'line-color': '#000',
        'line-width': 1
        }
        });
        // // Add sector labels
        // json.features.forEach(function(sector){
        //     console.log(sector)
        //     var marker = new mapboxgl.Marker()
        //     .setLngLat(turf.center({geojson: sector}))
        //     .addTo(map);
        // });
        
    }catch(err){
        throw Error(err);
    }
};

const mapCenter = [134.9, -28.2];
const mapZoom = 3;

mapboxgl.accessToken = 'pk.eyJ1IjoiY3ljbG9wdGl2aXR5IiwiYSI6ImNqcDY0NnZnYzBmYjYzd284dzZudmdvZmUifQ.RyR4jd1HRggrbeZRvkv0xg';
var map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/cycloptivity/cksqo94ovrrk517lyn947vqw2', // style URL
    center: mapCenter, // starting position [lng, lat]
    zoom:  mapZoom, // starting zoom
    attributionControl: false
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

map.addControl(new mapboxgl.AttributionControl({
customAttribution: '<a href="https://github.com/Kahn/vatsim-map">vatsim-map</a>'
}))

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
