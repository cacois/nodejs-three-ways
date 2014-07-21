var express = require('express');
var router = express.Router();

var Visit = require("../models/visit.js"); // -- new require

router.get('/', function(req, res) {

	var query = Visit.find(); // -- only creating a query object
	query.sort({date: -1}); // -- no execution here

	// -- we still have a render() call
  	// -- but it is now in the callback to our database query execution
  	query.exec(function(err, visits){
		// -- also note we are passing the results of our query to ejs
      	res.render('visits', { my_name: "Tim", visits: visits }); // -- find our view
    });
});

module.exports = router;
