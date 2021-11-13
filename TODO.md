## TODO

* Map the on the ground users.
* Make major AD's permanently shown.
* Join AFV freqs with sectors to show online.
* Fix the on the ground altitude maths
* Make light theme AD parts darker
* Markers and labels are too small on the ground.
* Query OSM via Overpass API for aeroway=parking_position
// Get aerodrome polygon
// if aeroway=parking_position not undefined
// bay = aeroway=parking_position ref
Nah - Use https://overpass-turbo.eu/# to pull the features geojson into a mapbox tileset for a quick and dirty option.
Expand client.js to enrich pilots API

// Boarding - On aerodrome, on apron poly. 0 GS
// Departing - On aerodrome
// Enroute - Off aerodrome
// Arriving - On aerodrome
// Arrived - On aerodrome, on apron poly. 0 GS


Ideas

Airspace map - sector map for Zach.
https://vatpac.org/controllers/airspace/

Add CID search to local

### Feedback

* Add FL and GS to labels aka datatag to labels

* Instrument API response times and request times from VATSIM to track down loading delays

* Show ATC polys and state from controllers API
** Add a turf function for centerOfMass to get ATC sector labels


## Future

### OSM mapping

Aerodromes missing aeroway=parking_positions:

Major
* YPDN - Done
* YBCS
* YPAD
* YPPH

Metro
* YBAF
* YSBK
* YMAV
* YPPF

### Features

* Theme switch light / dark
** Turn off POI labels at high zoom

* Markers clickable
* Modal or inline window
* Geocoder search for marker names


* Add airport markers and counters for arr/deps
* Add ATC markers for tower, gnd, dep
* Use AFV to get extended sectors
* Switch icons between prop and jet based on callsign or type.
  Filter aircraft_type by types from https://vatstats.net/
* Use nav API for progressive taxi or draw on ground map routes
* Use GS and HDG to animate markers between refresh

Query tilesets to get "in poly" for ATC on aerodromes.https://docs.mapbox.com/help/tutorials/find-elevations-with-tilequery-api/
https://docs.mapbox.com/mapbox-gl-js/api/map/#map#querysourcefeatures
https://docs.mapbox.com/mapbox-gl-js/example/filter-features-within-map-view/
https://docs.mapbox.com/mapbox-gl-js/example/query-similar-features/

Stretch goal enrich the pilot locations API for aerodrome reporting board with where the acft is
WAT499 YSSY YMML Boarding gate 54
WAT499 YSSY YMML Taxiing on C GS 15
WAT499 YSSY YMML Departed

* Use mapbox 3D elements for dynamic ATC poly visualizations https://blog.mapbox.com/dive-into-large-datasets-with-3d-shapes-in-mapbox-gl-c89023ef291


### Tech debt

* What is going wrong with test imports?
* Retest the xmlToPoly client with a single Line XML file
* Retest text and icon scaling on low res PC, mobile
* Add GS in hundreds via API for display
* Expose alt format via API for display
* Add instrumentation to capture iteration cost https://dev.to/typescripttv/measure-execution-times-in-browsers-node-js-js-ts-1kik
* Implement URL discovery via https://status.vatsim.net/status.json for https://github.com/vatsimnetwork/developer-info/wiki/Data-Feeds

### Feedback

Possible to see C steps. Import LL labels markers.
TMA splits

### Current stats
In FIR now
Top types
Arr / dep counts

### Stored stats
Is using a DB going to be worth it? Start tracking what needs it. Eg ENR time and track. Persist objects in memory for a few hours?
Traffic heatmap (DB needed)

## Credits
CC BY-SA 3.0
https://commons.wikimedia.org/wiki/File:Plane_font_awesome.svg 

public/flaticon.com/ga-*.png
<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>

Openstreet map data
The data included in this document is from www.openstreetmap.org. The data is made available under ODbL

## Theme

Green 33cc99 A10
Blue B0D1FC A10

## References

Flight path fill with hdg and speed? Ala FR24
https://docs.mapbox.com/mapbox-gl-js/example/animate-marker/

Local search
https://docs.mapbox.com/mapbox-gl-js/example/forward-geocode-custom-data/

Progressive taxi? / taxi markup for pilot assist
https://docs.mapbox.com/mapbox-gl-js/example/measure/

https://docs.mapbox.com/mapbox-gl-js/example/set-popup/

Change markers on zoom level. Would require iterating markers
https://docs.mapbox.com/mapbox-gl-js/example/updating-choropleth/

Sectors.xml
Meta -> Volumes
Sector -> Volumes(VolumeName)

Volumes.xml
Meta -> Line
Volume(Name) -> Boundaries(Name)
Volume(ARA) -> Boundaries(ARAFURA)