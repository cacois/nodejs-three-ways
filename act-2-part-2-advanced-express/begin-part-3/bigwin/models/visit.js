var mongoose = require('mongoose')
   ,Schema = mongoose.Schema
   ,ObjectId = Schema.ObjectId;

var visitSchema = new Schema({
    thread: ObjectId,
    date: {type: Date, default: Date.now},
    user_agent: {type: String, default: 'none'}
});

module.exports = mongoose.model('Visit', visitSchema);
