const GenerateInvoiceOnline = require("./generators/generateInvoice");
const Subsidiary = require("../../subsidiarys/subsidiary.model");
const EmitedInvoice = require("../../emitedInvoices/emitedInvoice.model");
const Product = require("../../products/product.model");

const moment = require('moment-timezone');
const MerchantConfig = require("../../merchantConfigs/merchantConfig.model");

class Servicios {
  constructor() { }

  async passTestEmitirFacturaOnline(merchantMongoose, user, body) {
    let repeatTimes = body.repeatTimes;
    let codigoSucursal = body.codigoSucursal || 0;
    let codigoPuntoVenta = body.codigoPuntoVenta || 0;
    let fechaEmision = moment(body.fechaEmision).format('YYYY-MM-DD');
    let horaEmision = moment(body.fechaEmision).format('HH:mm:ss.SSS');
    if (body.horaEmision) {
      horaEmision = moment(`${fechaEmision}T${body.horaEmision}`).format('HH:mm:ss.SSS');
    }
    const product = await Product(merchantMongoose).findOne();

    const data = {
      "tcEmpresa": "MERCHANT1ß9902ßCIßSanta CruzßSanta Cruzß67011860",
      "tcPuntoVenta": `${codigoSucursal}ß${codigoPuntoVenta}ßSucursal 1ßPunto de venta 1ßSanta Cruzß67011860`,
      "tcFactura": `4883047018ßMappscßscß67001992ß16ß${codigoSucursal}ßSantaCruzß${codigoPuntoVenta}ß${fechaEmision}ß${horaEmision}ßMappscß1ß9902ßß123ß1ß0ß100,00ß100,00ß1ß1ß0,00ß0,00ß0ßVendedorß1ßcorreoelcronicocliente@gmail.com`,
      "tcFacturaDetalle": `${product ? product.code : 'COD_1'}¦${product ? product.economicActivity : '620100'}¦${product ? product.SINCode : '83141'}ßItemß1ß47ß100,00ß0,00ß100,00ß0ß0`
    }

    let invoiceData = GenerateInvoiceOnline.validateAndConvertStringToJSON(data);
    invoiceData.codigoSucursal = codigoSucursal != undefined ? codigoSucursal : invoiceData.codigoSucursal;
    invoiceData.codigoPuntoVenta = codigoPuntoVenta != undefined ? codigoPuntoVenta : invoiceData.codigoPuntoVenta;
    invoiceData.emailToSend = invoiceData.tcFactura.correoCliente;
    const subsidiary = await Subsidiary(merchantMongoose).findOne({ codigoSucursal: invoiceData.codigoSucursal, codigoPuntoVenta: invoiceData.codigoPuntoVenta });

    try {
      const invoiceData = await GenerateInvoiceOnline.generateInvoice(merchantMongoose, invoiceData, subsidiary, user.username);
      repeatTimes--;

      if (repeatTimes > 0) {
        if (body.fechaEmision || body.horaEmision) {
          body.horaEmision = moment(`${fechaEmision}T${horaEmision}`).add(250, 'milliseconds').format('HH:mm:ss.SSS');
        }
        body.repeatTimes = repeatTimes;
        return this.passTestEmitirFacturaOnline(merchantMongoose, user, body);
      } else {
        return invoiceData;
      }
    } catch (err) {
      return { error: err };
    }
  }

  async emitirFacturaOnline(merchantMongoose, data, user) {
    let invoiceData = GenerateInvoiceOnline.validateAndConvertStringToJSON(data);
    const subsidiary = await Subsidiary(merchantMongoose).findOne({ codigoSucursal: invoiceData.tcPuntoVenta.codigoSucursal, codigoPuntoVenta: invoiceData.tcPuntoVenta.codigoPuntoVenta });

    try {
      const invoiceData = await GenerateInvoiceOnline.generateInvoice(merchantMongoose, invoiceData, subsidiary, user.username);
      const invoice = invoiceData.invoice;

      return invoice;
    } catch (err) {
      return { error: err };
    }
  }

  async anularFactura(merchantMongoose, cuf, user) {
    const emitedInvoice = await EmitedInvoice(merchantMongoose).findOne({ cuf });
    const subsidiary = await Subsidiary(merchantMongoose).findOne({ codigoSucursal: emitedInvoice.codigoSucursal, codigoPuntoVenta: emitedInvoice.codigoSucursal });

    try {
      const invoice = await GenerateInvoiceOnline.anularFactura(merchantMongoose, emitedInvoice, subsidiary, user.username);

      return invoice;
    } catch (err) {
      return { error: err };
    }
  }

