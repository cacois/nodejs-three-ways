/**
 * worker.js
 *
 * Note: this code is hevaily influenced by code published by Joshua Cohen at Flikr - http://code.flickr.net/2012/12/12/highly-available-real-time-notifications/
 */

// Require statements - include necessary Node.js modules
var redis = require("redis"),
    mailer = require('nodemailer');

// read in the config file as a JavaScript object
var config = require("./config.js")

// Set up Redis client connections
// we need a regular client to write to Redis...
var client = redis.createClient(config.port, config.host);
// ...and a pubsub client to subscribe to a channel
var pubsubClient = redis.createClient(config.port, config.host);

// subscribe to the 'notifications' channel and define a method to be called when a message is detected
pubsubClient.subscribe("notifications");
pubsubClient.on("message", handleMessage);

//==== Methods ====//

/**
 * Callback function to handle an incoming message received from Redis notifications channel
 */
function handleMessage(channel, message) {
    console.log('Handling message!')

    var payload = JSON.parse(message);

    acquireLock(payload, 1, lockCallback);
}

function acquireLock(payload, attempt, callback) {
    // create a lock id string
    var lockIdentifier = "lock." + payload.identifier;

    function dataForCallback(acquired) {
        return {
            "acquired" : acquired,
            "lockIdentifier" : lockIdentifier,
            "payload" : payload
        };
    }

    client.setnx(lockIdentifier, "My Name", function(error, success) {
        if (error) {
            logger.error("Error trying to acquire redis lock for: %s", lockIdentifier);
            return callback(error, dataForCallback(false));
        }

        return callback(null, dataForCallback(success));
    });
}

function lockCallback(data) {
    if(data.acquired == true) {
        console.log("I got the lock!");

        // send email notification
        console.log("Sending email...");
        sendMessage(data);
    }
    else console.log("No lock for me :(");
}

function sendMessage(payload) {
    console.log("Sending mail...");
    var smtpTransport = mailer.createTransport("SMTP",{
        service: "Gmail",
        auth: {
            user: "<Google username>",
            pass: "<your Google application-specific password>"
        }
    });

    var mailOptions = {
        from: "<email>", // sender address
        to: "<email>", // list of receivers
        subject: "Notification from Node.js", // Subject line
        text: "You are hereby notified!", // plaintext body
        html: "<b>You are hereby notified!</b>" // html body
    };

    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error) console.log("Error sending mail: " + error);
        else console.log("Message sent: " + response.message);

        smtpTransport.close(); // shut down the connection pool, no more messages
    });
}
