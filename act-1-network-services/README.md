# Getting Started

> npm install

to install all necessary modules automaticallly from package.json, or manually install them:

> npm install redis



# Testing

To test this service, you have to start the service:

> node worker.js

and then publish a notification to the specified channel in your Redis instance. You can do this from the redis-cli shell with the following command:

redis-cli> publish notifications '{"identifier": 1, "message": "Hi!"}'
