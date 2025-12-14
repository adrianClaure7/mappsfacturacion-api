var express = require("express");
var router = express.Router();
const ApiFunctions = require('../api');
const apiFunctions = new ApiFunctions();
const Servicios = require('./servicio');
const Servicio = new Servicios();
const Utilities = require("../../../commons/utilities");
const Subsidiary = require("../../subsidiarys/subsidiary.model");
const EmitedInvoice = require("../../emitedInvoices/emitedInvoice.model");
const moment = require('moment-timezone');
const Operaciones = require("../../onlineInvoices/soap/operaciones");
const Facturacion = require("../../onlineInvoices/soap/facturacion");
const MerchantConfig = require("../../merchantConfigs/merchantConfig.model");
const GenerateInvoiceOnline = require("./generators/generateInvoice");
const fs = require('fs');
const mongoose = require("mongoose");
const Mailer = require("../../mailer");
let mailer = new Mailer();

router.post("/emitirFacturaOnline/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    console.log('[emitirFacturaOnline] ', req.body)
    try {
      const facturaEmitida = await Servicio.emitirFacturaOnline(currentMongoose, req.body, user);
      if (facturaEmitida && !facturaEmitida.error) {
        const response = apiFunctions.validResponse(facturaEmitida, "factura emitida correctamente", "Se obtuvo correctamente");
        res.send(response);
      } else if (facturaEmitida && facturaEmitida.error) {
        console.log('[emitirFacturaOnline] Error 1 ', facturaEmitida.error)
        const response = apiFunctions.errorResponse(facturaEmitida.error && facturaEmitida.error.message ? facturaEmitida.error.message : facturaEmitida.error, "Error no pudo emitirse la factura", "Error");
        res.send(response);
      } else {
        console.log('[emitirFacturaOnline]  Error 2', facturaEmitida)
        const response = apiFunctions.errorResponse(null, "Error no pudo emitirse la factura", "Error");
        res.send(response);
      }
    } catch (err) {
      res.status(403).send(err);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/anularFactura/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    const facturaAnulada = await Servicio.anularFactura(currentMongoose, req.body.tcCUF, user);
    if (facturaAnulada && !facturaAnulada.error) {
      const response = apiFunctions.validResponse(facturaAnulada, "La Factura se anulo en siat", "Anulada exitosamente");
      res.send(response);
    } else if (facturaAnulada && facturaAnulada.error) {
      const response = apiFunctions.errorResponse(facturaAnulada.error && facturaAnulada.error.message ? facturaAnulada.error.message : facturaAnulada.error, "Error no pudo emitirse la factura", "Error");
      res.send(response);
    } else {
      const response = apiFunctions.errorResponse(null, "Error no pudo emitirse la factura", "Error");
      res.send(response);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/anularFacturaAxon/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    const facturaAnulada = await Servicio.anularFacturaAxon(currentMongoose, req.body, user);
    if (facturaAnulada && !facturaAnulada.error) {
      // const response = apiFunctions.validResponse(facturaAnulada, "La Factura se anulo en siat", "Anulada exitosamente");
      res.send(facturaAnulada);
    } else if (facturaAnulada && facturaAnulada.error) {
      res.send(facturaAnulada);
    } else {
      res.send({
        "respuesta": {
          "codRespuesta": "1050",
          "txtRespuesta": `No se encontro registros para la busqueda::C1(header=null, nitEmisor=${req.body.nitEmisor}, cuf=${req.body.cuf}, numeroFactura=${req.body.numeroFactura}, idDocFiscalERP=${req.body.idDocFiscalERP}, codigoMotivo=${req.body.idDocFiscalERP})`
        },
        "resultCore": null
      });
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/obtenerFacturaDigital/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    const facturaObtenida = await Servicio.obetenerFactura(currentMongoose, req.body.tcCUF);
    if (facturaObtenida && !facturaObtenida.error) {
      const response = apiFunctions.validResponse(facturaObtenida, "Se obtuvo correctamente la factura", "Exito");
      res.send(response);
    } else if (facturaObtenida && facturaObtenida.error) {
      const response = apiFunctions.errorResponse(facturaObtenida.error && facturaObtenida.error.message ? facturaObtenida.error.message : facturaObtenida.error, "Error no pudo emitirse la factura", "Error");
      res.send(response);
    } else {
      const response = apiFunctions.errorResponse(null, "Error no pudo emitirse la factura", "Error");
      res.send(response);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/consultarEstadoFactura/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    const facturaObtenida = await Servicio.consultarEstadoFactura(currentMongoose, req.body.tcCUF);
    if (facturaObtenida && !facturaObtenida.error) {
      const response = apiFunctions.validResponse(facturaObtenida, "Se obtuvo correctamente la factura", "Exito");
      res.send(response);
    } else if (facturaObtenida && facturaObtenida.error) {
      const response = apiFunctions.errorResponse(facturaObtenida.error && facturaObtenida.error.message ? facturaObtenida.error.message : facturaObtenida.error, "Error no pudo emitirse la factura", "Error");
      res.send(response);
    } else {
      const response = apiFunctions.errorResponse(null, "Error no pudo emitirse la factura", "Error");
      res.send(response);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});


router.post("/emitirFacturaOnlineRapida/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    try {
      const facturaEmitidaData = await Servicio.emitirFacturaOnlineRapida(currentMongoose, req.body, user);
      const facturaEmitida = facturaEmitidaData.invoice;
      if (facturaEmitida && !facturaEmitidaData.error) {
        const response = apiFunctions.validResponse(facturaEmitida, "factura emitida correctamente", "Se obtuvo correctamente");
        res.send(response);
      } else if (facturaEmitidaData && facturaEmitidaData.error) {
        const response = apiFunctions.errorResponse(facturaEmitidaData.error && facturaEmitidaData.error.message ? facturaEmitidaData.error.message : facturaEmitidaData.error, "Error no pudo emitirse la factura", "Error");
        res.send(response);
      } else {
        const response = apiFunctions.errorResponse(null, "Error no pudo emitirse la factura", "Error");
        res.send(response);
      }
    } catch (err) {
      res.status(403).send(err);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/emitirFacturaThenSendToAxonfel/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    try {
      const facturaEmitidaData = await Servicio.emitirFacturaOnlineRapida(currentMongoose, req.body, user);
      const facturaEmitida = facturaEmitidaData.invoice;
      const data = facturaEmitidaData.data;
      if (data && !facturaEmitidaData.error) {
        const bodyToAxon = mapInvoiceDataToAxon(data.tcFactura);
        const response = apiFunctions.validResponse(bodyToAxon, "factura emitida correctamente", "Se obtuvo correctamente");

        res.send(response);
      } else if (facturaEmitidaData && facturaEmitidaData.error) {
        const response = apiFunctions.errorResponse(facturaEmitidaData.error && facturaEmitidaData.error.message ? facturaEmitidaData.error.message : facturaEmitidaData.error, "Error no pudo emitirse la factura", "Error");
        res.send(response);
      } else {
        const response = apiFunctions.errorResponse(null, "Error no pudo emitirse la factura", "Error");
        res.send(response);
      }
    } catch (err) {
      res.status(403).send(err);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/emitirFacturaAxonfelBody/", async function (req, res, next) {
  const currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose && req.body && req.body.facturaCompraVenta && req.body.facturaCompraVenta.cabecera) {
    try {
      const tcFactura = fillInvoiceFromAxonelBody(req.body);
      const subsidiary = await Subsidiary(currentMongoose).findOne({ codigoSucursal: req.body.facturaCompraVenta.cabecera.codigoSucursal, codigoPuntoVenta: req.body.facturaCompraVenta.cabecera.codigoPuntoVenta });

      const facturaEmitidaData = await Servicio.emitirFacturaOnlineRapida(currentMongoose, tcFactura, user, subsidiary);

      const data = facturaEmitidaData.data;
      const facturaEmitida = facturaEmitidaData.invoice;
      if (facturaEmitida && !facturaEmitidaData.error) {
        data.tcFactura.cufd = subsidiary.RespuestaCufd.codigo;
        data.tcFactura.codigo = facturaEmitida.codigo;
        data.tcFactura.codigoRecepcion = facturaEmitida.codigoRecepcion;
        data.tcFactura.listaMensajes = facturaEmitida.listaMensajes || [];
        const response = mapInvoiceDataToAxon(data.tcFactura);

        await Subsidiary(currentMongoose).updateOne(
          {
            _id: subsidiary._id
          },
          { $set: { numeroFactura: tcFactura.tcFactura.numeroFactura + 1 } }
        );

        res.send(response);
      } else if (facturaEmitidaData && facturaEmitidaData.error) {
        const errorMessage = facturaEmitidaData.error && facturaEmitidaData.error.message ? facturaEmitidaData.error.message : facturaEmitidaData.error && facturaEmitidaData.error.error ? facturaEmitidaData.error.error : facturaEmitidaData.error;
        const response = apiFunctions.errorResponseAxon(`Error no pudo emitirse la factura: ${errorMessage}`);
        res.send(response);
      } else {
        const response = apiFunctions.errorResponseAxon(`Error no pudo emitirse la factura: ${facturaEmitidaData}`);
        res.send(response);
      }
    } catch (err) {
      res.status(403).send(err);
    }
  } else {
    res.status(404).send('Invalid Data')
  }
});

router.post("/validarFacturaResponseAxon", async function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose && req.body) {
    try {
      const emitedInvoiceAxonResponse = await EmitedInvoice(currentMongoose).findOneAndResponseAxon(req.body);
      res.send(emitedInvoiceAxonResponse);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

function mapInvoiceDataToAxon(input) {
  const fechaHora = moment(`${input.fechaEmision}T${input.horaEmision}`); // Combina fecha y hora
  const fechaEmision = fechaHora.format("YYYYMMDDHHmmssSSS");
  return {
    respuesta: {
      codRespuesta: "0",
      txtRespuesta: "Exito"
    },
    proceso: {
      idDocFiscalFEEL: input.numeroFactura,
      cufd: input.cufd || "",
      codEstado: "D1",
      fueraLinea: false,
      idDocFiscalERP: input.idDocFiscalERP || "",
      codigoTipoFactura: input.codigoTipoFactura || 1,
      codigo: input.codigo || null,
      codigoRecepcion: input.codigoRecepcion || null,
      listaMensajes: input.listaMensajes || [],
      cufModificado: false
    },
    facturaCompraVenta: {
      detalle: input.tcFacturaDetalle.map((item) => ({
        numeroSerie: null,
        cantidad: item.cantidad.toString(),
        precioUnitario: item.precioUnitario.toString(),
        numeroImei: null,
        actividadEconomica: item.actividadEconomica,
        codigoProductoSin: parseInt(item.codigoProductoSiat, 10),
        codigoProducto: item.codigoProducto,
        descripcion: item.descripcion,
        subTotal: item.subTotal.toString(),
        montoDescuento: item.montoDescuento || 0,
        unidadMedida: item.unidadMedida
      })),
      cabecera: {
        nitEmisor: parseInt(input.nitEmisor, 10),
        razonSocialEmisor: input.razonSocialEmisor,
        municipio: input.municipio,
        telefono: input.telefono,
        numeroFactura: input.numeroFactura,
        cuf: input.cuf,
        cufd: input.cufd || "",
        codigoSucursal: input.codigoSucursal,
        direccion: input.direccion,
        codigoPuntoVenta: parseInt(input.codigoPuntoVenta, 10),
        fechaEmision,
        nombreRazonSocial: input.nombreRazonSocial,
        codigoTipoDocumentoIdentidad: parseInt(input.codigoTipoDocumentoIdentidad, 10),
        numeroDocumento: input.numeroDocumento,
        complemento: null,
        codigoCliente: input.codigoCliente,
        codigoMetodoPago: input.codigoMetodoPago,
        numeroTarjeta: null,
        montoTotal: input.montoTotal.toString(),
        montoTotalSujetoIva: input.montoTotalSujetoIva.toString(),
        codigoMoneda: input.codigoMoneda,
        tipoCambio: input.tipoCambio.toString(),
        montoTotalMoneda: input.montoTotal.toString(),
        montoGiftCard: "0.0",
        descuentoAdicional: input.descuentoAdicional || 0,
        codigoExcepcion: input.codigoExcepcion || 1,
        cafc: input.cafc || null,
        leyenda: input.leyenda,
        usuario: input.usuario,
        codigoDocumentoSector: input.codigoDocumentoSector
      }
    },
    facturaCompraVentaBon: null,
    facturaAlquiler: null,
    facturaEntidadFinanciera: null,
    facturaColegio: null,
    notaMonedaExtranjera: null,
    notaCreditoDebito: null,
    facturaSeguros: null,
    facturaComercialExportacionServicio: null
  };
}

router.post("/registrarContingenciaAxon", async function (req, res) {
  try {
    var currentMongoose = req.currentMongoose;
    if (!currentMongoose || !req.body.invoices) {
      return res.status(404).json({ error: "Connection mongoose not found or missing invoices" });
    }

    let invoicesPromises = [];
    let codigoSucursal = req.body.codigoSucursal;
    let codigoPuntoVenta = req.body.codigoPuntoVenta;

    const subsidiary = await Subsidiary(currentMongoose).findOne({ codigoSucursal: req.body.codigoSucursal, codigoPuntoVenta: req.body.codigoPuntoVenta })

    let numeroFactura = 0;
    if (req.body && req.body.invoices && req.body.invoices.length) {
      const invoice = req.body.invoices[req.body.invoices.length - 1];
      const factura = invoice.facturaCompraVentaBon || invoice.facturaCompraVenta || invoice.facturaAlquiler || invoice.facturaEntidadFinanciera;
      numeroFactura = factura.cabecera.numeroFactura + 1;
    }
    const data = {
      codigoPuntoVenta: req.body.codigoPuntoVenta,
      codigoSucursal: req.body.codigoSucursal,
      codigoMotivoEvento: req.body.codigoMotivoEvento || 1
    }
    req.body.invoices.forEach((invoice, i) => {
      // Extract data from invoice structure
      const factura = invoice.facturaCompraVentaBon || invoice.facturaCompraVenta || invoice.facturaAlquiler || invoice.facturaEntidadFinanciera;
      if (!factura) return; // Skip if no valid factura found

      const cabecera = factura.cabecera;

      const currentInvoiceDate = moment(cabecera.fechaEmision, 'YYYYMMDDHHmmssSSS').toDate() || null;
      const formattedInvoice = {
        orderId: "EXTERNAL",
        status: invoice.contingencia ? 0 : 1, // Set status 0 if contingencia = true
        cuis: invoice.proceso?.cuis || null,
        cufd: invoice.cufd || null,
        cuf: invoice.cuf || null,
        nitEmisor: cabecera.nitEmisor || null,
        razonSocialEmisor: cabecera.razonSocialEmisor || null,
        codigoSucursal: cabecera.codigoSucursal || 0,
        codigoPuntoVenta: cabecera.codigoPuntoVenta || 0,
        direccion: cabecera.direccion || null,
        telefono: cabecera.telefono || null,
        municipio: cabecera.municipio || null,
        numeroFactura: cabecera.numeroFactura || null,
        nombreRazonSocial: cabecera.nombreRazonSocial || null,
        numeroDocumento: cabecera.numeroDocumento || null,
        leyenda: cabecera.leyenda || null,
        fechaEmision: currentInvoiceDate,
        codigoTipoDocumentoIdentidad: cabecera.codigoTipoDocumentoIdentidad || null,
        montoTotal: cabecera.montoTotal || null,
        montoTotalSujetoIva: cabecera.montoTotalSujetoIva || null,
        codigoMoneda: cabecera.codigoMoneda || null,
        tipoCambio: cabecera.tipoCambio || null,
        montoTotalMoneda: cabecera.montoTotalMoneda || null,
        codigoDocumentoSector: cabecera.codigoDocumentoSector || null,
        tipoFacturaDocumento: invoice.proceso?.codigoTipoFactura || 1,
        codigoEmision: invoice.codigoEmision || null,
        codigoCliente: cabecera.codigoCliente || null,
        codigoMetodoPago: cabecera.codigoMetodoPago || null,
        detalle: factura.detalle || [],
        emailToSend: "",
        createdBy: req.auth ? req.auth.username : "",
        createdOn: new Date(),
        updatedOn: new Date(),
        idDocFiscalERP: invoice.idDocFiscalERP || null,
        codigoMotivo: invoice.codigoMotivo || null
      };
      invoice.cuf = GenerateInvoiceOnline.generateCuf({ tcFactura: formattedInvoice }, subsidiary);
      formattedInvoice.fechaEmision = currentInvoiceDate;
      // Set codigoSucursal and codigoPuntoVenta for update
      codigoSucursal = cabecera.codigoSucursal || 0;
      codigoPuntoVenta = cabecera.codigoPuntoVenta || 0;

      // Save formatted invoice
      const emitedInvoice = new EmitedInvoice(currentMongoose)(formattedInvoice);
      invoicesPromises.push(emitedInvoice.save());

      if (i == 0) {
        data.fechaHoraInicioEvento = Utilities.getBolivianInvoiceDateFormat(formattedInvoice.fechaEmision);
      }
      if (i == req.body.invoices.length - 1) {
        data.fechaHoraFinEvento = moment(formattedInvoice.fechaEmision).add(1, "seconds").toISOString();
      }
    });

    var currentMongoose = req.currentMongoose;
    var codigos = new Operaciones({});
    const registroSignificativo = await codigos.registroEventoSignificativo(currentMongoose, data);
    if (!registroSignificativo) {
      const response = apiFunctions.errorResponse(null, "Error guardando registro evento.", error.message);
      res.status(403).json(response);
      return;
    }
    // Wait for all invoices to be saved
    const savedInvoices = await Promise.all(invoicesPromises);
    const paqueteFacturasBody = {
      info: {
        codigoSucursal: registroSignificativo.codigoSucursal,
        codigoPuntoVenta: registroSignificativo.codigoPuntoVenta,
        codigoDocumentoSector: savedInvoices[0].codigoDocumentoSector,
        cuis: registroSignificativo.cuis,
        cufd: registroSignificativo.cufd,
        cufdEvento: registroSignificativo.cufdEvento,
        tipoFacturaDocumento: savedInvoices[0].tipoFacturaDocumento,
        cantidadFacturas: savedInvoices.length,
        codigoEvento: registroSignificativo.codigoRecepcionEventoSignificativo,
        fechaEnvio: moment().tz("America/La_Paz").format('YYYY-MM-DD'),
        horaEnvio: moment().tz("America/La_Paz").format('HH:mm:ss.SSS'),
        codigoMotivoEvento: registroSignificativo.codigoMotivoEvento || 1,
        cafc: req.body.cafc || "",
      },
      invoices: savedInvoices
    }

    const folderName = moment(`${paqueteFacturasBody.info.fechaEnvio}T${paqueteFacturasBody.info.horaEnvio}`).toDate().getTime();
    const facturacion = new Facturacion();

    // Get merchant configuration
    const merchantConfig = await MerchantConfig(currentMongoose).findOne().select();
    paqueteFacturasBody.merchantConfig = merchantConfig;

    paqueteFacturasBody.invoices = paqueteFacturasBody.invoices.map(x => {
      const xmlData = GenerateInvoiceOnline.generateXmlData(x);
      x.xml = GenerateInvoiceOnline.generateInvoiceXML(xmlData, subsidiary, x.cuf);
      return x;
    })

    // Generate invoice files
    const generatedInvoices = await facturacion.generateInvoiceFiles(paqueteFacturasBody, folderName);
    const zipName = `${folderName}.zip`;

    // Compress invoices and get hash
    const hash256 = await facturacion.compressInvoicesFolderAndGetHash256(zipName, generatedInvoices.map(x => x.xmlFilePath));

    // Read the compressed file and prepare data
    const archivo = fs.readFileSync(zipName);
    const dataInfo = {
      ...paqueteFacturasBody.info,
      archivo: archivo.toString('base64'),
      hashArchivo: hash256
    };

    // Send invoice package reception
    const result = await facturacion.recepcionPaqueteFactura(currentMongoose, dataInfo);

    // Update status for emitted invoices
    const emitedInvoiceIds = paqueteFacturasBody.invoices.map(x => new mongoose.Types.ObjectId(x.emitedInvoice._id));
    await EmitedInvoice(currentMongoose).updateMany(
      { _id: { $in: emitedInvoiceIds } },
      { $set: { status: 1 } }
    );

    // Cleanup files
    await cleanUpFiles(zipName, generatedInvoices, currentMongoose);

    // Update Subsidiary with the latest numeroFactura
    await Subsidiary(currentMongoose).updateOne(
      { codigoSucursal: Utilities.convertToNumberIfNeeded(data.codigoSucursal), codigoPuntoVenta: Utilities.convertToNumberIfNeeded(data.codigoPuntoVenta) },
      { $set: { numeroFactura } }
    );

    res.send(result);
  } catch (error) {
    console.log("registrarContingenciaAxon: Error: ", error)
    res.status(403).json({ error: "Error saving contingency invoices", details: error.message });
  }
});

// 🔹 Utility function to cleanup files and send emails
async function cleanUpFiles(zipName, generatedInvoices, currentMongoose) {
  return new Promise((resolve, reject) => {
    fs.unlink(zipName, async () => {
      try {
        for (const invoice of generatedInvoices) {
          await mailer.sendEmitedInvoice(currentMongoose, invoice);
          fs.unlink(invoice.xmlFilePath, () => { });
        }
        resolve(true);
      } catch (error) {
        console.error("Error during file cleanup:", error);
        reject(error);
      }
    });
  });
}

function fillInvoiceFromAxonelBody(proceso) {
  const facturaCompraVenta = proceso.facturaCompraVenta;
  let validDates = { fechaEmision: null, horaEmision: null };

  if (facturaCompraVenta.cabecera && facturaCompraVenta.cabecera.fechaEmision) {
    validDates = Utilities.transformFechaEmision(facturaCompraVenta.cabecera.fechaEmision);
  }

  // Se extraen los datos de la cabecera
  const tcFactura = {
    codigoEmision: 1,
    numeroDocumento: facturaCompraVenta.cabecera?.numeroDocumento || null,
    nombreRazonSocial: facturaCompraVenta.cabecera?.nombreRazonSocial || null,
    fechaEmision: validDates.fechaEmision || null, // YYYY-MM-DD
    horaEmision: validDates.horaEmision || null, // HH:MM:SS.sss
    codigoTipoDocumentoIdentidad: facturaCompraVenta.cabecera?.codigoTipoDocumentoIdentidad || null,
    correoCliente: "", // No presente en `facturaCompraVenta`, se deja vacío
    codigoMetodoPago: facturaCompraVenta.cabecera?.codigoMetodoPago || null,
    montoTotal: facturaCompraVenta.cabecera?.montoTotal ? parseFloat(facturaCompraVenta.cabecera.montoTotal) : null,
    codigoExcepcion: facturaCompraVenta.cabecera?.codigoExcepcion || null,
    usuario: facturaCompraVenta.cabecera?.usuario || null,
    codigoCliente: facturaCompraVenta.cabecera?.codigoCliente || null,
    leyenda: facturaCompraVenta.cabecera?.leyenda || null,
    cuf: proceso.cuf || null,
    idDocFiscalERP: proceso.idDocFiscalERP,
    numeroFactura: facturaCompraVenta.proceso && facturaCompraVenta.proceso.idDocFiscalFEEL ? facturaCompraVenta.proceso.idDocFiscalFEEL : facturaCompraVenta.cabecera?.numeroFactura || undefined
  };

  // Obtener todos los campos presentes en `detalle`
  const allDetailKeys = new Set();
  facturaCompraVenta.detalle.forEach(detalle => {
    Object.keys(detalle).forEach(key => allDetailKeys.add(key));
  });

  // Se extraen los datos del detalle asegurando que TODOS los campos estén incluidos
  const tcFacturaDetalle = facturaCompraVenta.detalle.map(detalle => {
    let detalleCompleto = {};
    allDetailKeys.forEach(key => {
      detalleCompleto[key] = detalle[key] !== undefined ? detalle[key] : null;
    });
    return detalleCompleto;
  });

  // Identificar valores que no se agregaron porque no están en `tcFactura`
  const missingValues = {};
  const tcFacturaKeys = Object.keys(tcFactura);
  const tcFacturaDetalleKeys = Array.from(allDetailKeys);

  Object.keys(facturaCompraVenta.cabecera).forEach(key => {
    if (!tcFacturaKeys.includes(key)) {
      missingValues[key] = facturaCompraVenta.cabecera[key];
    }
  });

  facturaCompraVenta.detalle.forEach((detalle, index) => {
    Object.keys(detalle).forEach(key => {
      if (!tcFacturaDetalleKeys.includes(key)) {
        if (!missingValues[`detalle_${index}`]) {
          missingValues[`detalle_${index}`] = {};
        }
        missingValues[`detalle_${index}`][key] = detalle[key];
      }
    });
  });

  return { tcFactura, tcFacturaDetalle, missingValues };
}

module.exports = router;