  async anularFacturaAxon(merchantMongoose, body, user) {
    try {
      // 🔹 Extract values from the request body
      const { nitEmisor, cuf, numeroFactura, idDocFiscalERP, codigoMotivo } = body;

      // 🔹 Find the emitted invoice by CUF
      const emitedInvoice = await EmitedInvoice(merchantMongoose).findOne({ cuf });

      if (!emitedInvoice) {
        return {
          respuesta: {
            codRespuesta: "1",
            txtRespuesta: "Factura no encontrada."
          },
          resultCore: null
        };
      }

      // 🔹 Find the related subsidiary
      const subsidiary = await Subsidiary(merchantMongoose).findOne({
        codigoSucursal: emitedInvoice.codigoSucursal,
        codigoPuntoVenta: emitedInvoice.codigoPuntoVenta
      });

      // 🔹 Call the external function to process the invoice cancellation
      const invoice = await GenerateInvoiceOnline.anularFactura(merchantMongoose, emitedInvoice, subsidiary, user.username, codigoMotivo);

      // 🔹 Format the response
      return this.formatAnulacionFacturaResponse(invoice);
    } catch (err) {
      return {
        respuesta: {
          codRespuesta: "1",
          txtRespuesta: "Error en la anulación de la factura"
        },
        error: err.message || err
      };
    }
  }

  formatAnulacionFacturaResponse(invoice) {
    if (!invoice) {
      return {
        respuesta: {
          codRespuesta: "1",
          txtRespuesta: "Factura no encontrada."
        },
        resultCore: null
      };
    }

    return {
      respuesta: {
        codRespuesta: "0",
        txtRespuesta: "Exito"
      },
      resultCore: {
        nitEmisor: invoice.nitEmisor || null,
        cuf: invoice.cuf || null,
        idDocFiscalFeel: invoice.idDocFiscalFEEL || 8768, // Default if not available
        idDocFiscalErp: invoice.idDocFiscalERP || "7470",
        fechaRecepcion: invoice && invoice.fechaEmision && invoice.fechaEmision.replace
          ? invoice.fechaEmision.replace(/[-:T]/g, '').slice(0, 17) // Format timestamp
          : "",
        tipoDocumento: invoice.codigoDocumentoSector || 35,
        tipoFactura: invoice.tipoFacturaDocumento || 1,
        archivoPdf: null,
        operacion: 1,
        modalidad: invoice.codigoModalidad || 1,
        forma: 0,
        codigo: invoice.id,
        codigoRecepcion: 905,
        descripcion: "ANULACION CONFIRMADA",
        listaMensajes: invoice.listaMensajes || []
      }
    };
  }

  async obetenerFactura(merchantMongoose, cuf) {
    const emitedInvoice = await EmitedInvoice(merchantMongoose).findOne({ cuf });
    const subsidiary = await Subsidiary(merchantMongoose).findOne({ codigoSucursal: emitedInvoice.codigoSucursal, codigoPuntoVenta: emitedInvoice.codigoSucursal });
    const merchantConfig = await MerchantConfig(merchantMongoose).findOne().select('facturacion');

    try {
      const invoice = await GenerateInvoiceOnline.obetenerFactura(emitedInvoice, subsidiary, merchantConfig);

      return invoice;
    } catch (err) {
      return { error: err };
    }
  }

  async consultarEstadoFactura(merchantMongoose, cuf) {
    const emitedInvoice = await EmitedInvoice(merchantMongoose).findOne({ cuf });
    const subsidiary = await Subsidiary(merchantMongoose).findOne({ codigoSucursal: emitedInvoice.codigoSucursal, codigoPuntoVenta: emitedInvoice.codigoSucursal });

    try {
      const invoice = await GenerateInvoiceOnline.consultarEstadoFactura(merchantMongoose, emitedInvoice, subsidiary);

      return invoice;
    } catch (err) {
      return { error: err };
    }
  }

  async emitirFacturaOnlineRapida(merchantMongoose, data, user, subsidiaryData = undefined) {
    let subsidiary;
    if (subsidiaryData) {
      subsidiary = subsidiaryData;
    } else {
      subsidiary = await Subsidiary(merchantMongoose).findOne({ code: data.subsidiaryCode });
    }

    try {
      const invoice = await GenerateInvoiceOnline.generateFastInvoice(merchantMongoose, data, subsidiary, user.username);

      return invoice;
    } catch (err) {
      return { error: err };
    }
  }
}

module.exports = Servicios;
