// jshint esversion:6
// TODO - Sort out why webpack is failing
// import { lightDetailedLayout, lightPaint, lightLayout, darkDetailedLayout, darkPaint, darkLayout } from "./map-styles";

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

// Color palette
// Used on light background
const darkTextTheme = {
    primaryText: '#000',
    secondaryText: '#939393',
    textHalo: '#FFF'
}
// Used on dark background
const lightTextTheme = {
    primaryText: '#FFF',
    secondaryText: '#c9c9c9',
    textHalo: '#000'
}

const lightPaint = {
    'text-color': lightTextTheme.primaryText,
    'text-halo-color': lightTextTheme.textHalo,
    'text-halo-width': 3
}

const darkPaint = {
    'text-color': darkTextTheme.primaryText,
    'text-halo-color': darkTextTheme.textHalo,
    'text-halo-width': 3
}

const lightLayout = {
    'text-field': ['format',
        ['get', 'callsign', ['object', ['get', 'pilot']]], { 'text-color': lightTextTheme.primaryText }
    ],
    'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
    ],
    'text-size': 12,
    'text-offset': [1, 0],
    'text-anchor': 'left',
    'text-allow-overlap': false,
    'text-ignore-placement': false
}

const lightDetailedLayout = {
    'text-field': ['format',
        ['get', 'callsign', ['object', ['get', 'pilot']]], { 'text-color': lightTextTheme.primaryText },
        "\n", {},
        ['get', 'tag_alt', ['object', ['get', 'pilot']]], { 'text-color': lightTextTheme.secondaryText },
        " ", {},
        ['get', 'tag_gs', ['object', ['get', 'pilot']]], { 'text-color': lightTextTheme.secondaryText }
    ],
    'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
    ],
    'text-size': 12,
    'text-offset': [1, 0],
    'text-anchor': 'left',
    'text-allow-overlap': false,
    'text-ignore-placement': false
}

const darkLayout = {
    'text-field': ['format',
        ['get', 'callsign', ['object', ['get', 'pilot']]], { 'text-color': darkTextTheme.primaryText }
    ],
    'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
    ],
    'text-size': 12,
    'text-offset': [1, 0],
    'text-anchor': 'left',
    'text-allow-overlap': false,
    'text-ignore-placement': false
}

const darkDetailedLayout = {
    'text-field': ['format',
        ['get', 'callsign', ['object', ['get', 'pilot']]], { 'text-color': darkTextTheme.primaryText },
        "\n", {},
        ['get', 'tag_alt', ['object', ['get', 'pilot']]], { 'text-color': darkTextTheme.secondaryText },
        " ", {},
        ['get', 'tag_gs', ['object', ['get', 'pilot']]], { 'text-color': darkTextTheme.secondaryText }
    ],
    'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
    ],
    'text-size': 12,
    'text-offset': [1, 0],
    'text-anchor': 'left',
    'text-allow-overlap': false,
    'text-ignore-placement': false
}

const atcLightDetailedLayout = {
    'text-field': ['format',
        ['get', 'Callsign'], { 'text-color': lightTextTheme.primaryText },
        "\n", {},
        ['get', 'Frequency'], { 'text-color': lightTextTheme.secondaryText }
        // " ", {},
        // ['get', 'callsign'], { 'text-color': lightTextTheme.secondaryText }
    ],
    'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
    ],
    'text-size': 12,
    'text-offset': [1, 0],
    'text-anchor': 'left',
    'text-allow-overlap': false,
    'text-ignore-placement': false
}

const atcDarkDetailedLayout = {
    'text-field': ['format',
        ['get', 'Callsign'], { 'text-color': darkTextTheme.primaryText },
        "\n", {},
        ['get', 'Frequency'], { 'text-color': darkTextTheme.secondaryText }
        // " ", {},
        // ['get', 'callsign'], { 'text-color': lightTextTheme.secondaryText }
    ],
    'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
    ],
    'text-size': 12,
    'text-offset': [1, 0],
    'text-anchor': 'left',
    'text-allow-overlap': false,
    'text-ignore-placement': false
}

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

