Markers = new Meteor.Collection('markers');

if (Meteor.isClient) {
  Meteor.subscribe("markers");

  // note that this client side map template is accessed
  // in the client html using {{> map}}

  // Register some events
  /*Template.map.events({
    'click .map': function(e) {
        // We're storing the marker coordinates in an extensibel JSON
        // data structure, to leave room to add more info later
        Session.set("test", e);
        //console.log("inserting marker: " + JSON.stringify(e));
        //Markers.insert({"coords": e.latlng});
    }
});*/

  Template.userlist.users = function() {
    return Meteor.users.find({});
  };

  Template.markerlist.markers = function() {
    return Markers.find({});
  };

  Template.map.rendered = function() {
    L.Icon.Default.imagePath = 'packages/leaflet/images';

    // initialize Leaflet map object
    window.map = L.map('map', {
      doubleClickZoom: false
    }).setView([45.52854352208366,-122.66302943229674], 13);

    // assign click event to add markers
    window.map.on('click', function(event, object) {
        // We're storing the marker coordinates in an extensibel JSON
        // data structure, to leave room to add more info later
        console.log("inserting marker: " + event.latlng);
        Markers.insert({"coords": [event.latlng.lat,event.latlng.lng]});
    });

    // Set tile provider
    L.tileLayer.provider('Thunderforest.Outdoors').addTo(map);

    // get a cursor for the Markers collection
    var markers = Markers.find();
    console.log('# Markers: ' + markers.count());

    // Watch the Markers collection for changes. Specifically, markers added or removed
    markers.observe({
        // When a new marker is added to the Markers collection, add it to the map
        added: function(marker) {
            L.marker(marker.coords).addTo(map);
        },
        // When a marker is removed, remove it from the map
        removed: function(marker) {}
    });

  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    if(Markers.find().count() == 0) {
      console.log("No markers found in collection - inserting one");
      Markers.insert({"coords": [49.25044, -123.137]});
    }

    // publish markers collection to clients
    Meteor.publish("markers", function () {
      return Markers.find();
    });

  });
}
