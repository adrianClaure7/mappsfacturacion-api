var MerchantConfig = require("../../merchantConfigs/merchantConfig.model");
var InvoiceToken = require("../../invoiceTokens/invoiceToken.model");
const moment = require('moment');

var soap = require('soap');
var INVOICE_ROUTES = require("../../../commons/invoiceRoutes");
const Subsidiary = require("../../subsidiarys/subsidiary.model");
const EmitedInvoice = require("../../emitedInvoices/emitedInvoice.model");

const fs = require('fs');
const archiver = require('archiver');
var $q = require("q");
var sha256File = require('sha256-file');
const CustomerNIT = require("../../customerNITs/customerNIT.model");
const PDFGenerator = require("../../api/servicio/generators/pdfGenerator");
const Utilities = require("../../../commons/utilities");

class Facturacion {

    constructor() {

    }

    anulacionFactura(currentMongoose, data, subsidiary = undefined, username = undefined) {
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.PURCHASES_SALES : INVOICE_ROUTES.PURCHASES_SALES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        const codigoModalidad = subsidiary ? subsidiary.modalidad : merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1'
                        var SolicitudServicioAnulacionFactura = {
                            codigoAmbiente,
                            codigoSucursal,
                            codigoPuntoVenta: data.codigoPuntoVenta || 0,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoEmision: 1, // Online=1
                            codigoModalidad,
                            codigoDocumentoSector: data.codigoDocumentoSector,
                            cuis: subsidiary ? subsidiary.RespuestaCuis.codigo : data.cuis,
                            cufd: data.cufd,
                            tipoFacturaDocumento: data.tipoFacturaDocumento,
                            codigoMotivo: data.codigoMotivo || 1,
                            cuf: data.cuf
                        }

                        client.anulacionFactura({ SolicitudServicioAnulacionFactura }, async (error, result) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                if (result.RespuestaServicioFacturacion.codigoEstado == 905 && result.RespuestaServicioFacturacion.codigoDescripcion == 'ANULACION CONFIRMADA'
                                ) {
                                    try {
                                        const updatedInvoice = await EmitedInvoice(currentMongoose).findByIdAndUpdate(
                                            data._id,
                                            { canceled: true, codigoMotivo: SolicitudServicioAnulacionFactura.codigoMotivo, updatedBy: username },
                                            { new: true } // Ensures the updated document is returned
                                        ).lean();

                                        if (!updatedInvoice) {
                                            throw new Error("Emitted invoice not found or could not be updated");
                                        }

                                        updatedInvoice.merchantConfig = merchantConfig;
                                        resolve(updatedInvoice);
                                    } catch (error) {
                                        console.error("❌ Error updating EmittedInvoice:", error.message);
                                        reject(error);
                                    }
                                } else {
                                    var error = result.RespuestaServicioFacturacion.codigoDescripcion;

                                    if (result.RespuestaServicioFacturacion.mensajesList) {
                                        result.RespuestaServicioFacturacion.mensajesList.forEach(message => {
                                            error += `\n __Error Message: ${message.descripcion}`
                                        });
                                    }
                                    reject({ error: error })
                                }
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });

                    }).catch(err => {
                        reject(err);
                    })
                }).catch(err => {
                    reject(err);
                })
            }).catch(err => {
                reject(err);
            })
        })
    }

    async recepcionFactura(currentMongoose, data, merchantConfigData = undefined) {
        try {
            // Define default values for `codigoSucursal` and `codigoAmbiente`
            const codigoSucursal = data?.codigoSucursal?.toString() || '0';
            const merchantConfig = merchantConfigData || await MerchantConfig(currentMongoose).findOne().select();

            if (!merchantConfig) {
                throw new Error("MerchantConfig not found");
            }

            const codigoAmbiente = merchantConfig?.facturacion?.codigoAmbiente?.toString() || '2';
            const soapRoute = codigoAmbiente === '2' ? INVOICE_ROUTES.PURCHASES_SALES : INVOICE_ROUTES.PURCHASES_SALES_PROD;

            const client = await soap.createClientAsync(soapRoute);
            const invoiceToken = await InvoiceToken(currentMongoose).findOne().select();

            if (!invoiceToken) {
                throw new Error("InvoiceToken not found");
            }

            // Prepare the request object for recepcionFactura
            const SolicitudServicioRecepcionFactura = {
                codigoAmbiente,
                codigoSucursal,
                codigoPuntoVenta: data.codigoPuntoVenta || 0,
                codigoSistema: invoiceToken.systemCode,
                nit: merchantConfig?.facturacion?.nitEmisor?.toString() || '',
                codigoEmision: data.codigoEmision || 1, // Online=1
                codigoModalidad: merchantConfig?.facturacion?.codigoModalidad?.toString() || '1',
                codigoDocumentoSector: data.codigoDocumentoSector,
                cuis: data.cuis,
                cufd: data.cufd,
                tipoFacturaDocumento: data.tipoFacturaDocumento,
                archivo: data.archivo,
                fechaEnvio: `${data.fechaEnvio}T${data.horaEnvio}`,
                hashArchivo: data.hashArchivo,
            };

            // Make the SOAP request
            const [result] = await client.recepcionFacturaAsync(
                { SolicitudServicioRecepcionFactura },
                {},
                { apikey: `TokenApi ${invoiceToken.token}` }
            );

            // Check the response and handle success/failure
            if (result && result.RespuestaServicioFacturacion) {
                const { codigoEstado, codigoDescripcion, mensajesList } = result.RespuestaServicioFacturacion;

                if (codigoEstado === 908 && codigoDescripcion === "VALIDADA") {
                    // Save customer NIT if provided
                    if (data.emitedInvoice?.numeroDocumento && data.emitedInvoice?.nombreRazonSocial) {
                        const options = { upsert: true, new: true, setDefaultsOnInsert: true };
                        const customerNIT = {
                            numeroDocumento: data.emitedInvoice.numeroDocumento,
                            nombreRazonSocial: data.emitedInvoice.nombreRazonSocial,
                        };
                        await CustomerNIT(currentMongoose).findOneAndUpdate({ numeroDocumento: customerNIT.numeroDocumento }, customerNIT, options);
                    }

                    result.merchantConfig = merchantConfig;
                    return result; // Resolve the result
                } else {
                    console.log('[recepcionFactura] Error: ', result.RespuestaServicioFacturacion)
                    // Handle error response from the SOAP request
                    let error = codigoDescripcion;
                    if (mensajesList) {
                        mensajesList.forEach(message => {
                            error += `\n__Error Message: ${message.descripcion}`;
                            console.log(`Error Message: ${message.descripcion}`);
                        });
                    }
                    throw new Error(error);
                }
            } else {
                throw new Error("Invalid response from recepcionFactura");
            }
        } catch (err) {
            // Handle and propagate the error
            console.log(`[recepcionFactura] catch error: ${err.message || err}`)
            throw new Error(`recepcionFactura error: ${err.message || err}`);
        }
    }

    recepcionMasivaFactura(currentMongoose, data) {
        var that = this;
        // TODO: Sincronizacion => get list of products from NIT Bolivia
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.PURCHASES_SALES : INVOICE_ROUTES.PURCHASES_SALES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudServicioRecepcionMasiva = {
                            codigoAmbiente,
                            codigoSucursal,
                            codigoPuntoVenta: 0,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoEmision: 3, // Online=1
                            codigoModalidad: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1',
                            codigoDocumentoSector: data.codigoDocumentoSector,
                            cuis: data.cuis,
                            cufd: data.cufd,
                            tipoFacturaDocumento: data.tipoFacturaDocumento,
                            archivo: data.archivo,
                            fechaEnvio: data.fechaEnvio.slice(0, -1),
                            hashArchivo: data.hashArchivo,
                            cantidadFacturas: 1
                        };

                        client.recepcionMasivaFactura({ SolicitudServicioRecepcionMasiva }, (error, result) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                if (result) {
                                    if (result.RespuestaServicioFacturacion.codigoEstado == 901 && result.RespuestaServicioFacturacion.codigoDescripcion == 'PENDIENTE') {
                                        that.validacionRecepcionMasivaFactura(client, invoiceToken, SolicitudServicioRecepcionMasiva, result.RespuestaServicioFacturacion.codigoRecepcion).then(result => {
                                            resolve(result);
                                        }).catch(err => {
                                            reject(err);
                                        })
                                    } else {
                                        var error = result.RespuestaServicioFacturacion.codigoDescripcion;

                                        result.RespuestaServicioFacturacion.mensajesList.forEach(message => {
                                            error += `\n __Error Message: ${message.descripcion}`
                                        });
                                        reject({ error: error })
                                    }
                                } else {
                                    reject({ error: 'error!' });
                                }
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    }).catch(err => {
                        reject(err);
                    })
                }).catch(err => {
                    reject(err);
                })
            });
        })
    }

    validacionRecepcionMasivaFactura(client, invoiceToken, SolicitudServicioRecepcionMasiva, codigoRecepcion) {
        return new Promise((resolve, reject) => {
            var SolicitudServicioValidacionRecepcionMasiva = {
                codigoAmbiente: SolicitudServicioRecepcionMasiva.codigoAmbiente,
                codigoPuntoVenta: SolicitudServicioRecepcionMasiva.codigoPuntoVenta || 0,
                codigoSistema: SolicitudServicioRecepcionMasiva.codigoSistema,
                codigoSucursal: SolicitudServicioRecepcionMasiva.codigoSucursal,
                nit: SolicitudServicioRecepcionMasiva.nit,
                codigoEmision: SolicitudServicioRecepcionMasiva.codigoEmision,
                codigoModalidad: SolicitudServicioRecepcionMasiva.codigoModalidad,
                codigoDocumentoSector: SolicitudServicioRecepcionMasiva.codigoDocumentoSector,
                cuis: SolicitudServicioRecepcionMasiva.cuis,
                cufd: SolicitudServicioRecepcionMasiva.cufd,
                tipoFacturaDocumento: SolicitudServicioRecepcionMasiva.tipoFacturaDocumento,
                codigoRecepcion
            };
            client.validacionRecepcionMasivaFactura({ SolicitudServicioValidacionRecepcionMasiva }, (error, result) => {
                if (error) {
                    reject({ error: error ? error.message : error })
                } else {
                    if (result) {
                        if (result.RespuestaServicioFacturacion.codigoEstado == 908 && result.RespuestaServicioFacturacion.codigoDescripcion == 'VALIDADA') {
                            //await Subsidiary(currentMongoose).updateOne({ codigoSucursal }, { $inc: { numeroFactura: 1 } });
                            resolve(result);
                        } else {
                            var error = result.RespuestaServicioFacturacion.codigoDescripcion;

                            result.RespuestaServicioFacturacion.mensajesList.forEach(message => {
                                error += `\n __Error Message: ${message.descripcion}`
                            });
                            reject({ error: error })
                        }
                    } else {
                        reject({ error: 'error!' });
                    }
                }
            }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
        })
    }


    async recepcionPaqueteFactura(currentMongoose, data) {
        try {
            if (!currentMongoose) throw new Error("Mongoose connection not found");

            const codigoSucursal = data?.codigoSucursal?.toString() || '0';

            // Get Merchant Configuration
            const merchantConfig = await MerchantConfig(currentMongoose).findOne().select();
            if (!merchantConfig) throw new Error("Merchant configuration not found");

            const codigoAmbiente = merchantConfig.facturacion?.codigoAmbiente?.toString() || '2';
            const soapRoute = codigoAmbiente === '2'
                ? INVOICE_ROUTES.PURCHASES_SALES
                : INVOICE_ROUTES.PURCHASES_SALES_PROD;

            // Create SOAP Client
            const client = await soap.createClientAsync(soapRoute);

            // Get Invoice Token
            const invoiceToken = await InvoiceToken(currentMongoose).findOne().select();
            if (!invoiceToken) throw new Error("Invoice token not found");

            // Prepare Request Data
            const SolicitudServicioRecepcionPaquete = {
                codigoAmbiente,
                codigoSucursal,
                codigoPuntoVenta: data.codigoPuntoVenta || 0,
                codigoSistema: invoiceToken.systemCode,
                nit: merchantConfig.facturacion?.nitEmisor?.toString() || '',
                codigoEmision: 2, // Online=1
                codigoModalidad: merchantConfig.facturacion?.codigoModalidad?.toString() || '1',
                codigoDocumentoSector: data.codigoDocumentoSector,
                cuis: data.cuis,
                cufd: data.cufd,
                tipoFacturaDocumento: data.tipoFacturaDocumento,
                archivo: data.archivo,
                fechaEnvio: `${data.fechaEnvio}T${data.horaEnvio}`,
                hashArchivo: data.hashArchivo,
                cantidadFacturas: data.cantidadFacturas,
                codigoEvento: data.codigoEvento,
            };

            // Add CAFC if the event code is greater than 4
            if (data.codigoMotivoEvento > 4) {
                SolicitudServicioRecepcionPaquete.cafc = data.cafc;
            }

            // Call SOAP service
            const result = await client.recepcionPaqueteFacturaAsync(
                { SolicitudServicioRecepcionPaquete },
                {},
                { apikey: `TokenApi ${invoiceToken.token}` }
            );

            // Handle SOAP Response
            if (!result || (!result.RespuestaServicioFacturacion && !result.length && !result[0].RespuestaServicioFacturacion)) {
                throw new Error("Invalid response from SOAP service");
            }

            const response = result.RespuestaServicioFacturacion || result[0].RespuestaServicioFacturacion;

            if (response.codigoEstado === 901 && response.codigoDescripcion === 'PENDIENTE') {
                return await this.validacionRecepcionPaqueteFactura(client, invoiceToken, SolicitudServicioRecepcionPaquete, response.codigoRecepcion);
            }

            // Handle error messages
            if (response.mensajesList && response.mensajesList.length > 0) {
                const errorMessages = response.mensajesList.map(msg => `Error: ${msg.descripcion}`).join("\n");
                throw new Error(`SOAP Error: ${response.codigoDescripcion}\n${errorMessages}`);
            }

            return response;

        } catch (error) {
            console.error("Error in recepcionPaqueteFactura:", error);
            throw new Error(error.message || "Unknown error occurred in recepcionPaqueteFactura");
        }
    }

    generateInvoiceFiles(invoicesData, folderName) {

        return new Promise((resolve, reject) => {
            let filePromises = [];
            let pdfPromises = [];
            invoicesData.invoices.forEach(data => {
                if (!data.emitedInvoice) {
                    data.emitedInvoice = data;
                }
                var dir = `./${folderName}`;

                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
                var fileName = data && data.emitedInvoice ? data.emitedInvoice.cuf : 'xml';
                var filePath = `${folderName}/${fileName}.xml`;
                data.emitedInvoice.merchantConfig = invoicesData.merchantConfig;
                pdfPromises.push(PDFGenerator.createInvoicePDF(data.emitedInvoice))

                filePromises.push({ filePath, xmlData: data.xml });
                try {
                    fs.writeFile(`./${filePath}`, data.xml, function (err) {
                        return `./${filePath}`;
                    })
                } catch (err) {
                    reject(err);
                }

            });
            $q.all(pdfPromises)
                .then(pdfInvoices => {
                    const invoices = [];
                    pdfInvoices.forEach((pdfData, i) => {
                        pdfData.invoice.pdfBase64 = pdfData.pdfBase64;
                        pdfData.invoice.xmlData = filePromises[i].xmlData;
                        pdfData.invoice.xmlFilePath = filePromises[i].filePath;
                        invoices.push(pdfData.invoice)
                    })

                    resolve(invoices);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    // LAST
    // generateInvoiceFiles(invoicesData, folderName) {
    //     var that = this;

    //     return new Promise((resolve, reject) => {
    //         var filePromises = [];
    //         invoicesData.invoices.forEach(data => {
    //             var dir = `./${folderName}`;

    //             if (!fs.existsSync(dir)) {
    //                 fs.mkdirSync(dir);
    //             }
    //             var fileName = data && data.emitedInvoice ? data.emitedInvoice.cuf : 'xml';
    //             var filePath = `${folderName}/${fileName}.xml`;
    //             filePromises.push(filePath);
    //             try {
    //                 fs.writeFile(`./${filePath}`, data.xml, function (err) {
    //                     return `./${filePath}`;
    //                 })
    //             } catch (err) {
    //                 reject(err);
    //             }
    //         });
    //         setTimeout(() => {
    //             $q.all(filePromises)
    //                 .then(fileNames => {
    //                     resolve(fileNames);
    //                 })
    //                 .catch(err => {
    //                     reject(err);
    //                 });
    //         }, 300)
    //     });
    // }

    validacionRecepcionPaqueteFactura(client, invoiceToken, SolicitudServicioRecepcionPaquete, codigoRecepcion) {
        return new Promise((resolve, reject) => {
            var SolicitudServicioValidacionRecepcionPaquete = {
                codigoAmbiente: SolicitudServicioRecepcionPaquete.codigoAmbiente,
                codigoPuntoVenta: SolicitudServicioRecepcionPaquete.codigoPuntoVenta || 0,
                codigoSistema: SolicitudServicioRecepcionPaquete.codigoSistema,
                codigoSucursal: SolicitudServicioRecepcionPaquete.codigoSucursal,
                nit: SolicitudServicioRecepcionPaquete.nit,
                codigoEmision: SolicitudServicioRecepcionPaquete.codigoEmision,
                codigoModalidad: SolicitudServicioRecepcionPaquete.codigoModalidad,
                codigoDocumentoSector: SolicitudServicioRecepcionPaquete.codigoDocumentoSector,
                cuis: SolicitudServicioRecepcionPaquete.cuis,
                cufd: SolicitudServicioRecepcionPaquete.cufd,
                tipoFacturaDocumento: SolicitudServicioRecepcionPaquete.tipoFacturaDocumento,
                codigoRecepcion,
                // cafc: SolicitudServicioRecepcionPaquete.cafc
            };
            client.validacionRecepcionPaqueteFactura({ SolicitudServicioValidacionRecepcionPaquete }, (error, result) => {
                if (error) {
                    reject({ error: error ? error.message : error })
                } else {
                    if (result) {
                        if ((result.RespuestaServicioFacturacion.codigoEstado == 908 || result.RespuestaServicioFacturacion.codigoEstado == 901) && (result.RespuestaServicioFacturacion.codigoDescripcion == 'VALIDADA' || result.RespuestaServicioFacturacion.codigoDescripcion == 'PENDIENTE')) {
                            // await Subsidiary(currentMongoose).updateOne({ codigoSucursal }, { $inc: { numeroFactura: 1 } });
                            resolve(result);
                        } else {
                            var error = result.RespuestaServicioFacturacion.codigoDescripcion;

                            if (result.RespuestaServicioFacturacion.mensajesList) {
                                result.RespuestaServicioFacturacion.mensajesList.forEach(message => {
                                    error += `\n __Error Message: ${message.descripcion}`
                                });
                            }
                            reject({ error: error })
                        }
                    } else {
                        reject({ error: 'error!' });
                    }
                }
            }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
        })
    }

    compressInvoicesFolderAndGetHash256(zipName, generatedInvoices) {

        return new Promise((resolve, reject) => {
            var outputZip = fs.createWriteStream(zipName);
            var archive = archiver('tar', {
                gzip: true,
                zlib: { level: 9 } // Sets the compression level.
            });

            archive.on('error', function (err) {
                reject(err);
            });

            // pipe archive data to the output file
            archive.pipe(outputZip);

            generatedInvoices.forEach(generatedInvoice => {
                // append files
                archive.file(generatedInvoice, { name: generatedInvoice });
            });

            // Wait for streams to complete
            archive.on("finish", () => {
                console.log(`Successfully compressed the file at ${zipName}`)
                sha256File(zipName, function (error, hash256) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(hash256);
                    }
                })
            });

            // Wait for streams to complete
            archive.finalize();
        });
    }
    // TODO: complete facturacion electronica kkega hasta la recepcion
    async recepcionFacturaApi(currentMongoose, data, subsidiary, username, merchantConfig) {
        try {
            let codigoSucursal = subsidiary?.codigoSucursal ? `${subsidiary.codigoSucursal}` : '0';
            let codigoPuntoVenta = subsidiary?.codigoPuntoVenta ? `${subsidiary.codigoPuntoVenta}` : '0';
            const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
            const soapRoute = codigoAmbiente === '2' ? INVOICE_ROUTES.PURCHASES_SALES : INVOICE_ROUTES.PURCHASES_SALES_PROD;

            const client = await soap.createClientAsync(soapRoute);
            const invoiceToken = await InvoiceToken(currentMongoose).findOne().select();

            const SolicitudServicioRecepcionFactura = {
                codigoAmbiente,
                codigoSucursal,
                codigoPuntoVenta,
                codigoSistema: invoiceToken.systemCode,
                nit: merchantConfig.facturacion?.nitEmisor || '',
                codigoEmision: data.tcFactura.tipoEmision || data.tcFactura.codigoEmision || 1, // Online=1
                codigoModalidad: merchantConfig.facturacion?.codigoModalidad || '1',
                codigoDocumentoSector: subsidiary.codigoDocumentoSector,
                cuis: subsidiary.RespuestaCuis?.codigo || '',
                cufd: subsidiary.RespuestaCufd?.codigo || '',
                tipoFacturaDocumento: subsidiary.tipoFactura,
                archivo: data.archivo,
                fechaEnvio: `${data.tcFactura.fechaEmision}T${data.tcFactura.horaEmision}`,
                hashArchivo: data.hashArchivo
            };

            if (data.tcFactura.tipoEmision === 2) {
                await Subsidiary(currentMongoose).updateOne(
                    { codigoSucursal, codigoPuntoVenta },
                    { $inc: { numeroFactura: 1 } }
                );

                if (data.emitedInvoice?.numeroDocumento && data.emitedInvoice?.nombreRazonSocial) {
                    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
                    const customerNIT = {
                        numeroDocumento: data.emitedInvoice.numeroDocumento,
                        nombreRazonSocial: data.emitedInvoice.nombreRazonSocial
                    };
                    await CustomerNIT(currentMongoose).findOneAndUpdate({ numeroDocumento: customerNIT.numeroDocumento }, customerNIT, options);
                }

                const emitedInvoiceData = Facturacion.generateEmitedInvoice(data, subsidiary, username);
                emitedInvoiceData.emailToSend = data.tcFactura.correoCliente;

                const emitedInvoice = new EmitedInvoice(currentMongoose)(emitedInvoiceData);
                emitedInvoice.status = 0;
                if (data && data.tcFactura && data.tcFactura.idDocFiscalERP) {
                    emitedInvoice.idDocFiscalERP = data.tcFactura.idDocFiscalERP;
                }
                const savedInvoice = await emitedInvoice.save();

                return { emitedInvoice: savedInvoice };
            } else {
                return new Promise((resolve, reject) => {
                    client.recepcionFactura({ SolicitudServicioRecepcionFactura }, async (error, result) => {
                        if (error) {
                            return reject({ error: error.message });
                        }

                        if (result?.RespuestaServicioFacturacion?.codigoEstado === 908 && result?.RespuestaServicioFacturacion?.codigoDescripcion === 'VALIDADA') {
                            await Subsidiary(currentMongoose).updateOne(
                                {
                                    codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal),
                                    codigoPuntoVenta: Utilities.convertToNumberIfNeeded(codigoPuntoVenta)
                                },
                                { $inc: { numeroFactura: 1 } }
                            );

                            if (data.emitedInvoice?.numeroDocumento && data.emitedInvoice?.nombreRazonSocial) {
                                const options = { upsert: true, new: true, setDefaultsOnInsert: true };
                                const customerNIT = {
                                    numeroDocumento: data.emitedInvoice.numeroDocumento,
                                    nombreRazonSocial: data.emitedInvoice.nombreRazonSocial
                                };
                                await CustomerNIT(currentMongoose).findOneAndUpdate({ numeroDocumento: customerNIT.numeroDocumento }, customerNIT, options);
                            }

                            const emitedInvoiceData = Facturacion.generateEmitedInvoice(data, subsidiary, username);
                            emitedInvoiceData.emailToSend = data.tcFactura.correoCliente;

                            const emitedInvoice = new EmitedInvoice(currentMongoose)(emitedInvoiceData);
                            emitedInvoice.codigoRecepcion = result.RespuestaServicioFacturacion.codigoEstado;
                            emitedInvoice.codigo = result.RespuestaServicioFacturacion.codigoRecepcion;
                            emitedInvoice.listaMensajes = result.RespuestaServicioFacturacion.listaMensajes || [];
                            if (data && data.tcFactura && data.tcFactura.idDocFiscalERP) {
                                emitedInvoice.idDocFiscalERP = data.tcFactura.idDocFiscalERP;
                            }
                            const newEmitedInvoice = await emitedInvoice.save();

                            return resolve({ emitedInvoice: newEmitedInvoice, result });
                        } else {
                            let errorMsg = result?.RespuestaServicioFacturacion?.codigoDescripcion || "Unknown error";
                            if (result?.RespuestaServicioFacturacion?.mensajesList) {
                                result.RespuestaServicioFacturacion.mensajesList.forEach(message => {
                                    errorMsg += `\n __Error Message: ${message.descripcion}`;
                                });
                            }
                            return reject({ error: errorMsg });
                        }
                    }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                });
            }
        } catch (error) {
            console.error("[recepcionFacturaApi]", error.message);
            throw new Error(`Error processing invoice reception: ${error.message}`);
        }
    }

    static generateEmitedInvoice(data, subsidiary, username) {
        var emitedInvoice = {
            orderId: 'EXTERNAL',
            cuis: subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
            cufd: subsidiary && subsidiary.RespuestaCufd ? subsidiary.RespuestaCufd.codigo : '',
            cuf: data.cuf,
            nitEmisor: data.tcFactura.nitEmisor,
            razonSocialEmisor: data.tcFactura.razonSocialEmisor,
            codigoSucursal: `${subsidiary.codigoSucursal}`,
            codigoPuntoVenta: `${subsidiary.codigoPuntoVenta}`,
            direccion: data.tcFactura.direccion,
            telefono: data.tcFactura.telefono,
            municipio: data.tcFactura.municipio,
            numeroFactura: data.tcFactura.numeroFactura || subsidiary.numeroFactura,
            nombreRazonSocial: data.tcFactura.nombreRazonSocial,
            numeroDocumento: data.tcFactura.numeroDocumento,
            leyenda: data.leyenda || subsidiary.leyenda,
            fechaEmision: moment(`${data.tcFactura.fechaEmision}T${data.tcFactura.horaEmision}`).toDate(),
            codigoTipoDocumentoIdentidad: data.tcFactura.codigoTipoDocumentoIdentidad,
            montoTotal: data.tcFactura.montoTotal,
            montoTotalSujetoIva: data.tcFactura.montoTotalSujetoIva,
            codigoMoneda: data.tcFactura.codigoMoneda,
            tipoCambio: data.tcFactura.tipoCambio,
            montoTotalMoneda: data.tcFactura.montoTotal,
            descuentoAdicional: data.tcFactura.descuentoAdicional,
            usuario: username,
            codigoDocumentoSector: subsidiary.codigoDocumentoSector,
            codigoModalidad: subsidiary.codigoModalidad, //subsidiary.modalidad,
            tipoFacturaDocumento: subsidiary.tipoFactura || 1,
            codigoEmision: subsidiary.tipoEmision || 1,
            status: data.status || 1,
            detalle: data.tcFacturaDetalle,
            codigoCliente: data.tcFactura.codigoCliente,
            codigoMetodoPago: data.tcFactura.codigoMetodoPago,
            emailToSend: data.emailToSend
        };

        return emitedInvoice;
    }

    verificacionEstadoFactura(currentMongoose, data, subsidiary) {
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.PURCHASES_SALES : INVOICE_ROUTES.PURCHASES_SALES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        const codigoModalidad = subsidiary ? subsidiary.modalidad : merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1'
                        var SolicitudServicioVerificacionEstadoFactura = {
                            codigoAmbiente,
                            codigoSucursal,
                            codigoPuntoVenta: data.codigoPuntoVenta || subsidiary.codigoPuntoVenta || 0,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoEmision: 1, // Online=1
                            codigoModalidad,
                            codigoDocumentoSector: data.codigoDocumentoSector,
                            cuis: data.cuis,
                            cufd: data.cufd,
                            tipoFacturaDocumento: data.tipoFacturaDocumento,
                            cuf: data.cuf
                        }

                        client.verificacionEstadoFactura({ SolicitudServicioVerificacionEstadoFactura }, (error, result) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                resolve(result);
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });

                    }).catch(err => {
                        reject(err);
                    })
                }).catch(err => {
                    reject(err);
                })
            }).catch(err => {
                reject(err);
            })
        })
    }

    async reversionAnulacionFactura(currentMongoose, data, username = undefined) {
        try {
            const codigoSucursal = data?.codigoSucursal?.toString() || '0';
            const merchantConfig = await MerchantConfig(currentMongoose).findOne().select();
            const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
            const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.PURCHASES_SALES : INVOICE_ROUTES.PURCHASES_SALES_PROD;
            const client = await soap.createClientAsync(soapRoute);
            const invoiceToken = await InvoiceToken(currentMongoose).findOne().select();

            const SolicitudServicioReversionAnulacionFactura = {
                codigoAmbiente, codigoSucursal, codigoPuntoVenta: data.codigoPuntoVenta || 0, codigoSistema: invoiceToken.systemCode,
                nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '', codigoEmision: 1, // Online=1
                codigoDocumentoSector: data.codigoDocumentoSector, cuis: data.cuis, cufd: data.cufd,
                tipoFacturaDocumento: data.tipoFacturaDocumento, codigoModalidad: 2, cuf: data.cuf
            };

            const [result] = await client.reversionAnulacionFacturaAsync({ SolicitudServicioReversionAnulacionFactura }, {}, { apikey: `TokenApi ${invoiceToken.token}` });

            if (result.RespuestaServicioFacturacion.codigoEstado == 907 && result.RespuestaServicioFacturacion.codigoDescripcion == 'REVERSION DE ANULACION CONFIRMADA') {
                const updatedInvoice = await EmitedInvoice(currentMongoose).findByIdAndUpdate(data._id, { canceled: false, codigoMotivo: null, updatedBy: username }, { new: true }).lean();
                updatedInvoice.merchantConfig = merchantConfig;
                return updatedInvoice;
            } else {
                let error = result.RespuestaServicioFacturacion.codigoDescripcion;
                if (result.RespuestaServicioFacturacion.mensajesList) {
                    result.RespuestaServicioFacturacion.mensajesList.forEach(message => {
                        error += `\n __Error Message: ${message.descripcion}`;
                    });
                }
                throw new Error(error);
            }
        } catch (err) {
            throw err;
        }
    }


    // PASS TEST
    passTestAnularFacturasActuales(currentMongoose, username = undefined, repeatTimes = 0, emitedInvoices = undefined) {
        return new Promise((resolve, reject) => {
            if (emitedInvoices && emitedInvoices.length > 0 && repeatTimes > 0) {
                repeatTimes--;
                this.anulacionFactura(currentMongoose, emitedInvoices[repeatTimes], undefined, username).then(result => {
                    if (repeatTimes > 0) {
                        setTimeout(() => {
                            this.passTestAnularFacturasActuales(currentMongoose, username, repeatTimes, emitedInvoices)
                        }, 2000)
                    } else {
                        resolve(result);
                    }
                }).catch((error) => {
                    this.passTestAnularFacturasActuales(currentMongoose, username, repeatTimes, emitedInvoices)
                })
            } else if (!emitedInvoices) {
                EmitedInvoice(currentMongoose).find({ canceled: false, status: 1 }).limit(repeatTimes).sort({ _id: -1 }).then(emitedInvoices => {
                    let currentRepeatTimes = emitedInvoices.length;
                    currentRepeatTimes--;
                    if (currentRepeatTimes >= 0) {
                        this.anulacionFactura(currentMongoose, emitedInvoices[currentRepeatTimes], undefined, username).then(result => {
                            if (currentRepeatTimes > 0) {
                                setTimeout(() => {
                                    this.passTestAnularFacturasActuales(currentMongoose, username, currentRepeatTimes, emitedInvoices);
                                }, 2000)
                            } else {
                                resolve(result);
                            }
                        }).catch((error) => {
                            this.passTestAnularFacturasActuales(currentMongoose, username, currentRepeatTimes, emitedInvoices);
                        })
                    } else {
                        resolve();
                    }
                }).catch(err => {
                    reject(err);
                })
            } else {
                resolve();
            }
        })
    }

    passTestReversionAnulacionFactura(currentMongoose, username = undefined, repeatTimes = 0, emitedInvoices = undefined) {
        return new Promise((resolve, reject) => {
            if (emitedInvoices && emitedInvoices.length > 0 && repeatTimes > 0) {
                repeatTimes--;
                this.reversionAnulacionFactura(currentMongoose, emitedInvoices[repeatTimes], username).then(result => {
                    if (repeatTimes > 0) {
                        setTimeout(() => {
                            this.passTestReversionAnulacionFactura(currentMongoose, username, repeatTimes, emitedInvoices)
                        }, 2000)
                    } else {
                        resolve(result);
                    }
                }).catch(() => {
                    this.passTestReversionAnulacionFactura(currentMongoose, username, repeatTimes, emitedInvoices)
                })
            } else if (!emitedInvoices) {
                EmitedInvoice(currentMongoose).find({ canceled: true, status: 1 }).limit(repeatTimes).sort({ _id: -1 }).then(emitedInvoices => {
                    let currentRepeatTimes = emitedInvoices.length;
                    currentRepeatTimes--;
                    if (currentRepeatTimes >= 0) {
                        this.reversionAnulacionFactura(currentMongoose, emitedInvoices[currentRepeatTimes], username).then(result => {
                            if (currentRepeatTimes > 0) {
                                setTimeout(() => {
                                    this.passTestReversionAnulacionFactura(currentMongoose, username, currentRepeatTimes, emitedInvoices);
                                }, 2000)
                            } else {
                                resolve(result);
                            }
                        }).catch(() => {
                            this.passTestReversionAnulacionFactura(currentMongoose, username, currentRepeatTimes, emitedInvoices);
                        })
                    } else {
                        resolve();
                    }
                }).catch(err => {
                    reject(err);
                })
            } else {
                resolve();
            }
        })
    }
}

