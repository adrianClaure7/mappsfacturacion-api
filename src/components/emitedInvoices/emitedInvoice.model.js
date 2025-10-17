// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var EmitedInvoiceSchema = new Schema({
  orderId: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    default: 1,
    required: true
  },
  cuis: {
    type: String
  },
  cufd: {
    type: String,
    required: true
  },
  cuf: {
    type: String,
    required: true
  },
  nitEmisor: {
    type: Number
  },
  razonSocialEmisor: {
    type: String
  },
  codigoModalidad: Number,
  codigoSucursal: Number,
  codigoPuntoVenta: Number,
  direccion: String,
  telefono: Number,
  municipio: String,
  numeroFactura: Number,
  nombreRazonSocial: String, // NOMBRE NIT
  numeroDocumento: String, // NIT
  leyenda: String,
  fechaEmision: Date,
  codigoTipoDocumentoIdentidad: Number,
  montoTotal: Number,
  montoTotalSujetoIva: Number,
  codigoMoneda: Number,
  tipoCambio: Number,
  montoTotalMoneda: Number,
  descuentoAdicional: Number,
  montoGiftCard: Number,
  numeroTarjeta: String,
  usuario: String,
  codigoDocumentoSector: Number,
  tipoFacturaDocumento: Number,
  canceled: {
    type: Boolean,
    default: false
  },
  codigoMotivo: String,
  codigoEmision: Number,
  codigoCliente: String,
  codigoMetodoPago: String,
  detalle: [],
  emailToSend: String,
  cafc: String,
  orderGeneratorId: String,
  idDocFiscalERP: String,
  extraData: {
    ntra: String,// Data From SAI Makro
  },
  codigoRecepcion: Number,
  codigo: String,
  codigoExcepcion: Number,
  listaMensajes: [],
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

EmitedInvoiceSchema.pre("save", function (next) {
  var emitedInvoice = this;

  if (!emitedInvoice.isNew) emitedInvoice.updatedOn = new Date();

  next();
});

EmitedInvoiceSchema.statics.findOneAndResponseAxon = async function (searchParams) {
  console.log(`Searching factura in MongoDB with params:`, searchParams);

  const query = {};

  if (searchParams.nit) query.nitEmisor = searchParams.nit;
  if (searchParams.sucursal !== undefined) query.codigoSucursal = searchParams.sucursal;
  if (searchParams.pos !== undefined) query.codigoPuntoVenta = searchParams.pos;
  if (searchParams.nroFactura !== undefined) query.numeroFactura = searchParams.nroFactura;
  if (searchParams.idDocFiscalERP) query.idDocFiscalERP = searchParams.idDocFiscalERP;
  if (searchParams.cuf !== undefined) query.cuf = searchParams.cuf;

  try {
    const factura = await this.findOne(query).lean();
    return this.formatFacturaResponse(factura);
  } catch (error) {
    console.error(`Error finding factura:`, error);
    throw new Error('Database search failed');
  }
};

