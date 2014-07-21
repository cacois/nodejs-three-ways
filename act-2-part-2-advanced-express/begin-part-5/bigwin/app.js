var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/myapp');

var Visit = require("./models/visit.js");

var routes = require('./routes/index');
var users = require('./routes/users');
var visits = require('./routes/visits'); // -- the route

var app = express();

var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
server.listen(3001);

var chat = io.of('/chat').on('connection', function(socket){
    socket.on('chat', function(data){
        data.color = 'green';
        socket.emit('chat', data);
        data.color = 'red';
        socket.broadcast.emit('chat', data);
    });
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// -- we run some code inline with each request - a new request decorator
app.use(function(req, res, next){
    new Visit({user_agent: req.headers['user-agent']}).save();
    next();
});

app.use('/', routes);
app.use('/users', users);
app.use('/visits', visits); // -- the request assignment

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


module.exports = app;
