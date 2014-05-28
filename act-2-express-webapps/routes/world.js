var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res) {
  res.render('world', 
  	{
  		title: "Stuff",
  		count: req.online.length
  	}
  	);
});

module.exports = router;
