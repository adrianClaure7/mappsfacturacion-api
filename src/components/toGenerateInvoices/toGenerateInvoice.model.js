const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define the schema
const ToGenerateInvoiceSchema = new Schema({
  codigoTipoDocumentoIdentidad: {
    type: String,
    required: true,
  },
  nombreRazonSocial: {
    type: String,
    required: true,
  },
  numeroDocumento: {
    type: String,
    required: true,
  },
  codigoCliente: {
    type: String,
    required: true,
  },
  correo: {
    type: String,
    required: true,
  },
  codigoMetodoPago: {
    type: String,
    required: true,
  },
  codigoSucursal: {
    type: String,
    required: true,
  },
  codigoPuntoVenta: {
    type: String,
    required: true,
  },
  detalle: [
    {
      actividadEconomica: {
        type: String,
        required: true,
      },
      codigoProductoSiat: {
        type: String,
        required: true,
      },
      codigoProducto: {
        type: String,
        required: true,
      },
      descripcion: {
        type: String,
        required: true,
      },
      cantidad: {
        type: String,
        required: true,
      },
      precioUnitario: {
        type: String,
        required: true,
      },
      subTotal: {
        type: Number,
        required: true,
      },
      unidadMedida: {
        type: String,
        required: true,
      },
      montoDescuento: {
        type: String,
        required: true,
      },
    },
  ],
  montoTotal: {
    type: Number,
    required: true,
  },
  montoTotalMoneda: {
    type: Number,
    required: true,
  },
  montoTotalSujetoIva: {
    type: Number,
    required: true,
  },
  emailToSend: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
  },
  updatedBy: {
    type: String,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  updatedOn: {
    type: Date,
    default: Date.now,
  },
});


// Pre-save hook to update the `updatedOn` field for existing documents
ToGenerateInvoiceSchema.pre("save", async function (next) {
  if (!this.isNew) {
    this.updatedOn = new Date();
  }
  next();
});

// Factory function to create a model using the schema and provided mongoose connection
const ToGenerateInvoice = function (mongooseCon) {
  return mongooseCon.model("ToGenerateInvoice", ToGenerateInvoiceSchema);
}

// Export the model factory
module.exports = ToGenerateInvoice;
