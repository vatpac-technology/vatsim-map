// jshint esversion:6

// From https://dev.to/jsmccrumb/asynchronous-setinterval-4j69
const asyncIntervals = [];

const runAsyncInterval = async (cb, interval, intervalIndex) => {
  await cb();
  if (asyncIntervals[intervalIndex]) {
    setTimeout(() => runAsyncInterval(cb, interval, intervalIndex), interval);
  }
};

const setAsyncInterval = (cb, interval) => {
  if (cb && typeof cb === "function") {
    const intervalIndex = asyncIntervals.length;
    asyncIntervals.push(true);
    runAsyncInterval(cb, interval, intervalIndex);
    return intervalIndex;
  } else {
    throw new Error('Callback must be a function');
  }
};

const clearAsyncInterval = (intervalIndex) => {
  if (asyncIntervals[intervalIndex]) {
    asyncIntervals[intervalIndex] = false;
  }
};

const mapCenter = [134.9, -28.2];
const mapZoom = 3;
const styleLight = 'mapbox://styles/cycloptivity/ckrai7rg601cw18p5zu4ntq27';
const styleDark = 'mapbox://styles/cycloptivity/ckrsmmn0623yb17pew9y59lao';
mapboxgl.accessToken = 'pk.eyJ1IjoiY3ljbG9wdGl2aXR5IiwiYSI6ImNqcDY0NnZnYzBmYjYzd284dzZudmdvZmUifQ.RyR4jd1HRggrbeZRvkv0xg';
var markers = [];
var reload = true;
var pilots = {};
const redrawTimeoutMs = 15000;
// Global to share JSON between functions
// var pilots = getPilots();
// pilots = setInterval(,15000);


var map = new mapboxgl.Map({
        container: 'map', // container ID
        style: styleLight, // style URL
        center: mapCenter, // starting position [lng, lat]
        zoom:  mapZoom // starting zoom
});

// disable map rotation using right click + drag
map.dragRotate.disable();

// disable map rotation using touch rotation gesture
map.touchZoomRotate.disableRotation();

// Add map controls      
// document.getElementById('listing-group').addEventListener('change', (e) => {
// const handler = e.target.id;
// console.log(handler);
// if (e.target.checked) {
//     // setPilotMarkers(false);
//     map[handler].enable();
// } else {
//     map[handler].disable();
// }
// });

