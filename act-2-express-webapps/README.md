# Getting Started

1. Install the necessary packages from package.json:

> npm install 

2. Run the service:

> npm start

3. Visit the page:

> http://localhost:3000/world

# Notes

Note that NodeJS Express is serving on port 3000 and Socket.IO maintains a separate connection on port 3001.  These ports are arbitrary.  

'3000' is set in /bin/www with this line:

> app.set('port', process.env.PORT || 3000);

and '3001' is set in app.js with this line:

> server.listen(3001);