mapboxgl.accessToken = 'pk.eyJ1IjoiY3ljbG9wdGl2aXR5IiwiYSI6ImNqcDY0NnZnYzBmYjYzd284dzZudmdvZmUifQ.RyR4jd1HRggrbeZRvkv0xg';
var markers = [];
var reload = true;
var redrawTimeoutMs = 5000;
var pilots = false;

const styleLight = 'mapbox://styles/cycloptivity/ckrai7rg601cw18p5zu4ntq27';
const styleDark = 'mapbox://styles/cycloptivity/ckrsmmn0623yb17pew9y59lao';

var map = new mapboxgl.Map({
    container: 'map', // container ID
    style: styleLight, // style URL
    center: [134.9, -28.2 ],
    zoom: 3.8,
    attributionControl: false,
    projection: 'globe'
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Light / Dark switch
var theme = findGetParameter('theme') || 'light';
if (theme == 'dark') {
    map.setStyle(styleDark);
}

async function getDataset() {
    var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/dataset`);
    var json = await response.json();
    dataset = json;
    return json;
};

async function getPilots() {
    var dataApi = findGetParameter('dataApi');
    if (dataApi != false) {
        var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/${dataApi}`);
    } else {
        var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/pilots`);
    }
    var json = await response.json();
    pilots = json;
    return json;
};

async function getMajorAerodromes() {
    var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/aerodromes`);
    var json = await response.json();
    return json;
};

//options.localGeocoder Function? A function accepting the query string which performs local geocoding to supplement results from the Mapbox Geocoding API. Expected to return an Array of GeoJSON Features in the Carmen GeoJSON format.
function forwardGeocoder(query) {
    const matchingFeatures = [];
    for (const feature of pilots.features) {
        // Search by callsign
        if (
            feature.properties.pilot.callsign
                .toLowerCase()
                .includes(query.toLowerCase())
        ) {
            feature['place_name'] = `${feature.properties.pilot.callsign}`;
            feature['center'] = feature.geometry.coordinates;
            matchingFeatures.push(feature);
        }
        // Search by pilot
        if (
            feature.properties.pilot.name
                .toLowerCase()
                .includes(query.toLowerCase())
        ) {
            feature['place_name'] = `${feature.properties.pilot.name}`;
            feature['center'] = feature.geometry.coordinates;
            matchingFeatures.push(feature);
        }
    }
    return matchingFeatures;
}

// Add the search control to the map.
if (findGetParameter('search') == 'false') {
    //No Search Displayed - search=off removes search
} else {
    map.addControl(
        new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            localGeocoder: forwardGeocoder,
            localGeocoderOnly: true,
            marker: false,
            placeholder: 'Find aircraft'
        })
    );
}

var mobile = findGetParameter('mobile') || false;
if (mobile) {
    map.scrollZoom.disable();
    //map.addControl(new mapboxgl.NavigationControl());
}