// Light / Dark switch
function findGetParameter(parameterName) {
    var result = null,
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
var theme = findGetParameter('theme');
if(theme == 'dark'){
    map.setStyle(styleDark);
}

async function getPilots() {
    var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/pilots`);
    var json = await response.json();
    pilots = json;
    return json;
};

//options.localGeocoder Function? A function accepting the query string which performs local geocoding to supplement results from the Mapbox Geocoding API. Expected to return an Array of GeoJSON Features in the Carmen GeoJSON format.
function forwardGeocoder(query) {
    const matchingFeatures = [];
    for (const feature of pilots.features) {
    // Handle queries with different capitalization
    // than the source data by calling toLowerCase().
    if (
    feature.properties.pilot.callsign
    .toLowerCase()
    .includes(query.toLowerCase())
    ) {
    // Add a tree emoji as a prefix for custom
    // data results using carmen geojson format:
    // https://github.com/mapbox/carmen/blob/master/carmen-geojson.md
    feature['place_name'] = `${feature.properties.pilot.callsign}`;
    feature['center'] = feature.geometry.coordinates;
    // feature['place_type'] = ['park'];
    matchingFeatures.push(feature);
    }
    }
    return matchingFeatures;
}

// Add the search control to the map.
map.addControl(
new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    localGeocoder: forwardGeocoder,
    localGeocoderOnly: true,
    zoom: 12,
    marker: false,
    placeholder: 'Find aircraft'
})
);


// async function getATCSectors() {
//     try{
//         var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/atc/sectors`);
//         var json = await response.json();
//         map.addSource('sectors', {
//                     'type': 'geojson',
//                     'data': json
//                 });
//         // Add a new layer to visualize the polygon.
//         map.addLayer({
//         'id': 'sectors',
//         'type': 'fill',
//         'source': 'sectors', // reference the data source
//         'layout': {},
//         'paint': {
//         'fill-color': '#0080ff', // blue color fill
//         'fill-opacity': 0.1
//         }
//         });
//         // Add a black outline around the polygon.
//         map.addLayer({
//         'id': 'outline',
//         'type': 'line',
//         'source': 'sectors',
//         'layout': {},
//         'paint': {
//         'line-color': '#000',
//         'line-width': 1
//         }
//         });
//         // // Add sector labels
//         // json.features.forEach(function(sector){
//         //     console.log(sector)
//         //     var marker = new mapboxgl.Marker()
//         //     .setLngLat(turf.center({geojson: sector}))
//         //     .addTo(map);
//         // });
        
//     }catch(err){
//         throw Error(err);
//     }
// };

function formatCodeString(string, length){
    const re = (/(\w+\/\w+)|(\w+)/g)
    var resString = '';
    try{
        var matches = [...string.matchAll(re)];
        const lineLen = length;
        var count = 1;
        for (const match of matches) {
            if(count < lineLen){
                if(resString == "") {
                    resString = match[0];
                    count++;
                }else{
                    resString = resString + ' ' + match[0];
                    count++;
                }
            }else{
                resString = resString + ' ' +  match[0] + '\n    ';
                count = 0;
            }
        }
        resString.replace(/\n+$/, "");
        return resString;
    }catch(err){
        console.log(err)
    };
}

function formatTypeString(string){
    try{
        var slash = string.split('/');
        var hyphen = slash[1].split('-')

        if (hyphen[1] == undefined){
            // FAA types
            var wake = "NIL";
        }else{
            // Parse ICAO formats
            var wake = (hyphen[0] == "J" || hyphen[0] == "H" || hyphen[0] == "M" || hyphen[0] == "L" ? hyphen[0] : "NIL");
            var equipment = (hyphen[1] == undefined ? "NIL" : hyphen[1]);
        }
        return [slash[0], wake, equipment];
    }catch(err){
        if(err instanceof TypeError){
            // Something failed to parse - throw it back in the aircraft string
            return [string, "NIL", "NIL"];
        }else{
            console.log(`Failed parsing formatTypeString` + err)
        }
    }
}

function formatAltString(string){
    const transistionAltitudeThousands = 100;
    var alt = 0;
    var fl = string.split('FL')
    alt = (fl[1] == undefined ? fl[0] : fl[1]);
    alt = alt/100; // 33000 -> 330, 1000 -> 10, 340 -> 3.4
    // Altitudes less than 500ft are probably not legal anyway (lets assume no one on VATSIM has LL approval),
    //  more likely they entered their FPL alt in FL. Fix the dumb here. PS: Sorry CONC
    if(alt <= 5){
        alt = alt * 100;
    }
    if (alt == 100){
        return 'A100';
    }else{
        return (alt <= transistionAltitudeThousands ? 'A0'+alt : 'F'+alt);
    };
};

async function updatePilotLabelsLayer () {
    // Update labels layer
    try{
        json = await getPilots();
        map.getSource('aircraftMarkersSource').setData(json);
    }catch(err){
        console.log(err);
    }
}

function setPilotsLayer() {
    if(theme=="dark"){
        var mapLayer = map.getLayer('aircraftLabels');

        if(typeof mapLayer !== 'undefined') {
        // Remove map layer & source.
        map.removeLayer('aircraftLabels');
        }

        map.addLayer({
        'id': 'aircraftLabels',
        'type': 'symbol',
        'source': 'aircraftMarkersSource',
        'minzoom': 4,
        'layout': {
            // 'icon-image': 'custom-marker',
            // 'icon-size': 0.08,
            // 'icon-rotate': [ 'get', 'heading', ['object', ['get', 'pilot']]],
            // 'icon-allow-overlap': declutter,
            // 'icon-ignore-placement': declutter,
            'text-field': ['format', ['get', 'callsign', ['object', ['get', 'pilot']]], { 'text-color': '#FFFFFF'}],
            'text-font': [
                'Open Sans Semibold',
                'Arial Unicode MS Bold'
            ],
            'text-size': 10,
            'text-offset': [1, 1],
            // 'text-anchor': 'bottom',
            'text-variable-anchor': ["top", "bottom", "left"],
            'text-allow-overlap': false,
            'text-ignore-placement': false
        }
        });
    }else{
        var mapLayer = map.getLayer('aircraftLabels');

        if(typeof mapLayer !== 'undefined') {
        // Remove map layer & source.
        map.removeLayer('aircraftLabels');
        }

        map.addLayer({
        'id': 'aircraftLabels',
        'type': 'symbol',
        'source': 'aircraftMarkersSource',
        'minzoom': 4,
        'layout': {
            // 'icon-image': 'custom-marker',
            // 'icon-size': 0.08,
            // 'icon-rotate': [ 'get', 'heading', ['object', ['get', 'pilot']]],
            // 'icon-allow-overlap': declutter,
            // 'icon-ignore-placement': declutter,
            'text-field': ['format', ['get', 'callsign', ['object', ['get', 'pilot']]], { 'text-color': '#000000'}],
            'text-font': [
                'Open Sans Semibold',
                'Arial Unicode MS Bold'
            ],
            'text-size': 10,
            'text-offset': [1, 1],
            // 'text-anchor': 'bottom',
            'text-variable-anchor': ["top", "bottom", "left"],
            'text-allow-overlap': false,
            'text-ignore-placement': false
        }
        });
    };
}

async function setPilotMarkers () {
    let popup;
    var json = await getPilots();
    try{
        // Redraw markers if already set
        if (markers!==null) {
            for (var i = markers.length - 1; i >= 0; i--) {
                markers[i].remove();
            }
        };

        for (const marker of json.features) {

            // Create popup for each Marker
            if(marker.properties.pilot.flight_plan != undefined){
                // Flight plan exists
                var flightRules = (marker.properties.pilot.flight_plan.flight_rules == "I" ? "IFR" : "VFR");
                var [aircraft, wake, equipment ] = formatTypeString(marker.properties.pilot.flight_plan.aircraft);

                popup = new mapboxgl.Popup({ offset: 0 }).setHTML(
                `
                <div id="popup-content">
                <strong>Pilot details</strong><br />
                Callsign: <a href="https://stats.vatsim.net/search/${marker.properties.pilot.callsign}" target="_blank"><strong>${marker.properties.pilot.callsign}</strong></a>
                Pilot: ${marker.properties.pilot.name} (<a href="https://stats.vatsim.net/stats/${marker.properties.pilot.cid}" target="_blank">${marker.properties.pilot.cid}</a>)<br />
                Heading: <strong>${marker.properties.pilot.heading}T</strong> 
                Altitude: <strong>${marker.properties.pilot.altitude}ft</strong> 
                Groundspeed: <strong>${marker.properties.pilot.groundspeed}kts</strong>
                <pre class="flightplan"><code>
                ID(7): ${marker.properties.pilot.callsign} RULES(8a): ${flightRules || 'NIL'} 
                TYPE(9): ${aircraft} WAKE: ${wake} EQPT(10): ${equipment || 'NIL'}
                DEP(13): ${marker.properties.pilot.flight_plan.departure} EOBT: ${marker.properties.pilot.flight_plan.deptime} CRZ TAS (15): ${marker.properties.pilot.flight_plan.cruise_tas} CRZ ALT: ${formatAltString(marker.properties.pilot.flight_plan.altitude)}
                DEST(16): ${marker.properties.pilot.flight_plan.arrival} EET: ${marker.properties.pilot.flight_plan.enroute_time} ALTN: ${(marker.properties.pilot.flight_plan.alternate == undefined || marker.properties.pilot.flight_plan.alternate == "" ? "NIL" : marker.properties.pilot.flight_plan.alternate)}
                RTE: ${formatCodeString(marker.properties.pilot.flight_plan.route, 5)}
                EFOB(19): ${marker.properties.pilot.flight_plan.fuel_time}
                RMK: ${formatCodeString(marker.properties.pilot.flight_plan.remarks, 3)}
                </code></pre>
                </div>
                `
                );
            }else{
                // No flightplan for the pilot.
                popup = new mapboxgl.Popup({ offset: 0 }).setHTML(
                `
                <div id="popup-content">
                <strong>Pilot details</strong><br />
                Callsign: <a href="https://stats.vatsim.net/search/${marker.properties.pilot.callsign}" target="_blank"><strong>${marker.properties.pilot.callsign}</strong></a>
                Pilot: ${marker.properties.pilot.name} (<a href="https://stats.vatsim.net/stats/${marker.properties.pilot.cid}" target="_blank">${marker.properties.pilot.cid}</a>)<br />
                Heading: <strong>${marker.properties.pilot.heading}T</strong> 
                Altitude: <strong>${marker.properties.pilot.altitude}ft</strong> 
                Groundspeed: <strong>${marker.properties.pilot.groundspeed}kts</strong><br />
                <strong>Flight plan not filed.</strong>
                `);
            }

            // Regex callsigns
            // Anything using a VH callsign or three leters get GA
            const re = new RegExp(/^VH-[A-Z]{3}$|^VH[A-Z]{3}$|^[A-Z]{3}$/);
            const gaIcon = re.test(marker.properties.pilot.callsign);
            // Create a DOM element for each marker.
            const el = document.createElement('div');
            el.id = marker.properties.pilot.callsign;
            el.className = 'marker';
            if(gaIcon == true){
                el.style.width = `12px`;
                el.style.height = `12px`;
                if(theme=="dark"){
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/flaticon.com/ga-dark.png)`;
                }else{
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/flaticon.com/ga-light.png)`;
                }
            }else{
                el.style.width = `15px`;
                el.style.height = `15px`;
                if(theme=="dark"){
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/fontawesome/jet-dark.png)`;
                }else{
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/fontawesome/jet-light.png)`;
                }
            }
            el.style.backgroundSize = '100%';
            // const label = document.createTextNode("<code>test</code>");
            // el.appendChild(label);

            // Create new marker
            var icon = new mapboxgl.Marker(el)
                .setLngLat(marker.geometry.coordinates)
                .setPopup(popup)
                // Icon sets are rotated 45
                .setRotation(marker.properties.pilot.heading - 45)
                .addTo(map);
            markers.push(icon);
            // Add popup listeners
            popup.on('open', () => {
                reload = false;
            });
            // TODO - Is this a perf issue? It is called EVERY refresh because markers are deleted.
            popup.on('close', () => {
                reload = true;
            });
        }
    }catch(err){
        console.log(err)
    }
};

map.on('load', function () {
    // Create layer source
    map.addSource('aircraftMarkersSource', {
        'type': 'geojson',
        'attribution': '<a href="https://github.com/Kahn/vatsim-map">vatsim-map</a>',
        'data': null
    });
    setPilotsLayer();
    setAsyncInterval(async () => {
        const promise = new Promise((resolve) => {
            if(reload){
                setPilotMarkers();
                updatePilotLabelsLayer();
            }else{
                console.log('Reload inhibited')
            }
            setTimeout(resolve(), redrawTimeoutMs);
        });
        await promise;
      }, redrawTimeoutMs);
});

