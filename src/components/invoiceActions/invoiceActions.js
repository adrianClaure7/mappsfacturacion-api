var express = require("express");
var router = express.Router();
var MerchantConfig = require("../merchantConfigs/merchantConfig.model");
var Order = require("../orders/order.model");
var Subsidiary = require("../subsidiarys/subsidiary.model");
var Product = require("../products/product.model");
var Dsig = require('../api/dsig');
var zlib = require('node:zlib');
var sha256File = require('sha256-file');
const fs = require('fs');
const archiver = require('archiver');
const CustomerNIT = require("../customerNITs/customerNIT.model");

var Facturacion = require("../onlineInvoices/soap/facturacion");
var Codigos = require("../onlineInvoices/soap/codigos");
var Sincronizacion = require("../onlineInvoices/soap/sincronizacion");
const Operaciones = require("../onlineInvoices/soap/operaciones");
const EmitedInvoice = require("../emitedInvoices/emitedInvoice.model");
const Servicios = require('../api/servicio/servicio');
const Servicio = new Servicios();
const moment = require('moment-timezone');
const Mailer = require("../mailer");
const PDFGenerator = require("../api/servicio/generators/pdfGenerator");
let mailer = new Mailer();

var mongoose = require('mongoose');
const { generateInvoice } = require("../api/servicio/generators/generateInvoice");
const GenerateInvoiceOnline = require("../api/servicio/generators/generateInvoice");
const Utilities = require("../../commons/utilities");
const InvoiceGenerator = require("./invoiceGenerator");
const logger = require("../../commons/logger");
const ToGenerateInvoice = require("../toGenerateInvoices/toGenerateInvoice.model");

