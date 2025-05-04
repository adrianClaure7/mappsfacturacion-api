// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var ExternalAccesSchema = new Schema({
  userId: {
    type: String
  },
  database: {
    type: String
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

ExternalAccesSchema.pre("save", function (next) {
  var externalAcces = this;

  if (!externalAcces.isNew) externalAcces.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var ExternalAcces = function (mongooseCon) {
  return mongooseCon.model("ExternalAcces", ExternalAccesSchema);
};
// make this available to our users in our Node applications
module.exports = ExternalAcces;
