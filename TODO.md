## TODO

* Show ATC polys and state from controllers API
** Add a turf function for centerOfMass to get ATC sector labels


## Future

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

### Tech debt

* Retest the xmlToPoly client with a single Line XML file
* Fail gracefully on vatsys dataset cache expiry

### Current stats
In FIR now
Top types
Arr / dep counts

### Stored stats
Traffic heatmap (DB needed)

## Credits
CC BY-SA 3.0
https://commons.wikimedia.org/wiki/File:Plane_font_awesome.svg 

public/flaticon.com/ga-*.png
<div>Icons made by <a href="https://www.freepik.com" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/" title="Flaticon">www.flaticon.com</a></div>

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