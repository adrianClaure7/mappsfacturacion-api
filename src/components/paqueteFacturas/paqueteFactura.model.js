// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var PaqueteFacturaSchema = new Schema({
  codigoEstado: Number,
  codigoDescripcion: String,
  codigoRecepcion: String,
  fechaEnvio: Date,
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

PaqueteFacturaSchema.pre("save", function (next) {
  var paqueteFactura = this;

  if (!paqueteFactura.isNew) paqueteFactura.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var PaqueteFactura = function (mongooseCon) {
  return mongooseCon.model("PaqueteFactura", PaqueteFacturaSchema);
};
// make this available to our users in our Node applications
module.exports = PaqueteFactura;
