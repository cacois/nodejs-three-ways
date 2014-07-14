/**
 * worker.js
 *
 * Note: this code is heavily influenced by code published by Joshua Cohen at Flikr - http://code.flickr.net/2012/12/12/highly-available-real-time-notifications/
 */

// import the redis module
var redis = require("redis");

// create a redis client object
var pubSubClient = redis.createClient('6379', 'localhost');

// subscribe to 'notifications' collection
pubSubClient.subscribe("notifications");

// define message handler
pubSubClient.on("message", function(channel, message) {
  console.log('Received a message: ' + message);
});
