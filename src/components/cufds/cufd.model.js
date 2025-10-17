// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var CufdSchema = new Schema({
  codigoSucursal: String,
  codigoPuntoVenta: String,
  codigo: String,
  codigoControl: String,
  direccion: String,
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

CufdSchema.pre("save", function (next) {
  var cufd = this;

  if (!cufd.isNew) cufd.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var Cufd = function (mongooseCon) {
  return mongooseCon.model("Cufd", CufdSchema);
};
// make this available to our users in our Node applications
module.exports = Cufd;
