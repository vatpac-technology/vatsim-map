# Maps REST API

The map API extends the VATSIM data API in a short lived cache. There is no persistent data.
Most resources return GeoJSON.

## Types

### Pilot

As per https://data.vatsim.net/v3/vatsim-data.json with the following extensions.

```javascript
  "aerodrome": false,
  "tag_alt": "A043",
  "tag_gs": "0"
```

## Routes

Route `/v1/`

### Aerodromes

Returns all aerodromes from Openstreetmap via the `data.osm.aerodromesArea` value.

Route `/aerodromes/`
Returns
- 200 `[Features]`

#### Major

Returns a filtered list of aerodromes based on the `map.majorAerodromes` config array.

Route  `/major`
Returns
- 200 `[Features]`

### Flights

Route `/flights/`

#### Arivals

Route `/arrivals/<ICAO code>`
Returns
- 200 `[pilots]`
- 404
- 500

#### Callsign

Route `/callsign/<callsign>`
Returns
- 200 `{pilot}`
- 404
- 500

#### Departures

Route `/departures/<ICAO code>`
Returns
- 200 `[pilot]`
- 404
- 500

### Pilots

Route `/pilots`
Returns
- 200 `FeatureCollection [pilots]`