router.post("/getSubsidiaryDataToInvoice", async function (req, res) {
  // Generate control code
  var currentMongoose = req.currentMongoose;
  const body = req.body;
  if (currentMongoose && body.code) {
    try {
      const merchantConfig = await MerchantConfig(currentMongoose).findOne().select('facturacion businessName');
      const subsidiary = await Subsidiary(currentMongoose).findOne({ code: body.code });
      const product = await Product(currentMongoose).findOne({ code: body.productCode })
      var codigos = new Sincronizacion({});
      var data = {
        configInvoice: merchantConfig.facturacion,
        businessName: merchantConfig.businessName,
        subsidiary
      }
      if (product) {
        const leyenda = await codigos.getLeyenda(currentMongoose, subsidiary, product.economicActivity);
        data.leyenda = leyenda;

        res.send(data);
      } else {
        res.send(data);
      }
    } catch (err) {
      res.status(403).json({ error: err });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
})

router.get("/getInvoiceInfoByOrderId/:orderId", function (req, res) {
  // Generate control code
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose)
      .findOne()
      .select('facturacion businessName')
      .then(merchantConfig => {
        Order(currentMongoose)
          .findById(req.params.orderId)
          .then(order => {
            Subsidiary(currentMongoose).findOne({ codigoSucursal: order.codigoSucursal, codigoPuntoVenta: order.codigoPuntoVenta })
              .then(subsidiary => {
                var data = {
                  configInvoice: merchantConfig.facturacion,
                  businessName: merchantConfig.businessName,
                  order,
                  subsidiary
                }
                var codigos = new Sincronizacion({});
                codigos.getMetodosDePagoDisponibles(currentMongoose, subsidiary).then(paymentMethods => {
                  data.paymentMethods = paymentMethods;
                  codigos.getLeyenda(currentMongoose, subsidiary, order.orderDetails[0].economicActivity).then(leyenda => {
                    data.leyenda = leyenda;
                    codigos.getParametricaTipoDocumentoIdentidad(currentMongoose, subsidiary).then(listaTiposDocumentoIdentidad => {
                      data.listaTiposDocumentoIdentidad = listaTiposDocumentoIdentidad || [];
                      res.json(data);
                    }).catch(err => {
                      res.status(403).send(err);
                    })
                  }).catch(err => {
                    res.status(403).send(err);
                  })
                }).catch(err => {
                  res.status(403).send(err);
                })
              })
              .catch(err => {
                res.status(403).json(err);
              });
          })
          .catch(err => {
            res.status(403).json(err);
          });
      })
      .catch(err => {
        res.status(403).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/signXML", function (req, res) {
  // Generate control code
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    var xmlObject = req.body;
    try {
      try {
        const signer = new Dsig('src/commons/certificates/ISRAELANTONIOCABRERASANCHEZ.p12', '4994872');
        const signedXML = signer.signXML(xmlObject.xml);
        res.json(signedXML)
      } catch (e) {
        console.error(e);
        res.status(403).json(e);
      } finally {
        dsig.closeSession();
      }
    } catch (e) {
      res.status(403).json(e);
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/compressAndGetHash", function (req, res) {
  // Generate control code
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      var fileName = 'xml';
      var filePath = `${fileName}.xml`;
      fs.writeFile(`./${filePath}`, req.body.xml, function () {
        const stream = fs.createReadStream(`./${filePath}`);
        var gzip = zlib.createGzip()
        stream
          .pipe(gzip)
          .pipe(fs.createWriteStream(`${filePath}.gz`))
          .on("finish", () => {
            logger.info(`Successfully compressed the file at ${filePath}`)
            sha256File(`${filePath}.gz`, function (error, hash256) {
              if (error) res.status(403).json(error);
              else {
                var data = {
                  archivo: gzip,
                  hashArchivo: hash256
                }
                res.send(data);
              }
            })
          });
      })
    } catch (err) {
      res.status(403).json(err);
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});
router.post("/recepcionFactura", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    const data = req.body;

    if (!currentMongoose || !data.emitedInvoice) {
      return res.status(404).json("Connection mongoose not found");
    }

    const codigoSucursal = data.emitedInvoice?.codigoSucursal || "0";
    const codigoPuntoVenta = data.emitedInvoice?.codigoPuntoVenta || "0";
    const filterSubsidiary = {
      codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal),
      codigoPuntoVenta: Utilities.convertToNumberIfNeeded(codigoPuntoVenta),
    };

    try {
      const subsidiary = await Subsidiary(currentMongoose).findOneAndUpdate(filterSubsidiary, { $inc: { numeroFactura: 1 } }).lean();

      if (!subsidiary) {
        return res.status(404).json({ error: "Subsidiary not found" });
      }

      const dataInvoice = { tcFactura: data.emitedInvoice };
      dataInvoice.tcFactura.fechaEmision = data.fechaEnvio;
      dataInvoice.tcFactura.horaEmision = data.horaEnvio;
      data.emitedInvoice.fechaEnvio = data.fechaEnvio;
      data.emitedInvoice.horaEnvio = data.horaEnvio;
      subsidiary.numeroFactura--;
      data.emitedInvoice.CUF = GenerateInvoiceOnline.generateCuf(dataInvoice, subsidiary);
      data.emitedInvoice.cuf = data.emitedInvoice.CUF;
      data.emitedInvoice.numeroFactura = subsidiary.numeroFactura;

      const emitedInvoice = new EmitedInvoice(currentMongoose)(data.emitedInvoice);
      const result = await GenerateInvoiceOnline.generateXmlAndPdfFromEmitedInvoice(currentMongoose, data.emitedInvoice, subsidiary);
      const dataBase = await GenerateInvoiceOnline.xmlToBase64(result.xmlData, emitedInvoice.cuf);

      Object.assign(data.emitedInvoice, {
        archivo: dataBase.archivo.toString("base64"),
        hashArchivo: dataBase.hashArchivo,
        FacturaXML: dataBase.xmlBase64,
      });

      if (data.codigoEmision === 2) {
        if (data.emitedInvoice.numeroDocumento && data.emitedInvoice.nombreRazonSocial) {
          const options = { upsert: true, new: true, setDefaultsOnInsert: true };
          const customerNIT = { numeroDocumento: data.emitedInvoice.numeroDocumento, nombreRazonSocial: data.emitedInvoice.nombreRazonSocial };
          await CustomerNIT(currentMongoose).findOneAndUpdate({ numeroDocumento: customerNIT.numeroDocumento }, customerNIT, options);
        }

        emitedInvoice.status = 0;

        try {
          const resp = await emitedInvoice.save();
          const merchantConfig = await MerchantConfig(currentMongoose).findOne().select("facturacion");
          resp.merchantConfig = merchantConfig;

          const pdfData = await PDFGenerator.createInvoicePDF(resp);
          const emitedInvoiceResponse = Utilities.copyObject(resp);
          emitedInvoiceResponse.pdfBase64 = pdfData.pdfBase64;
          emitedInvoiceResponse.xmlData = data.xml;

          await mailer.sendEmitedInvoice(currentMongoose, emitedInvoiceResponse);
          res.send(resp);
        } catch (err) {
          await Subsidiary(currentMongoose).updateOne(
            {
              codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal),
              codigoPuntoVenta: Utilities.convertToNumberIfNeeded(codigoPuntoVenta),
            },
            { $inc: { numeroFactura: -1 } }
          );
          res.status(403).json({ error: err.message });
        }
      } else {
        try {
          const result = await new Facturacion({}).recepcionFactura(currentMongoose, data.emitedInvoice);
          data.emitedInvoice.id = emitedInvoice.id;
          await emitedInvoice.save();

          data.emitedInvoice.merchantConfig = result.merchantConfig;
          await mailer.sendEmitedInvoice(currentMongoose, data.emitedInvoice);
          res.send(emitedInvoice);
        } catch (err) {
          await Subsidiary(currentMongoose).updateOne(
            {
              codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal),
              codigoPuntoVenta: Utilities.convertToNumberIfNeeded(data.codigoPuntoVenta || 0),
            },
            { $inc: { numeroFactura: -1 } }
          );
          res.status(403).json({ error: err.message });
        }
      }
    } catch (err) {
      res.status(403).json({ error: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

router.post("/recepcionMasivaFactura", function (req, res) {
  // Generate control code
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      var folderName = 'XMLs';
      var dir = `./${folderName}`;

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      var fileName = 'xml';
      var filePath = `${folderName}/${fileName}.xml`;

      fs.writeFile(`./${filePath}`, req.body.xml, function (err) {
        if (err) {
          res.status(403).send(err);
        } else {
          var zipName = `${folderName}.zip`;
          var outputZip = fs.createWriteStream(zipName);
          var archive = archiver('tar', {
            gzip: true,
            zlib: { level: 9 } // Sets the compression level.
          });

          archive.on('error', function (err) {
            res.status(403).send(err);
          });

          // pipe archive data to the output file
          archive.pipe(outputZip);

          // append files
          archive.file(filePath, { name: filePath });

          // Wait for streams to complete
          archive.on("finish", () => {
            sha256File(zipName, function (error, hash256) {
              var archivo = fs.readFileSync(zipName);
              if (error) res.status(403).json(error);
              else {
                var facturacion = new Facturacion({});
                var data = req.body;
                data.archivo = archivo.toString('base64');
                data.hashArchivo = hash256;
                facturacion.recepcionMasivaFactura(currentMongoose, data).then(result => {
                  res.send(result);
                }).catch(err => {
                  res.status(403).send(err);
                })
              }
            })
          });

          // Wait for streams to complete
          archive.finalize();

        }
      })
    } catch (err) {
      res.status(403).json(err);
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/recepcionPaqueteFactura", async (req, res) => {
  const currentMongoose = req.currentMongoose;
  if (!currentMongoose) {
    return res.status(404).json({ error: "Connection mongoose not found" });
  }

  try {
    const data = req.body;
    const folderName = moment(`${data.info.fechaEnvio}T${data.info.horaEnvio}`).toDate().getTime();
    const facturacion = new Facturacion();

    // Get merchant configuration
    const merchantConfig = await MerchantConfig(currentMongoose).findOne().select();
    data.merchantConfig = merchantConfig;

    // Generate invoice files
    const generatedInvoices = await facturacion.generateInvoiceFiles(data, folderName);
    const zipName = `${folderName}.zip`;

    // Compress invoices and get hash
    const hash256 = await facturacion.compressInvoicesFolderAndGetHash256(zipName, generatedInvoices.map(x => x.xmlFilePath));

    // Read the compressed file and prepare data
    const archivo = fs.readFileSync(zipName);
    const dataInfo = {
      ...data.info,
      archivo: archivo.toString('base64'),
      hashArchivo: hash256
    };

    // Send invoice package reception
    const result = await facturacion.recepcionPaqueteFactura(currentMongoose, dataInfo);

    // Update status for emitted invoices
    const emitedInvoiceIds = data.invoices.map(x => mongoose.Types.ObjectId(x.emitedInvoice._id));
    await EmitedInvoice(currentMongoose).updateMany(
      { _id: { $in: emitedInvoiceIds } },
      { $set: { status: 1 } }
    );

    // Cleanup files
    await cleanUpFiles(zipName, generatedInvoices, currentMongoose);

    res.send(result);
  } catch (err) {
    console.error("Error processing invoice package:", err);
    res.status(403).json({ error: "Invoice processing failed", details: err.message });
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

router.post("/anulacionFactura", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const user = req.auth;
    const facturacion = new Facturacion({});
    const data = req.body;

    try {
      // Process invoice cancellation
      const subsidiary = await Subsidiary(currentMongoose).findOne({ codigoPuntoVenta: data.codigoPuntoVenta, codigoSucursal: data.codigoSucursal }).lean();
      const result = await facturacion.anulacionFactura(currentMongoose, data, subsidiary, user ? user.username : '');

      // Generate PDF for the canceled invoice
      const pdfData = await PDFGenerator.createInvoicePDF(result, true);
      result.pdfBase64 = pdfData.pdfBase64;

      try {
        // Send cancellation email
        await mailer.sendCancelEmitedInvoice(currentMongoose, result);
      } catch (emailError) {
        console.error("Failed to send cancellation email:", emailError);
      }
      res.send(result);
    } catch (pdfError) {
      console.error("Failed to generate PDF:", pdfError);
    }

  } catch (error) {
    res.status(403).json({ error: `Invoice cancellation failed, ${error.error}`, details: error.message });
  }
});

router.post("/reversionFactura", function (req, res) {
  // Generate control code
  var currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    var facturacion = new Facturacion({});
    var data = req.body;
    facturacion.reversionAnulacionFactura(currentMongoose, data, user ? user.username : '').then(result => {
      PDFGenerator.createInvoicePDF(result).then((pdfData) => {
        result.pdfBase64 = pdfData.pdfBase64;
        mailer.sendEmitedInvoice(currentMongoose, result).then(() => {
          res.send(result);
        }).catch(err => {
          res.send(result);
        })
      }).catch(err => {
        res.status(403).send(err);
      })
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST: added 
// body: codigoSucursal, subsidiaryCode,   
router.post("/generateCUISMasivo", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose && req.body && req.body.subsidiaryCode) {
    var codigos = new Codigos({});
    codigos.generateCuisMasivo(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST: added 
// body: codigoSucursal, subsidiaryCode,   
router.post("/generateCUFD", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose && req.body && req.body.subsidiaryCode && req.body.cuis) {
    var codigos = new Codigos({});
    codigos.generateCufd(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST: added 
// body: codigoSucursal, subsidiaryCode,   
router.post("/generateCUFDMasivo", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose && req.body && req.body.subsidiaryCode && req.body.cuis) {
    var codigos = new Codigos({});
    codigos.generateCufdMasivo(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getVerificarComunicacionCodigos", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Codigos({});
    codigos.getVerificarComunicacion(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getFechaHora", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getFechaHora(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getListaProductosServicios", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ListaProductosServicios', currentMongoose, req.body, 'ListaProductos', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getListaActividades", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('Actividades', currentMongoose, req.body, 'ListaActividades').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getListaActividadesDocumentoSector", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ListaActividadesDocumentoSector', currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getListaLeyendasFactura", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ListaLeyendasFactura', currentMongoose, req.body, 'ListaParametricasLeyendas', 'listaLeyendas').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getListaMensajesServicios", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ListaMensajesServicios', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaEventosSignificativos", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaEventosSignificativos', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaPaisOrigen", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaPaisOrigen', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoDocumentoIdentidad", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoDocumentoIdentidad', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoDocumentoSector", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoDocumentoSector', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoEmision", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoEmision', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoHabitacion", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoHabitacion', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoMetodoPagoAuth", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoMetodoPago', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      let list = [];
      if (result && result.length > 0) {
        list = result.filter(x => {
          return x.codigoClasificador == 1
            // || x.codigoClasificador == 5
            || x.codigoClasificador == 7
            || x.codigoClasificador == 33;
        })
      }
      list.sort((a, b) => a.codigoClasificador - b.codigoClasificador);
      res.send(list);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoMetodoPago", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoMetodoPago', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoMoneda", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoMoneda', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTipoPuntoVenta", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTipoPuntoVenta', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaTiposFactura", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaTiposFactura', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaUnidadMedida", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaUnidadMedida', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getParametricaMotivoAnulacion", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getLista('ParametricaMotivoAnulacion', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/getVerificarComunicacion", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.getVerificarComunicacion(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/verificarNit", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Codigos({});
    codigos.verificarNit(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});



// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/registroEventoSignificativo", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Operaciones({});
    codigos.registroEventoSignificativo(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/registroPuntoVenta", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Operaciones({});
    codigos.registroPuntoVenta(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// POST:  
// body: codigoSucursal, subsidiaryCode,  cuis
router.post("/sendInvoiceEmail/:invoiceId", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    EmitedInvoice(currentMongoose).findById(req.params.invoiceId).then(emitedInvoice => {
      Subsidiary(currentMongoose).findOne({
        codigoSucursal: emitedInvoice.codigoSucursal,
        codigoPuntoVenta: emitedInvoice.codigoPuntoVenta
      }).then(subsidiary => {
        if (emitedInvoice && subsidiary) {
          GenerateInvoiceOnline.generateXmlAndPdfFromEmitedInvoice(currentMongoose,
            emitedInvoice, subsidiary).then(result => {
              result.emailToSend = req.body.emailToSend || result.emailToSend;
              mailer.sendEmitedInvoice(currentMongoose, result).then(() => {
                res.send(result);
              });
            }).catch(err => {
              res.status(403).send(err);
            })
        } else {
          res.status(403).send({ error: 'No existe a factura' })
        }
      }).catch(err => {
        res.status(403).send(err);
      })
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// ENDPOINTS PARA COMPLETAR FASE DE PRUEBAS
// Etapa I - Obtención de CUIS
router.post("/generateCUIS", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose && req.body && req.body.subsidiaryCode) {
    var codigos = new Codigos({});
    codigos.generateCuis(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE PRODUCTOS Y SERVICIOS
router.post("/passTestGetListaProductosServicios", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ListaProductosServicios', currentMongoose, req.body, 'ListaProductos', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE ACTIVIDADES
router.post("/passTestGetListaActividades", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('Actividades', currentMongoose, req.body, 'ListaActividades').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// FECHA Y HORA ACTUAL
router.post("/passTestGetFechaHora", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetFechaHora(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE ACTIVIDADES DOCUMENTO SECTOR
router.post("/passTestGetListaActividadesDocumentoSector", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ListaActividadesDocumentoSector', currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE LEYENDAS DE FACTURAS
router.post("/passTestGetListaLeyendasFactura", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ListaLeyendasFactura', currentMongoose, req.body, 'ListaParametricasLeyendas', 'listaLeyendas').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
//  LISTADO TOTAL DE MENSAJES DE SERVICIOS
router.post("/passTestgetListaMensajesServicios", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ListaMensajesServicios', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE EVENTOS SIGNIFICATIVOS
router.post("/passTestGetParametricaEventosSignificativos", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaEventosSignificativos', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE MOTIVO DE ANULACIÓN
router.post("/passTestGetParametricaMotivoAnulacion", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaMotivoAnulacion', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE PAÍSES
router.post("/passTestGetParametricaPaisOrigen", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaPaisOrigen', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPOS DE DOCUMENTO DE IDENTIDAD
router.post("/passTestGetParametricaTipoDocumentoIdentidad", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoDocumentoIdentidad', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPOS DE DOCUMENTO SECTOR
router.post("/passTestGetParametricaTipoDocumentoSector", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoDocumentoSector', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPO EMISIÓN
router.post("/passTestGetParametricaTipoEmision", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoEmision', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPO HABITACIÓN
router.post("/passTestGetParametricaTipoHabitacion", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoHabitacion', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE MÉTODO DE PAGO
router.post("/passTestGetParametricaTipoMetodoPago", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoMetodoPago', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPOS DE MONEDA
router.post("/passTestGetParametricaTipoMoneda", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoMoneda', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPOS DE PUNTO DE VENTA
router.post("/passTestGetParametricaTipoPuntoVenta", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTipoPuntoVenta', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE TIPOS DE FACTURA
router.post("/passTestGetParametricaTiposFactura", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaTiposFactura', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa II - Sincronización de Catálogos
// LISTADO TOTAL DE UNIDAD DE MEDIDA
router.post("/passTestGetParametricaUnidadMedida", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose) {
    var codigos = new Sincronizacion({});
    codigos.passTestGetLista('ParametricaUnidadMedida', currentMongoose, req.body, 'ListaParametricas', 'listaCodigos').then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


// Etapa III - Obtención CUFD
// Generacion de CUFD
router.post("/passTestGenerateCUFD", function (req, res) {
  var currentMongoose = req.currentMongoose;

  if (currentMongoose && req.body && req.body.subsidiaryCode && req.body.cuis) {
    var codigos = new Codigos({});
    codigos.passTestGenerateCufd(currentMongoose, req.body).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// 	Etapa IV - Consumo de métodos de emisión individual
// FACTURAS MAL EMITIDA
router.post("/passTestEmitirFacturaOnline", function (req, res) {
  var currentMongoose = req.currentMongoose;
  const user = req.auth;
  if (currentMongoose) {
    Servicio.passTestEmitirFacturaOnline(currentMongoose, user ? user.username : '', req.body).then(result => {
      const invoice = result.invoice;
      res.send(invoice);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// Etapa VII - Anulación
// FACTURAS MAL EMITIDA
router.post("/passTestAnularFacturaActuales", function (req, res) {
  var currentMongoose = req.currentMongoose;
  const user = req.auth;
  const body = req.body;
  if (currentMongoose) {
    var facturacion = new Facturacion({});
    facturacion.passTestAnularFacturasActuales(currentMongoose, user ? user.username : '', body.repeatTimes).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

// 	Etapa XI - Reversión
// REVERSION DE FACTURAS MAL EMITIDAS
router.post("/passTestReversionAnulacionFactura", function (req, res) {
  var currentMongoose = req.currentMongoose;
  const user = req.auth;
  const body = req.body;
  if (currentMongoose) {
    var facturacion = new Facturacion({});
    facturacion.passTestReversionAnulacionFactura(currentMongoose, user ? user.username : '', body.repeatTimes).then(result => {
      res.send(result);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/importInvoices", async (req, res) => {
  const currentMongoose = req.currentMongoose;
  const data = req.body;

  if (!currentMongoose || !Array.isArray(data.emitedInvoices)) {
    return res.status(404).json({
      message: "Connection mongoose not found or missing emitedInvoices data"
    });
  }

  try {
    // Use Promise.all to handle all save operations concurrently
    const toGenerateInvoices = await Promise.all(
      data.emitedInvoices.map(async (emitedInvoice, i) => {
        if (i == 0) {
          const merchantConfig = await MerchantConfig(currentMongoose)
            .findOne()
            .select('facturacion email businessName imgUrl phone iso2');

          // Create an instance of the InvoiceGenerator
          const invoiceGenerator = new InvoiceGenerator(currentMongoose, merchantConfig);

          const currentDate = moment().tz("America/La_Paz");
          emitedInvoice.fechaEnvio = currentDate.format('YYYY-MM-DD');
          emitedInvoice.horaEnvio = currentDate.format('HH:mm:ss.SSS');

          // Handle subsidiary update and CUF generation
          const { subsidiary, emitedInvoiceData } = await invoiceGenerator.handleSubsidiaryUpdateAndCUF(emitedInvoice);

          data.emitedInvoice = emitedInvoiceData;

          // Handle emitedInvoice processing
          const result = await invoiceGenerator.handleEmitedInvoice(data.emitedInvoice, subsidiary, false);
          return result;
        } else {
          const toGenerateInvoice = new ToGenerateInvoice(currentMongoose)(emitedInvoice);
          return toGenerateInvoice.save();
        }
      })
    );

    res.send(toGenerateInvoices);
  } catch (err) {
    logger.warn('[/importInvoices] Error:', err);
    console.error('[/importInvoices] Error:', err);
    res.status(403).json({
      message: "Error occurred while saving invoices",
      error: err.message,
    });
  }
});

router.post("/emitInvoice", async (req, res) => {
  const currentMongoose = req.currentMongoose;
  const data = req.body;

  if (currentMongoose && data.invoiceToEmit) {
    try {
      const responses = [];
      const merchantConfig = await MerchantConfig(currentMongoose)
        .findOne()
        .select('facturacion email businessName imgUrl phone iso2');

      // Create an instance of the InvoiceGenerator
      const invoiceGenerator = new InvoiceGenerator(currentMongoose, merchantConfig);

      // Handle subsidiary update and CUF generation
      const { subsidiary, emitedInvoiceData } = await invoiceGenerator.handleSubsidiaryUpdateAndCUF(data.invoiceToEmit);

      data.emitedInvoice = emitedInvoiceData;

      // Handle emitedInvoice processing
      const result = await invoiceGenerator.handleEmitedInvoice(data.emitedInvoice, subsidiary);

      responses.push(result);

      res.send(responses);
    } catch (err) {
      logger.warn('[/emitInvoice] Error:', err);
      console.log('[/emitInvoice] Error:', err);
      res.status(403).json(err);
    }
  } else {
    res.status(404).json("Connection mongoose not found or missing emitedInvoices data");
  }
});
module.exports = router;