EmitedInvoiceSchema.statics.formatFacturaResponse = function (factura) {
  if (!factura) {
    return {
      corteServicio: null,
      respuesta: {
        codRespuesta: "1",
        txtRespuesta: "Factura no encontrada."
      },
      proceso: {
        idDocFiscalFEEL: null,
        cufd: null,
        cuf: null,
        codEstado: null,
        fueraLinea: false,
        idDocFiscalERP: null,
        codigoTipoFactura: null,
        codigo: null,
        codigoRecepcion: null,
        listaMensajes: [],
        cufModificado: false
      },
      facturaCompraVentaBon: null,
      facturaCompraVenta: null,
      facturaAlquiler: null,
      facturaEntidadFinanciera: null,
      facturaColegio: null,
      facturaHospital: null,
      facturaHotel: null,
      facturaServicios: null,
      notaLibreConsignacion: null,
      notaExportacion: null,
      notaExportacionPVenta: null,
      facturaComercialExportacionServicio: null,
      facturaComercializacionHidrocarburo: null,
      facturaHidrocarburo: null,
      notaMonedaExtranjera: null,
      facturaBoletoAereo: null,
      facturaTelecomunicacion: null,
      facturaPrevalorada: null,
      facturaSeguros: null,
      facturaSeguridadAlimentaria: null,
      notaTasaCero: null,
      facturaZonaFranca: null,
      notaCreditoDebito: null,
      notaConciliacion: null,
      facturaIceZonaFranca: null,
      facturaTuristicoHospedaje: null,
      notaCreditoDebitoDescuento: null,
      notaCreditoDebitoIce: null
    };
  }

  return {
    corteServicio: null,
    respuesta: {
      codRespuesta: "0",
      txtRespuesta: "Se encontró registrada una factura con los mismos datos."
    },
    proceso: {
      idDocFiscalFEEL: factura.idDocFiscalFEEL || null,
      cufd: factura.cufd || null,
      cuf: factura.cuf || null,
      codEstado: factura.status || null,
      fueraLinea: false,
      idDocFiscalERP: factura.idDocFiscalERP || null,
      codigoTipoFactura: factura.tipoFacturaDocumento || null,
      codigo: factura.codigoMotivo || null,
      codigoRecepcion: null,
      listaMensajes: [],
      cufModificado: false
    },
    facturaCompraVentaBon: factura
      ? {
        cabecera: {
          nitEmisor: factura.nitEmisor || null,
          razonSocialEmisor: factura.razonSocialEmisor || null,
          municipio: factura.municipio || null,
          telefono: factura.telefono || null,
          numeroFactura: factura.numeroFactura || null,
          cuf: factura.cuf || null,
          cufd: factura.cufd || null,
          codigoSucursal: factura.codigoSucursal || null,
          direccion: factura.direccion || null,
          codigoPuntoVenta: factura.codigoPuntoVenta || null,
          fechaEmision: factura.fechaEmision || null,
          nombreRazonSocial: factura.nombreRazonSocial || null,
          codigoTipoDocumentoIdentidad: factura.codigoTipoDocumentoIdentidad || null,
          numeroDocumento: factura.numeroDocumento || null,
          complemento: null,
          codigoCliente: factura.codigoCliente || null,
          codigoMetodoPago: factura.codigoMetodoPago || null,
          numeroTarjeta: null,
          montoTotal: factura.montoTotal || null,
          montoTotalSujetoIva: factura.montoTotalSujetoIva || null,
          codigoMoneda: factura.codigoMoneda || null,
          tipoCambio: factura.tipoCambio || null,
          montoTotalMoneda: factura.montoTotalMoneda || null,
          montoGiftCard: null,
          descuentoAdicional: factura.descuentoAdicional || null,
          codigoExcepcion: null,
          cafc: factura.cafc || null,
          leyenda: factura.leyenda || null,
          usuario: factura.usuario || null,
          codigoDocumentoSector: factura.codigoDocumentoSector || null
        },
        detalle: factura.detalle?.map((item) => ({
          actividadEconomica: item.actividadEconomica || null,
          codigoProductoSin: item.codigoProductoSin || null,
          codigoProducto: item.codigoProducto || null,
          descripcion: item.descripcion || null,
          cantidad: item.cantidad || null,
          unidadMedida: item.unidadMedida || null,
          precioUnitario: item.precioUnitario || null,
          montoDescuento: item.montoDescuento || null,
          subTotal: item.subTotal || null,
          numeroSerie: item.numeroSerie || null,
          numeroImei: item.numeroImei || null
        })) || []
      }
      : null,
    facturaCompraVenta: null,
    facturaAlquiler: null,
    facturaEntidadFinanciera: null,
    facturaColegio: null,
    facturaHospital: null,
    facturaHotel: null,
    facturaServicios: null,
    notaLibreConsignacion: null,
    notaExportacion: null,
    notaExportacionPVenta: null,
    facturaComercialExportacionServicio: null,
    facturaComercializacionHidrocarburo: null,
    facturaHidrocarburo: null,
    notaMonedaExtranjera: null,
    facturaBoletoAereo: null,
    facturaTelecomunicacion: null,
    facturaPrevalorada: null,
    facturaSeguros: null,
    facturaSeguridadAlimentaria: null,
    notaTasaCero: null,
    facturaZonaFranca: null,
    notaCreditoDebito: null,
    notaConciliacion: null,
    facturaIceZonaFranca: null,
    facturaTuristicoHospedaje: null,
    notaCreditoDebitoDescuento: null,
    notaCreditoDebitoIce: null
  };
}
// the schema is useless so far
// we need to create a model using it
var EmitedInvoice = function (mongooseCon) {
  return mongooseCon.model("EmitedInvoice", EmitedInvoiceSchema);
};
// make this available to our users in our Node applications
module.exports = EmitedInvoice;
