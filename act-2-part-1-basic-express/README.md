# Express - Part 1

## Basic Express

Express is a lightweight web framework for node.  With a few lines of code, it will deliver a fully functional evented web server.  The steps in the following example will result in a folder with three files you create (app.js, package.json, and README.md) and a 'node_modules' folder that npm will create to contain dependencies.

1. Make a folder to contain your new application
2. 'cd' into that folder
3. Get the latest version number for express:

		$ npm info express version
4. Create the file /package.json:  
_Note: the version listed for 'express' can also be "*" to get the latest_
	
		{
		  "name": "Express Basic Tutorial",
		  "description": "I'm learning nodejs express!",
		  "version": "0.0.1",
		  "private": true,
		  "dependencies": {
		    "express": "4.4.0" 
		  }
		}
5. Create the file /README.md  
_Note: npm and node will throw warnings if this file does not exist with **some** content_
6. Install dependencies  
_Note: this will install dependencies from **package.json**_

		$ npm install
7. Create the file /app.js:  
_Note: you can use any port. be sure it is available! You can also declare any endpoint other than /, i.e. /hello_

		var express = require('express');
		var app = express();

		app.get('/', function(req,res){
			res.send("hi there");
		});

		var server = app.listen(4000, function(){
			console.log("Listening on 4000");
		});
8. Start your application:  
_Note: a common error is a port conflict - some other process is already listening on the port, and you will see **Error: listen EADDRINUSE**. The express generator will create an application which defaults to port 3000, but you can change this in _/bin/www_. 

		$ node app.js
		
9. Visit your new app:

		http://localhost:4000/

### What's Going On

In your main file, _app.js_, there are three objects you want to be familiar with.

#### The express module
This is the node module which provides all of the functionality of the express web framework.  Generally, you will 'require' this once, which will return an instance of the module.
#### The express application
The application object itself is obtained by calling _express()_.  The application object is used directly to define endpoints, define what happens when requests arrive to the web server, and actually start the web server.  Essentially, this is the definition and execution of your application.
#### The server object
The server object is returned when the server is started with _listen()_.  The server object can be used to incorporate Socket.IO with an express application, as we will see in the next tutorial.