async function getATCSectors() {
    try {
        var response = await fetch(`${window.location.protocol}//${window.location.hostname}:${window.location.port}/v1/atc/online`);
        var json = await response.json();
        var ctrs = [];
        var tmas = [];
        var twrs = [];

        // Split CTR, TMA, and TWRs
        json.features.forEach(function (e) {
            console.log(e.properties.Callsign)
            if (e.properties.Callsign.includes("CTR")) {
                console.log(e)
                ctrs.push(e);
            }
            if (e.properties.Callsign.includes("APP")) {
                console.log(e)
                tmas.push(e);
            }
            if (e.properties.Callsign.includes("TWR")) {
                twrs.push(e);
            }
        });

        map.addSource('atcCtrs', {
            'type': 'geojson',
            'data': turf.featureCollection(ctrs)
        });
        map.addSource('atcTmas', {
            'type': 'geojson',
            'data': turf.featureCollection(tmas)
        });
        map.addSource('atcTwrs', {
            'type': 'geojson',
            'data': turf.featureCollection(twrs)
        });

        // Add a black outline around the polygon.
        map.addLayer({
            'id': 'atcOutline',
            'type': 'line',
            'source': 'atcCtrs',
            'layout': {},
            'paint': {
                'line-color': '#3b8df9',
                'line-width': 2
            }
        });
        map.addLayer({
            'id': 'tmaLine',
            'type': 'line',
            'source': 'atcTmas',
            'layout': {},
            'minzoom': 3,
            'paint': {
                'line-color': "#33cc99",
                'line-width': 3,
                'line-dasharray': [1, 1]
            }
        });
        map.addLayer({
            'id': 'tmaFill',
            'type': 'fill',
            'source': 'atcTmas',
            'layout': {},
            'minzoom': 3,
            'paint': {
                'fill-color': '#33cc99',
                'fill-opacity': 0.2
            }
        });
        map.addLayer({
            'id': 'twrLine',
            'type': 'line',
            'source': 'atcTwrs',
            'layout': {},
            'minzoom': 3,
            'paint': {
                'line-color': "#5D3FD3",
                'line-width': 3,
                'line-dasharray': [1, 1]
            }
        });
        map.addLayer({
            'id': 'twrFill',
            'type': 'fill',
            'source': 'atcTwrs',
            'layout': {},
            'minzoom': 3,
            'paint': {
                'fill-color': '#5D3FD3',
                'fill-opacity': 0.2
            }
        });
        // // Add sector labels
        var atcLabelPoints = [];
        json.features.forEach(function (e) {
            // console.log(e)
            atcLabelPoints.push(turf.centroid(e));
        });
        console.log(atcLabelPoints);
        map.addSource('atcLabelPoints', {
            'type': 'geojson',
            'data': json
        });
        if (theme == "dark") {
            var mapLayer = map.getLayer('atcPoints');

            if (typeof mapLayer !== 'undefined') {
                // Remove map layer & source.
                map.removeLayer('atcPoints');
            }
            map.addLayer({
                'id': 'atcPoints',
                'type': 'symbol',
                'source': 'atcLabelPoints',
                'minzoom': 5,
                'layout': atcLightDetailedLayout,
                'paint': lightPaint
            });
        } else {
            var mapLayer = map.getLayer('atcPoints');

            if (typeof mapLayer !== 'undefined') {
                // Remove map layer & source.
                map.removeLayer('atcPoints');
            }
            map.addLayer({
                'id': 'atcPoints',
                'type': 'symbol',
                'source': 'atcLabelPoints',
                'minzoom': 5,
                'layout': atcDarkDetailedLayout,
                'paint': darkPaint
            });
        };
    } catch (err) {
        // throw Error(err);
    }
};

function formatCodeString(string, length) {
    const re = (/(\w+\/\w+)|(\w+)/g)
    var resString = '';
    try {
        var matches = [...string.matchAll(re)];
        const lineLen = length;
        var count = 1;
        for (const match of matches) {
            if (count < lineLen) {
                if (resString == "") {
                    resString = match[0];
                    count++;
                } else {
                    resString = resString + ' ' + match[0];
                    count++;
                }
            } else {
                resString = resString + ' ' + match[0] + '\n    ';
                count = 0;
            }
        }
        resString.replace(/\n+$/, "");
        return resString;
    } catch (err) {
        console.log(err)
    };
}

function formatTypeString(string) {
    try {
        var slash = string.split('/');
        var hyphen = slash[1].split('-')

        if (hyphen[1] == undefined) {
            // FAA types
            var wake = "NIL";
        } else {
            // Parse ICAO formats
            var wake = (hyphen[0] == "J" || hyphen[0] == "H" || hyphen[0] == "M" || hyphen[0] == "L" ? hyphen[0] : "NIL");
            var equipment = (hyphen[1] == undefined ? "NIL" : hyphen[1]);
        }
        return [slash[0], wake, equipment];
    } catch (err) {
        if (err instanceof TypeError) {
            // Something failed to parse - throw it back in the aircraft string
            return [string, "NIL", "NIL"];
        } else {
            console.log(`Failed parsing formatTypeString` + err)
        }
    }
}

function formatAltString(string) {
    const transistionAltitudeThousands = 100;
    var alt = 0;
    var fl = string.split('FL')
    alt = (fl[1] == undefined ? fl[0] : fl[1]);
    alt = alt / 100; // 33000 -> 330, 1000 -> 10, 340 -> 3.4
    // Altitudes less than 500ft are probably not legal anyway (lets assume no one on VATSIM has LL approval),
    //  more likely they entered their FPL alt in FL. Fix the dumb here. PS: Sorry CONC
    if (alt <= 5) {
        alt = alt * 100;
    }
    if (alt == 100) {
        return 'A100';
    } else {
        return (alt <= transistionAltitudeThousands ? 'A0' + alt : 'F' + alt);
    };
};

