# Maps REST API

The map API extends the VATSIM data API in a short lived cache. There is no persistent data.

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

### Flights

Route `/flights/`

#### Arivals

Route `/arrivals/<ICAO code>`
Returns
- 200 `[pilot]`
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
