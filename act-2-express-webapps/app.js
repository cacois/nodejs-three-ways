var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var redis = require('redis');
var db = redis.createClient();

var routes = require('./routes/index');
var users = require('./routes/users');
var world = require('./routes/world');

var app = express();

/*
  Socket.IO listens on an httpServer instance. 
  Normally, this Express app would not need to create or listen on the server object. */
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

/*
  After Socket.IO listens on the server, the server listens on a new port, separate from the Express application. */
server.listen(3001);

/*
  This is standard Express application setup. */

// -- View pathing and engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// -- Loggers, parsers, middleware, static paths.. 
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(require('less-middleware')(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// -- This call registers the client's presence as its user-agent value with a timestamp
app.use(function(req, res, next){
    var ua = req.headers['user-agent'];
    db.zadd('online', Date.now(), ua, next);
});

// -- A global var to track recent users
var _users;

// -- Set the request's 'online' attribute and also refresh the global _users
// -- The fetching of users is broken out into a function so it can be called by both regular Express requests and from within the Socket.IO workflow
function get_users(req, next){
  var min = 60 * 1000;
  var ago = Date.now() - min;
  db.zrevrangebyscore('online', '+inf', ago, function(err, users){

    _users = users;

    if (err && next) return next(err);
    if (req) req.online = users;
    if (next) next();    
  });
}

app.use(function(req, res, next){
    get_users(req, next);  
});

// -- View declarations
app.use('/', routes);
app.use('/users', users);
app.use('/world', world);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

// -- of() multiplexes our single socket connection over port 3001 into namespaces
// -- our namespace here is '/chat'
var chat = io.of('/chat').authorization(function (handshakeData, callback) {
    
    // -- here, we can control authorization to the Socket.IO connection based on values found in handshakeData, such as request headers 
    var authorized = true;
    callback(null, authorized);  

  }).on('connection', function(socket){

    socket.set('ua', socket.handshake.headers['user-agent'], function(){
      
    });

    console.log("chat connection made");

    // -- For this and each connection, we will periodically refresh the global '_users' variable and emit its length value to the client
    setInterval(function(){ 
      get_users(null, function(){

        socket.get('ua', function(err, ua){

          if(ua){
            db.zadd('online', Date.now(), ua);
            socket.emit("people_count", { people_count: _users.length-1 });
          }

        });        
      });
    }, 5000);

    // -- This endpoint is made available to clients so they can set their chat nickname
    socket.on('set nickname', function(name){
      // -- A standard socket.set() call for arbitrary key/value 
      socket.set('nickname', name, function(){
        // -- When the key/value is set, we can let the client know.
        socket.emit('name_ready');
      });
    });

    // -- This endpoint is for chat 'posts'
    socket.on('chat', function(data){
      // -- First, we get the poster's nickname
      socket.get('nickname', function(err, name){     
        // -- And when the nickname is retrieved, we modify the message to include it
        data.isay = name + ": " + data.isay;   

        // -- This emit will go to the posting client itself
        socket.emit('chat', data);
        // -- This emit will go to everyone else, not including the posting client
        socket.broadcast.emit('chat', data);
      });
    });
});

module.exports = app;
