// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var SignificantEventSchema = new Schema({
  codigoMotivoEvento: { type: Number },
  codigoAmbiente: {
    type: Number,
  },
  codigoSistema: {
    type: String,
  },
  nit: { type: Number },
  cuis: { type: String },
  cufd: { type: String },
  codigoSucursal: { type: Number },
  codigoPuntoVenta: { type: Number },
  descripcion: { type: String },
  fechaHoraInicioEvento: { type: Date, default: Date.now },
  fechaHoraFinEvento: { type: Date, default: Date.now },
  cufdEvento: { type: String },
  codigoRecepcionEventoSignificativo: { type: Number },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

SignificantEventSchema.pre("save", function (next) {
  var significantEvent = this;

  if (!significantEvent.isNew) significantEvent.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var SignificantEvent = function (mongooseCon) {
  return mongooseCon.model("SignificantEvent", SignificantEventSchema);
};
// make this available to our users in our Node applications
module.exports = SignificantEvent;
