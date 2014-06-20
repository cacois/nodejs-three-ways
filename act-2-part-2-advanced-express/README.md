# Express - Part 2

## Express Generator

Express applications can be generated.  Generation provides some advantages, namely creating a more formal file structure, placeholders for static assets such as JavaScript and CSS, and boilerplate code.

1. Install the generator

		$ npm install -g express-generator
		
2. Create your app

		$ express -e ejs myapp
		
4. 'cd' into your new app folder (the name you provided to the express generator)
5. Create the file /README.md.  The generator does **not** take care of this for you.  
_Note: npm and node will throw warnings if this file does not exist with **some** content_
5. Install the dependencies:

		$ npm install

6. Start your application:  
_Note: a common error is a port conflict - some other process is already listening on the port, and you will see **Error: listen EADDRINUSE**. The express generator will create an application which defaults to port 3000, but you can change this in _/bin/www_.  

		$ npm start
7. Visit your new app:

		http://localhost:3000		

### What's Going On

The single call to create your application resulted in _app.js_ and _package.json_ files we recognize from the basic tutorial.  We also have the folders _bin_, _public_, _routes_, and _views_. 

#### _package.json_ contains several additional dependencies, some of which are:
	
**morgan** - an HTTP request logger  
**cookie-parser** and **body-parser** - parsers to help work with HTTP requests  
**ejs** - a JavaScript templating engine  

#### code in _app.js_ adds much more functionality to the application object, including parsers, routes, logging and error handling
		
#### _/bin/www_ is a new file that encapsulates the starting of the application web server
	
#### _/public_ contains placeholder folders for static content

#### _/routes_ contains modules that handle and respond to HTTP requests

Note that _/routes_ modules define endpoints on the express _Router_ module, and are required in _app.js_ and associated with endpoints. This is as opposed to endpoints simply being defined on the application object itself with _app.get()_.
	
#### _/views_ contain HTML EJS templates

Files in _/views_ contain the actual document content that will be parsed and formatted by the express web framework using the ejs module dependency listed in _package.json_.  These templates are wired to the route endpoints by a naming convention: the first argument to the route _render()_ call will find the .ejs file of the same name.  The folder containing the templates to look for is registered with _app.set('views', .._ in _app.js_.

## Developing the Web Application

**_Note: MongoDB will need to be installed on your machine for this example._**

In everyday web application development, we need to issue database calls, adhere to models, display dynamic data, and create new pages.  This part of the tutorial will showcase these tasks in the context of express.

To exemplify writing and reading data from a database, we'll use MongoDB and the node module _mongoose_, which will serve as an ORM to work with models and our Mongo database. Note that MySQL and PostgreSQL are also supported in node, and no ORM is needed to work with a database. i.e. We could simply connect to any node-supported database and issue standard _insert_ and _select_ calls, but mongoose will allow us to show how models can be used to work directly with data in a structured way.

### Mongoose dependency

First, let's set up our new dependency in package.json:

	    ...
 	   	"debug": "~0.7.4",
    	"ejs": "~0.8.5",
	    "mongoose": "3.8.12"
      }	
	}

and install it:

	$ npm install
	
### Create a new page

We'll create a new page to show a log of visits to the site.  Let's show this at _/visits_.

First, the route at _/routes/visits.js_:

	var express = require('express');
	var router = express.Router();

	router.get('/', function(req, res) {
	  res.render('visits', { });
	});

	module.exports = router;

Then, the template at _/views/visits.ejs_:

	<!DOCTYPE html>
	<html>
	  <head>
      	<title>Page Visits</title>
    	<link rel='stylesheet' href='/stylesheets/style.css' />
	  </head>
	  <body>
    	<h1>Page Visits</h1>
    	<em>we'll fill this in a minute..</em>
	  </body>
	</html>

And finally, the glue between the request and the route:

	var visits = require('./routes/visits');
	app.use('/visits', visits);

Now test your application at

	http://localhost:3000/visits
	
### Writing data to the database

Next, we'll create a model to describe our data. For this example, we'll simply log each visit to the site.

_Note: This will require creating a new folder, /models, in the root of the application._

In a new _/models_ folder, create a file _visit.js_:

	var mongoose = require('mongoose')
	   ,Schema = mongoose.Schema
	   ,ObjectId = Schema.ObjectId;
 
	var visitSchema = new Schema({
	    thread: ObjectId,
	    date: {type: Date, default: Date.now},
	    user_agent: {type: String, default: 'none'}
	});
 
	module.exports = mongoose.model('Visit', visitSchema);

