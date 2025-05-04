// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var CustomerNITSchema = new Schema({
  numeroDocumento: {
    type: String,
    required: true,
    unique: true
  },
  nombreRazonSocial: {
    type: String,
    required: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

CustomerNITSchema.pre("save", function (next) {
  var customerNIT = this;

  if (!customerNIT.isNew) customerNIT.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var CustomerNIT = function (mongooseCon) {
  return mongooseCon.model("CustomerNIT", CustomerNITSchema);
};
// make this available to our users in our Node applications
module.exports = CustomerNIT;
