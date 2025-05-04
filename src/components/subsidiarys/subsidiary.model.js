// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;
var TIPOS_EMISION = require("../../commons/tiposEmision");

// create a schema
var SubsidiarySchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  codigoTipoPuntoVenta: { type: Number },
  municipio: { type: String, required: true }, // SI - Nombre del departamento o municipio que se refleja en la Factura. 
  telefono: { type: String }, // NO - Número de teléfono que se refleja en la Factura.
  direccion: { type: String, required: true }, // SI - Dirección de la sucursal registrada en el Padrón Nacional de Contribuyentes.
  leyenda: { type: String, required: true }, // SI - Leyenda asociada a la actividad económica.
  codigoDocumentoSector: { type: Number, required: true }, // SI - Valor de la paramétrica que identifica el tipo de factura que se está emitiendo. Para este tipo de factura este valor es 1.-->1 = Factura Compra Venta, 2 = Recibo de Alquiler de Bienes Inmuebles, ……., 24 = Nota Crédito - Débito
  codigoSucursal: { type: Number, required: true }, // SI - Código de la sucursal registrada en el Padrón y en la cual se está emitiendo la factura.
  modalidad: { type: Number },// 1 = Electrónica en Línea, 2 = Computarizada en Línea, 3 = Portal Web en Línea  
  tipoEmision: { type: Number },// 1 = Online, 2 = Offline, 3 = Masiva 
  tipoFactura: { type: Number },// 1 = Factura con Derecho a Crédito Fiscal, 2 = Factura sin Derecho a Crédito Fiscal, 3 = Documento de Ajuste   
  numeroFactura: { type: Number, required: true }, // SI - Numeración propia que se le asigna a la Factura.
  cufd: { type: String }, // SI - Código único de facturación diario (CUFD), valor único que se obtiene al consumir el servicio web correspondiente.
  tamano: { type: Number },
  codigoPuntoVenta: { type: Number },// solo para (POS)--> 0 = No corresponde, 1,2,3,4,….n
  actividad: { type: String },// ACTIVIDAD QUE REALIZA
  RespuestaCuis: { // Resuesta al generar CUIS
    codigo: String,
    fechaVigencia: Date,
    mensajesList: [{
      code: String,
      description: String
    }],
    transaccion: Boolean
  },
  RespuestaCufd: {
    codigo: String,
    codigoControl: String,
    direccion: String,
    fechaVigencia: Date,
    mensajesList: [{
      code: String,
      description: String
    }],
    transaccion: Boolean
  },
  RespuestaCufdMasivo: {
    listaRespuestasCufd: [{
      codigo: String,
      codigoControl: String,
      codigoPuntoVenta: Number,
      codigoSucursal: Number,
      cuis: String,
      direccion: String,
      fechaVigencia: Date,
      transaccion: Boolean
    }]
  },
  cafc: String,
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

SubsidiarySchema.pre("save", function (next) {
  var subsidiary = this;

  if (!subsidiary.isNew) subsidiary.updatedOn = new Date();

  next();
});

SubsidiarySchema.statics.updateSubsidiary = async function (currentMongoose, Codigos, dataToUpdate, subsidiaryId) {
  try {
    const updatedSubsidiary = await Subsidiary(currentMongoose).findByIdAndUpdate(
      subsidiaryId,
      dataToUpdate,
      { new: true }
    );

    if (!updatedSubsidiary) {
      throw new Error("Subsidiary not found");
    }

    if (dataToUpdate.tipoEmision === TIPOS_EMISION.ONLINE.code) {
      const codigos = new Codigos({});
      const result = await codigos.generateCufd(currentMongoose, updatedSubsidiary);
      updatedSubsidiary.RespuestaCufd = result.RespuestaCufd;
    }

    return updatedSubsidiary;
  } catch (err) {
    throw err;
  }
};


// the schema is useless so far
// we need to create a model using it
var Subsidiary = function (mongooseCon) {
  return mongooseCon.model("Subsidiary", SubsidiarySchema);
};
// make this available to our users in our Node applications
module.exports = Subsidiary;
