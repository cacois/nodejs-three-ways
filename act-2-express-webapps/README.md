With this project, we showcase some basic features of the **Express** web application framework for Node.  We also show how Socket.IO integrates with Express to easily provide real-time push messaging in both directions between server and client.

# Getting Started

1. Install the necessary packages from package.json. This application uses **express**, **redis**, and **socket.io**, among other standard middleware for parsing and templating.

		npm install 

2. Install redis:

		brew|fink|apt-get install redis

2. Run the services:
	
		redis-server
		npm start

3. Visit the page:

		http://localhost:3000/world

The /world page presents a basic global-style chat interface. The user must provide a nickname, and then may broadcast messages to all other users at /world. 

# Notes

Note that NodeJS Express is serving on port 3000 and Socket.IO maintains a separate connection on port 3001.  

These ports are arbitrary.  

**port 3000** is set in **/bin/www** with this line:

		app.set('port', process.env.PORT || 3000);

**port 3001** is set in **app.js** with this line:

		server.listen(3001);

