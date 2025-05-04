// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var CuisSchema = new Schema({
  codigoSucursal: String,
  codigo: String,
  fechaVigencia: Date,
  mensajesList: [{
    code: String,
    description: String
  }],
  transaccion: Boolean,
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

CuisSchema.pre("save", function (next) {
  var cuis = this;

  if (!cuis.isNew) cuis.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var Cuis = function (mongooseCon) {
  return mongooseCon.model("Cuis", CuisSchema);
};
// make this available to our users in our Node applications
module.exports = Cuis;
