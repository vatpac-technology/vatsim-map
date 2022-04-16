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
Returns `[pilot]`

#### Callsign

Route `/callsign/<callsign>`
Returns `{pilot}`

#### Departures

Route `/departures/<ICAO code>`
Returns `[pilot]`