module.exports = Facturacion;




// [
//     {
//       codigo: 1002,
//       descripcion: "EL CODIGO UNICO DE FACTURA (CUF) ENVIADO EN EL XML ES INVALIDO: CUF esperado 14E1C941EFE13ED15787FB243D42E60AB0A7F8606A62E0EC9BB38B6D74 enviado 14E1C941EFE13ED15787FB243D42E60AB0A7F8606A62E0EC9BB38B6D74 14E1C941EFE13ED15787CE5ED321CCF6F2FDD8606A42E0EC9BB38B6D74",
//     },
//     {'EL CODIGO UNICO DE FACTURA (CUF) ENVIADO EN EL XML ES INVALIDO: CUF esperado 14E1C941EFE13ED15865B89E2E211E1E3FC138606A32E0EC9BB38B6D74 enviado 14E1C941EFE13ED15865B89E2E211E1E3FC138606A32E0EC9BB38B6D74 14E1C941EFE13ED158658BA3D379115746AED8606A92E0EC9BB38B6D74'
//       codigo: 1048,
//       descripcion: "NUMERO DE DOCUMENTO NO VALIDO: Numero documento esperado distinto de 0 enviado 0",
//     },
//     {
//       codigo: 1016,
//       descripcion: "EL CODIGO DE ACTIVIDAD ECONOMICA NO ESTA HABILITADA PARA EL CONTRIBUYENTE: Actividad 1 no asociada",
//       numeroDetalle: 0,
//     },
//     {
//       codigo: 1017,
//       descripcion: "EL CODIGO DE PRODUCTO NO ESTA RELACIONADO A NINGUN ACTIVIDAD ECONOMICA DEL CONTRIBUYENTE: No existe asociacion de: actividad 1 - producto 83151",
//       numeroDetalle: 0,
//     },
//   ]