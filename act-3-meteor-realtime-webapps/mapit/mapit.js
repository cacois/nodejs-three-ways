if (Meteor.isClient) {

  Template.map.rendered = function() {
    L.Icon.Default.imagePath = 'packages/leaflet/images';

    var map = L.map('map', {
      doubleClickZoom: false
    }).setView([49.25044, -123.137], 13);

    L.tileLayer.provider('Thunderforest.Outdoors').addTo(map);
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Markers = new Meteor.Collection('markers');

    Meteor.publish("markers", function () {
      return Markers.find();
    });
    
  });
}
