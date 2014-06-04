var express = require('express');
var router = express.Router();

var Visit = require("../models/visit.js");

router.get('/', function(req, res) {

  var query = Visit.find();
  query.sort({date: -1});

  query.exec(function(err, visits){
  	res.render('visits', { visits: visits });
  });  
});

module.exports = router;
