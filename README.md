## VATSIM Map

Experimenting with the new VATSIM API to provide a generic FIR map for VATCCs.

### Status

Extremely under cooked ...

## Usage

### Pilot map

The pilot map loads the VATSIM data feed, filters for pilots in the `map.firs`, then finally renders pilot positions on a map. 

URL: `/static/map.html`

Accepts the following GET parameters.

|Key|Type|Default|Description|
|---|----|---|---|
|theme|String (`light` \| `dark`)|light|Sets the map theme.|
|lon|Float|134.9|Sets the map center longitutde.|
|lat|Float|-28.2|Sets the map center latitude.|
|zoom|Float|3|Sets the map center zoom.|
|dataApi|String||Developement - Load data from an alternative pilots API resource.|

### Sector map

The sector map loads a vatSys dataset defined by `data.vatsys`, parses the sectors and displays an overlay for `map.sectors.standard` as well as sub-sectors at a lower level zoom.

URL: `/static/sectormap.html`

Accepts the following GET parameters.

|Key|Type|Default|Description|
|---|----|---|---|
|lon|Float|134.9|Sets the map center longitutde.|
|lat|Float|-28.2|Sets the map center latitude.|
|zoom|Float|4.3|Sets the map center zoom.|