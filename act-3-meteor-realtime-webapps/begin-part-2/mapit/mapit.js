Markers = new Meteor.Collection('markers');

if (Meteor.isClient) {
    Meteor.subscribe("markers");

    Template.markerlist.markers = function() {
        return Markers.find({});
    };
}

if (Meteor.isServer) {
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
}
