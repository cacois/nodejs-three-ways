/**
 * worker.js
 *
 * Note: this code is heavily influenced by code published by Joshua Cohen at Flikr - http://code.flickr.net/2012/12/12/highly-available-real-time-notifications/
 */

// import the redis module
var redis = require("redis");

// read in the config file as a JavaScript object
var config = require("./config.js");

// create a redis client object
var pubSubClient = redis.createClient(config.port, config.host);
var client = redis.createClient(config.port, config.host);

// subscribe to 'notifications' collection
pubSubClient.subscribe("notifications");

// define message handler
pubSubClient.on("message", handleMessage);

function handleMessage(channel, message) {
    console.log('Received a message: ' + message);

    var payload = JSON.parse(message);

    acquireLock(payload, lockCallback);
}

function acquireLock(payload, callback) {
    // create a lock id string
    var lockIdentifier = "lock." + payload.identifier;

    console.log("Trying to obtain lock: %s", lockIdentifier);

    client.setnx(lockIdentifier, "Worker Name", function(error, success) {
        if (error) {
            console.log("Error acquiring lock for: %s", lockIdentifier);
            return callback(error, dataForCallback(false));
        }

        var data = {
            "acquired" : success,
            "lockIdentifier" : lockIdentifier,
            "payload" : payload
        };
        return callback(data);
    });
}

function lockCallback(data) {
    if(data.acquired == true) {
        console.log("I got the lock!");

        // send notification!
        // TODO: actually notify
        console.log('I win! Sending notification: %s',
                     JSON.stringify(data));
    }
    else console.log("No lock for me :(");
}