async function updatePilotsLayer() {
    // Update labels layer
    try {
        map.getSource('aircraftMarkersSource').setData(pilots);
    } catch (err) {
        console.log(err);
    }
}

function setPilotsLayer() {
    if (theme == "dark") {
        var mapLayer = map.getLayer('aircraftLabels');

        if (typeof mapLayer !== 'undefined') {
            // Remove map layer & source.
            map.removeLayer('aircraftLabels');
        }

        map.addLayer({
            'id': 'aircraftLabels',
            'type': 'symbol',
            'source': 'aircraftMarkersSource',
            'minzoom': 5,
            'layout': lightDetailedLayout,
            'paint': lightPaint
        });
    } else {
        var mapLayer = map.getLayer('aircraftLabels');

        if (typeof mapLayer !== 'undefined') {
            // Remove map layer & source.
            map.removeLayer('aircraftLabels');
        }
        // Callsign only
        map.addLayer({
            'id': 'aircraftLabels',
            'type': 'symbol',
            'source': 'aircraftMarkersSource',
            'minzoom': 5,
            'layout': darkDetailedLayout,
            'paint': darkPaint
        });
    };
}

async function setPilotMarkers() {
    let popup;
    try {
        // Redraw markers if already set
        if (markers !== null) {
            for (var i = markers.length - 1; i >= 0; i--) {
                markers[i].remove();
            }
        };

        for (const marker of pilots.features) {

            // Create popup for each Marker
            if (marker.properties.pilot.flight_plan != undefined) {
                // Flight plan exists
                var flightRules = (marker.properties.pilot.flight_plan.flight_rules == "I" ? "IFR" : "VFR");
                var [aircraft, wake, equipment] = formatTypeString(marker.properties.pilot.flight_plan.aircraft);

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
            } else {
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
            if (gaIcon == true) {
                el.style.width = `12px`;
                el.style.height = `12px`;
                if (theme == "dark") {
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/flaticon.com/freepik/ga-dark.png)`;
                } else {
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/flaticon.com/freepik/ga-light.png)`;
                }
            } else {
                el.style.width = `15px`;
                el.style.height = `15px`;
                if (theme == "dark") {
                    el.style.backgroundImage = `url(${window.location.protocol}//${window.location.hostname}:${window.location.port}/static/fontawesome/jet-dark.png)`;
                } else {
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
    } catch (err) {
        console.log(err)
    }
};

getPilots();

(async () => {
    var dataset = await getDataset();
    console.log(dataset);
    map.addControl(new mapboxgl.AttributionControl({
        customAttribution: `vatSys ${dataset.Profile._attributes.Name} dataset <strong>AIRAC ${dataset.Profile.Version._attributes.AIRAC}${dataset.Profile.Version._attributes.Revision}</strong> | <a href="https://github.com/Kahn/vatsim-map">vatsim-map</a>`
    }))
})();

map.on('load', function () {
    map.addSource('aircraftMarkersSource', {
        'type': 'geojson',
        'data': null
    });

    
    map.jumpTo({
        center: [findGetParameter('lon') || 134.9, findGetParameter('lat') || -28.2],
        zoom: findGetParameter('zoom') || 4,
    })

    setPilotsLayer();
    setPilotMarkers();

    // Main loop
    setAsyncInterval(async () => {
        const promise = new Promise((resolve) => {
            if (reload) {
                getATCSectors();
                getPilots();
                setPilotMarkers();
                updatePilotsLayer();
            } else {
                console.log('Reload inhibited')
            }
            setTimeout(resolve(), redrawTimeoutMs);
        });
        await promise;
    }, redrawTimeoutMs);
});

map.on('style.load', () => {
    map.setFog({
        color: 'rgb(186, 210, 235)', // Lower atmosphere
        'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
        'horizon-blend': 0.02, // Atmosphere thickness (default 0.2 at low zooms)
        'space-color': 'rgb(11, 11, 25)', // Background color
        'star-intensity': 0.35 // Background star brightness (default 0.35 at low zoooms )
    });
});

