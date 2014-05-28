var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res) {
  res.send('This is a res.send response with no view.<br /><br /><a href="/">Back to civilization.</a>');
});

module.exports = router;