In _app.js_, make the database connection and write data using our new model:
	
	var mongoose = require('mongoose');
	mongoose.connect('mongodb://localhost/myapp');

	var Visit = require("./models/visit.js");

	app.use(function(req, res, next){
    	new Visit({user_agent: req.headers['user-agent']}).save();
	    next();
	});

Note that we are requiring our Visit model file as a module, which provides for us a _save()_ method to easily write new data.  Also note that in our _app.use()_ callback, we are invoking _next()_: our code here is in the request-handling path, and we must continue to pass execution to subsequent callbacks defined on the chain.

From this point on, you will need to have the Mongo database running in order for the express web application to run: it will attempt to connect to Mongo on start.

	$ mongod --config /usr/local/etc/mongod.conf
	
You may test again at this point, however, unless you've added some logging statements in the new request-handling code, you won't see much difference. (unless it's broken!)

### Reading and displaying data in a template

A modification to our route to fetch the data:

	..
	var Visit = require("../models/visit.js");

	router.get('/', function(req, res) {

	  var query = Visit.find();
	  query.sort({date: -1});

	  query.exec(function(err, visits){
  		res.render('visits', { visits: visits });
	  });  
	});
	..
	
And a modification to our template to render it:
	
	..
	<h1>Page Visits</h1>
    <% for(var v in visits){ %>
      <p><%- visits[v] %></p>
    <% } %>
    ..

If you restart your application now and visit

	http://localhost:3000/visits
	
you should see a continuous log of visits to your site!
    
## Socket.IO

Now that we have a fully fledged web application, let's show off how easy it is to use Socket.IO for a real-time web experience.

One of the most basic applications of pushing data to the client, as Socket.IO enables us to do, is web chat.  To implement web chat, we'll need an HTML chat form, some javascript to send and receive chats on the client, and some javascript to handle chats on the server.

### Socket.IO Dependency

In /package.json, we must add Socket.IO to the 'dependencies' list:
	
	    ...
 	   	"debug": "~0.7.4",
    	"ejs": "~0.8.5",
	    "mongoose": "3.8.12",
	    "socket.io": "1.0.3"
  	  }	
	}

And then actually install it:

		$ npm install
		
### Server-Side Chat Javascript

Here, we introduce a new object in the application: the Socket.IO Server, created from the HTTP server object. Here, the Socket.IO Server object is named _io_.  We can treat this object just like the express application object and define endpoints and behavior, however when dealing with sockets, these are called _namespaces_ and _middleware_.

		var server = require('http').createServer(app);
		var io = require('socket.io').listen(server);
		server.listen(3001);
		
		// -- '/chat' is the namespace identifier
		// -- the callback function is the middleware we define for the namespace identifier
		var chat = io.of('/chat').on('connection', function(socket){
			socket.on('chat', function(data){      
				data.color = 'green';
				socket.emit('chat', data);
				data.color = 'red';
				socket.broadcast.emit('chat', data);
			});
		});

Note that we are defining a _callback function_ for events that occur on the _/chat_ namespace.  This namespace identifier can be anything we like, and we can define _many namespaces on the same Socket.IO server_.  Also, note that we can extend the _data_ object that is passed to that callback function to do things like color-code the conversation: green for the sender and red for everyone else.

### HTML Chat Form

Our HTML chat form is a place to type, a button to send, and a container to hold chat messages.  
Place this snippet anywhere in the body of the page.

		<div id="chatlog" style="height: 200px;overflow-y:scroll;"></div>
	    <textarea id="chatwindow" cols="30" rows="10"></textarea>
    	<input id="send_chat" type="submit" value="Send" />

### Client-Side Chat Javascript

On the client, we must include the Socket.IO javascript, which is served automatically by our Socket.IO Server object.  Once included, we can connect to the Server at a namespace, which returns to us a Socket. To react to events on that namespace, we define event callbacks with _Socket.on()_.  To create events on that namespace, we call _Socket.emit()_.

To help in working with client-side elements and events (the HTML chat form and chat 'send' button), we use jQuery.

	<script src="http://localhost:3001/socket.io/socket.io.js"></script>
	<script src="//code.jquery.com/jquery-1.10.2.min.js"></script>

	<script type="text/javascript">
	  	   
		var chat_socket = io.connect('http://localhost:3001/chat');

		chat_socket.on('chat', function(data){
			$("#chatlog").append($("<p style='color:" + data.color + ";'></p>").text(data.isay));
		});

		$(document).on('click', "#send_chat", function(e){
			chat_socket.emit('chat', {isay: $("#chatwindow").val()});
		    $("#chatwindow").val("");
		});

	</script>
  
