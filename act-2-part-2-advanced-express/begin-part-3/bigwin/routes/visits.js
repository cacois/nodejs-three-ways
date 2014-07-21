var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('visits', { my_name: "Tim" }); // -- find our view
});

module.exports = router;
