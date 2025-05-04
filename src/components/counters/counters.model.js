// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var CounterSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  counter: {
    type: Number,
    required: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

CounterSchema.pre("save", function(next) {
  var counter = this;

  if (!counter.isNew) counter.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var Counter = function(mongooseCon) {
  return mongooseCon.model("Counter", CounterSchema);
};
// make this available to our users in our Node applications
module.exports = Counter;
