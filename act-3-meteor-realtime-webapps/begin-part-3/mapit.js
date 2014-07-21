Markers = new Meteor.Collection('markers');

if (Meteor.isClient) {
    Meteor.subscribe("markers");

    Template.markerlist.markers = function() {
        return Markers.find({});
    };

    Template.map.rendered = function() {
        L.Icon.Default.imagePath = 'packages/leaflet/images';

        // initialize Leaflet map object
        window.map = L.map('map', {
          doubleClickZoom: false,
          zoomControl:false
        }).setView([45.52854352208366,-122.66302943229674], 13);

        // assign click event to add markers
        window.map.on('dblclick', function(event, object) {
            // We're storing the marker coordinates in an extensibel JSON
            // data structure, to leave room to add more info later
            console.log("inserting marker: " + event.latlng);
            Markers.insert({"coords": [event.latlng.lat,event.latlng.lng]});
        });

        L.tileLayer.provider('Thunderforest.Outdoors').addTo(map);

        var markers = Markers.find(); // db cursor Markers

        // Watch the Markers collection for 'add' action
        markers.observe({
            // When a new marker is added collection, add it to the map
            added: function(marker) {
                L.marker(marker.coords).addTo(map);
            }
        });
    }
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // Insert a marker if none exist
        if(Markers.find().count() == 0) {
            console.log("No markers found in collection - inserting one");
            Markers.insert({"coords": [49.25044, -123.137]});
        }

        // publish collection to client
        Meteor.publish("markers", function () {
            // you can specify constraints in find() query, if desired
            return Markers.find();
        });
    });
}
