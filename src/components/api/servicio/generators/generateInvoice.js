const CufGenerator = require("./cufGenerator");
const PDFGenerator = require("./pdfGenerator");
var Dsig = require('../../dsig');

const fs = require('fs');
var zlib = require('node:zlib');
var sha256File = require('sha256-file');
var Facturacion = require("../../../onlineInvoices/soap/facturacion");
const moment = require('moment-timezone');
var MerchantConfig = require("../../../merchantConfigs/merchantConfig.model");
const Mailer = require("../../../mailer");
const Utilities = require("../../../../commons/utilities");
const Product = require("../../../products/product.model");
let mailer = new Mailer();
const InvoiceXmlSign = require("../../../invoiceXmlSigns/invoiceXmlSign.model");

class GenerateInvoiceOnline {

    static async generateXmlAndPdfFromEmitedInvoice(merchantMongoose, emitedInvoice, subsidiary, merchantConfigData = undefined) {
        try {
            // Generate XML data and XML string
            const xmlData = GenerateInvoiceOnline.generateXmlData(emitedInvoice);
            const xml = GenerateInvoiceOnline.generateInvoiceXML(xmlData, subsidiary, emitedInvoice.CUF);

            // Set the XML data on the emitedInvoice
            emitedInvoice.xmlData = xml;

            // Retrieve the merchant configuration
            const merchantConfig = merchantConfigData || await MerchantConfig(merchantMongoose).findOne().select('facturacion');

            if (!merchantConfig) {
                throw new Error("Merchant configuration not found");
            }

            // Set the merchant configuration on the emitedInvoice
            emitedInvoice.merchantConfig = merchantConfig;

            // Generate the PDF from the emitedInvoice data
            const pdfData = await PDFGenerator.createInvoicePDF(emitedInvoice);

            // Set the base64 encoded PDF on the emitedInvoice
            emitedInvoice.pdfBase64 = pdfData.pdfBase64;

            // Resolve with the updated emitedInvoice
            return emitedInvoice;

        } catch (err) {
            // Handle errors by throwing them, ensuring proper propagation
            throw new Error(`Error generating XML and PDF: ${err.message || err}`);
        }
    }


    static generateInvoice(merchantMongoose, data, subsidiary, username) {
        return new Promise((resolve, reject) => {
            MerchantConfig(merchantMongoose).findOne().select('facturacion').then(merchantConfig => {
                data.tcFactura.codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : data.tcFactura.codigoAmbiente;
                data.tcFactura.nitEmisor = merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : data.tcFactura.nitEmisor;
                data.tcFactura.codigoModalidad = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : data.tcFactura.codigoModalidad;
                data.tcFactura.razonSocialEmisor = merchantConfig.facturacion ? `${merchantConfig.facturacion.razonSocialEmisor}` : data.tcFactura.razonSocialEmisor;
                data.tcFactura.codigoPuntoVenta = `${subsidiary.codigoPuntoVenta}`;
                data.tcFactura.tipoEmision = subsidiary.tipoEmision;
                const invoice = {
                    CUF: GenerateInvoiceOnline.generateCuf(data, subsidiary),
                    Transaccion: true,
                    Estado: true,
                    TipoEmision: subsidiary.tipoEmision
                }
                data.cuf = invoice.CUF;
                const dataToXml = data.tcFactura;
                dataToXml.tcFacturaDetalle = data.tcFacturaDetalle;
                dataToXml.numeroFactura = dataToXml.numeroFactura || subsidiary.numeroFactura;

                const xmlData = GenerateInvoiceOnline.generateXmlData(dataToXml);
                dataToXml.leyenda = !dataToXml.leyenda ? subsidiary.leyenda : dataToXml.leyenda;
                const xml = GenerateInvoiceOnline.generateInvoiceXML(xmlData, subsidiary, invoice.CUF);
                dataToXml.subsidiaryName = subsidiary.code;
                dataToXml.cuf = data.cuf;
                subsidiary.numeroFactura = data.tcFactura.numeroFactura || subsidiary.numeroFactura;
                dataToXml.numeroFactura = subsidiary.numeroFactura;
                dataToXml.merchantConfig = merchantConfig;
                PDFGenerator.createInvoicePDF(dataToXml).then(async (pdfData) => {
                    invoice.FacturaPDF = pdfData.pdfBase64;
                    if (subsidiary.modalidad == 1) {
                        const invoiceXmlSign = await InvoiceXmlSign(merchantMongoose).findOne().lean();
                        GenerateInvoiceOnline.signXML(xml, invoiceXmlSign).then(signedXML => {
                            GenerateInvoiceOnline.xmlToBase64(signedXML, data.cuf).then(dataBase => {
                                data.archivo = dataBase.archivo.toString('base64');
                                data.hashArchivo = dataBase.hashArchivo;
                                invoice.FacturaXML = dataBase.xmlBase64;
                                var facturacion = new Facturacion({});
                                facturacion.recepcionFacturaApi(merchantMongoose, data, subsidiary, username, merchantConfig).then(result => {
                                    if (result && result.emitedInvoice) {
                                        invoice.FacturaNube = result.emitedInvoice._id;
                                        invoice.codigo = result.emitedInvoice.codigo;
                                        invoice.codigoRecepcion = result.emitedInvoice.codigoRecepcion;
                                        invoice.listaMensajes = result.emitedInvoice.listaMensajes || [];
                                        invoice.nitEmisor = result.emitedInvoice.nitEmisor;
                                        invoice.numeroFactura = result.emitedInvoice.numeroFactura;
                                        invoice.id = result.emitedInvoice._id;
                                    }
                                    invoice.emailToSend = data.tcFactura.correoCliente;
                                    if (!invoice.id && !invoice._id) {
                                        invoice.id = 'Facturavisual'
                                    }
                                    console.log('[generateInvoice] sendEmitedInvoice', invoice)
                                    mailer.sendEmitedInvoice(merchantMongoose, invoice).then(() => {
                                    }).catch(err => {

                                    });
                                    console.log('[generateInvoice] Resolve ', invoice)
                                    resolve({ invoice, data });
                                }).catch(err => {
                                    reject(err);
                                })
                            }).catch(err => {
                                reject(err);
                            })
                        }).catch(err => {
                            reject(err);
                        })
                    } else {
                        GenerateInvoiceOnline.xmlToBase64(xml, data.cuf).then(dataBase => {
                            data.archivo = dataBase.archivo.toString('base64');
                            data.hashArchivo = dataBase.hashArchivo;
                            invoice.FacturaXML = dataBase.xmlBase64;
                            var facturacion = new Facturacion({});
                            facturacion.recepcionFacturaApi(merchantMongoose, data, subsidiary, username, merchantConfig).then(result => {
                                if (result && result.emitedInvoice) {
                                    invoice.FacturaNube = result.emitedInvoice._id;
                                    invoice.codigo = result.emitedInvoice.codigo;
                                    invoice.codigoRecepcion = result.emitedInvoice.codigoRecepcion;
                                    invoice.listaMensajes = result.emitedInvoice.listaMensajes || [];
                                    invoice.nitEmisor = result.emitedInvoice.nitEmisor;
                                    invoice.numeroFactura = result.emitedInvoice.numeroFactura;
                                    invoice.id = result.emitedInvoice._id;
                                }
                                invoice.emailToSend = data.tcFactura.correoCliente;
                                if (!invoice.id && !invoice._id) {
                                    invoice.id = 'Facturavisual'
                                }
                                mailer.sendEmitedInvoice(merchantMongoose, invoice).then(() => {

                                }).catch(err => {

                                });
                                resolve({ invoice, data });
                            }).catch(err => {
                                reject(err);
                            })
                        }).catch(err => {
                            reject(err);
                        })
                    }
                })
            }).catch(err => {
                reject(err);
            })
        })
    }

    static signXML(xml, invoiceXmlSign) {
        // TODO: get DIGIT CERT of customer
        return new Promise(async (resolve, reject) => {
            try {
                if (!invoiceXmlSign) {
                    console.error('[signXML] Error: Necesarios certificados para firma XML')
                    reject('Error: Necesarios certificados para firma XML')
                }
                const signer = new Dsig(invoiceXmlSign.certificate, invoiceXmlSign.privateKey);
                const signedXML = await signer.signXML(xml);
                resolve(signedXML);
            } catch (e) {
                reject(e);
            }
        })
    }

    static validateAndConvertStringToJSON(data) {
        const validatedData = {
            tcEmpresa: GenerateInvoiceOnline.convertTCEmpresaStringToObject(data.tcEmpresa),
            tcPuntoVenta: GenerateInvoiceOnline.convertPuntoVentaStringToObject(data.tcPuntoVenta),
            tcFactura: GenerateInvoiceOnline.convertFacturaStringToObject(data.tcFactura),
            tcFacturaDetalle: GenerateInvoiceOnline.convertFacturaDetalleStringToObject(data.tcFacturaDetalle),
        }

        return validatedData;
    }

    static convertTCEmpresaStringToObject(inputString) {
        const [Credencial, Nit, RazonSocial, Direccion, Localidad, Telefonos] = inputString.split('ß');

        return {
            credencial: Credencial,
            nit: Nit,
            razonSocial: RazonSocial,
            direccion: Direccion,
            localidad: Localidad,
            telefonos: Telefonos
        };
    }

    static convertPuntoVentaStringToObject(inputString) {
        const [CodigoSucursal, CodigoPuntoVenta, NombreSucursal, NombrePuntoVenta, Direccion, Telefonos] = inputString.split('ß');

        return {
            codigoSucursal: !isNaN(CodigoSucursal) ? parseInt(CodigoSucursal) : CodigoSucursal,
            codigoPuntoVenta: !isNaN(CodigoPuntoVenta) ? parseInt(CodigoPuntoVenta) : CodigoPuntoVenta,
            nombreSucursal: NombreSucursal,
            nombrePuntoVenta: NombrePuntoVenta,
            direccion: Direccion,
            telefonos: Telefonos
        };
    }

    static convertFacturaStringToObject(inputString) {
        const [
            NitEmisor,
            RazonSocialEmisor,
            Municipio,
            Telefono,
            NumeroFactura,
            CodigoSucursal,
            Direccion,
            CodigoPuntoVenta,
            FechaEmision,
            HoraEmision,
            NombreRazonSocial,
            CodigoTipoDocumentoIdentidad,
            NumeroDocumento,
            Complemento,
            CodigoCliente,
            CodigoMetodoPago,
            NumeroTarjeta,
            MontoTotal,
            MontoTotalSujetoIva,
            CodigoMoneda,
            TipoCambio,
            MontoGiftCard,
            DescuentoAdicional,
            CodigoExcepcion,
            Usuario,
            Sector,
            CorreoCliente
        ] = inputString.split('ß');

        return {
            nitEmisor: !isNaN(NitEmisor) ? parseInt(NitEmisor) : NitEmisor,
            razonSocialEmisor: RazonSocialEmisor,
            municipio: Municipio,
            telefono: Telefono,
            numeroFactura: !isNaN(NumeroFactura) ? parseInt(NumeroFactura) : NumeroFactura,
            codigoSucursal: !isNaN(CodigoSucursal) ? parseInt(CodigoSucursal) : CodigoSucursal,
            direccion: Direccion,
            codigoPuntoVenta: !isNaN(CodigoPuntoVenta) ? parseInt(CodigoPuntoVenta) : CodigoPuntoVenta,
            fechaEmision: FechaEmision,
            horaEmision: HoraEmision,
            nombreRazonSocial: NombreRazonSocial,
            codigoTipoDocumentoIdentidad: !isNaN(CodigoTipoDocumentoIdentidad) ? parseInt(CodigoTipoDocumentoIdentidad) : CodigoTipoDocumentoIdentidad,
            numeroDocumento: NumeroDocumento,
            complemento: Complemento,
            codigoCliente: CodigoCliente,
            codigoMetodoPago: !isNaN(CodigoMetodoPago) ? parseInt(CodigoMetodoPago) : CodigoMetodoPago,
            numeroTarjeta: !isNaN(NumeroTarjeta) ? parseInt(NumeroTarjeta) : NumeroTarjeta,
            montoTotal: MontoTotal.includes(',') ? parseFloat(MontoTotal.replace(',', '.')) : parseFloat(MontoTotal),
            montoTotalSujetoIva: MontoTotalSujetoIva.includes(',') ? parseFloat(MontoTotalSujetoIva.replace(',', '.')) : parseFloat(MontoTotalSujetoIva),
            codigoMoneda: !isNaN(CodigoMoneda) ? parseInt(CodigoMoneda) : CodigoMoneda,
            tipoCambio: !isNaN(TipoCambio) ? parseInt(TipoCambio) : TipoCambio,
            montoGiftCard: MontoGiftCard.includes(',') ? parseFloat(MontoGiftCard.replace(',', '.')) : parseFloat(MontoGiftCard),
            descuentoAdicional: DescuentoAdicional.includes(',') ? parseFloat(DescuentoAdicional.replace(',', '.')) : parseFloat(DescuentoAdicional),
            codigoExcepcion: !isNaN(CodigoExcepcion) ? parseInt(CodigoExcepcion) : CodigoExcepcion,
            usuario: Usuario,
            sector: !isNaN(Sector) ? parseInt(Sector) : Sector,
            correoCliente: CorreoCliente
        };
    }

    static convertFacturaDetalleStringToObject(inputString) {
        const items = inputString.split('þ');

        const facturaDetalle = items.map(item => {
            const [CodigoProducto, Descripcion, Cantidad, UnidadMedida, PrecioUnitario, MontoDescuento, SubTotal, NumeroSerie, NumeroImei] = item.split('ß');

            const [CodigoProductoToCopy, ActividadEconomica, CodigoProductoSiat] = CodigoProducto.split('¦');
            return {
                codigoProducto: CodigoProductoToCopy,
                actividadEconomica: ActividadEconomica,
                codigoProductoSiat: CodigoProductoSiat,
                descripcion: Descripcion,
                cantidad: !isNaN(Cantidad) ? parseInt(Cantidad) : Cantidad,
                unidadMedida: !isNaN(UnidadMedida) ? parseInt(UnidadMedida) : UnidadMedida,
                precioUnitario: PrecioUnitario.includes(',') ? parseFloat(PrecioUnitario.replace(',', '.')) : parseFloat(PrecioUnitario),
                montoDescuento: MontoDescuento.includes(',') ? parseFloat(MontoDescuento.replace(',', '.')) : parseFloat(MontoDescuento),
                subTotal: SubTotal.includes(',') ? parseFloat(SubTotal.replace(',', '.')) : parseFloat(SubTotal),
                numeroSerie: NumeroSerie,
                numeroImei: NumeroImei
            };
        });

        return facturaDetalle;
    }

    static generateCuf(data, subsidiary) {
        const preparedCuf = GenerateInvoiceOnline.prepareCUF(data, subsidiary);
        const cufGenerator = new CufGenerator(preparedCuf)

        const generatedCuf = cufGenerator.generateCuf();

        return `${generatedCuf}${preparedCuf.cufd ? preparedCuf.cufd : subsidiary.RespuestaCufd ? subsidiary.RespuestaCufd.codigoControl : ''}`;
    }

    static prepareCUF(data, subsidiary) {
        if (!data.tcFactura.horaEmision) {
            data.tcFactura.horaEmision = moment(data.tcFactura.fechaEmision).tz("America/La_Paz").format('HH:mm:ss.SSS');
            data.tcFactura.fechaEmision = moment(data.tcFactura.fechaEmision).tz("America/La_Paz").format('YYYY-MM-DD');
        }
        const cuf = {
            nitEmisor: data.tcFactura.nitEmisor || 0,
            fechaEmision: data.tcFactura.fechaEmision + 'T' + data.tcFactura.horaEmision || '',
            codigoSucursal: `${subsidiary.codigoSucursal || 0}`,
            modalidad: subsidiary.modalidad || 0,
            tipoEmision: subsidiary.tipoEmision || 0,
            tipoFactura: subsidiary.tipoFactura || 0,
            tipoDoc: subsidiary.codigoDocumentoSector || 0,
            numeroFactura: data.tcFactura.numeroFactura || subsidiary.numeroFactura || 0,
            codigoPuntoVenta: data.tcFactura.codigoPuntoVenta || 0,
            cufd: data.tcFactura.cufdControl
        };

        return cuf;
    }

    static generateInvoiceXML(data, subsidiary, cuf) {
        // TODO: Falta certificacion

        var detalle = GenerateInvoiceOnline.buildDetailInvoice(data.tcFacturaDetalle, data.tipoCambio || 1);

        var modalidadFacturacion = 'facturaComputarizadaCompraVenta';

        if (subsidiary && (subsidiary.modalidad == 1 || subsidiary.codigoModalidad == 1)) {
            modalidadFacturacion = 'facturaElectronicaCompraVenta';
        }

        try {
            const xmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <${modalidadFacturacion} xsi:noNamespaceSchemaLocation="${modalidadFacturacion}.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><cabecera>
           <nitEmisor>${data.nitEmisor}</nitEmisor>
           <razonSocialEmisor>${data.razonSocialEmisor}</razonSocialEmisor>
           <municipio>${data.municipio}</municipio>
           <telefono>${data.telefono}</telefono>
           <numeroFactura>${data.numeroFactura || subsidiary.numeroFactura}</numeroFactura>
           <cuf>${cuf}</cuf>
           <cufd>${data.cufd ? data.cufd : subsidiary.RespuestaCufd ? subsidiary.RespuestaCufd.codigo : subsidiary.cufd ? subsidiary.cufd : ''}</cufd>
           <codigoSucursal>${data.codigoSucursal}</codigoSucursal>
           <direccion>${data.direccion}</direccion>
           <codigoPuntoVenta>${subsidiary.codigoPuntoVenta || 0}</codigoPuntoVenta>
           <fechaEmision>${data.fechaEmision + 'T' + data.horaEmision}</fechaEmision>
           <nombreRazonSocial>${data.nombreRazonSocial}</nombreRazonSocial>
           <codigoTipoDocumentoIdentidad>${data.codigoTipoDocumentoIdentidad}</codigoTipoDocumentoIdentidad>
           <numeroDocumento>${data.numeroDocumento}</numeroDocumento>
           ${data.complemento ? `<complemento>${data.complemento}</complemento>` : ` <complemento xsi:nil="true"/>`}
           <codigoCliente>${data.codigoCliente}</codigoCliente>
           <codigoMetodoPago>${data.codigoMetodoPago}</codigoMetodoPago>
           ${data.numeroTarjeta ? `<numeroTarjeta>${data.numeroTarjeta}</numeroTarjeta>` : `<numeroTarjeta xsi:nil="true"/>`}
           <montoTotal>${Utilities.convertToFloat2(data.montoTotal * data.tipoCambio).toFixed(2)}</montoTotal>
           <montoTotalSujetoIva>${Utilities.convertToFloat2((data.montoTotalSujetoIva - (data.montoGiftCard ? data.montoGiftCard : 0)) * data.tipoCambio).toFixed(2)}</montoTotalSujetoIva>
           <codigoMoneda>${data.codigoMoneda}</codigoMoneda>
           <tipoCambio>${data.tipoCambio}</tipoCambio>
           <montoTotalMoneda>${Utilities.convertToFloat2(data.montoTotal).toFixed(2)}</montoTotalMoneda>
           ${data.montoGiftCard ? `<montoGiftCard>${Utilities.convertToFloat2(data.montoGiftCard * data.tipoCambio).toFixed(2)}</montoGiftCard>` : `<montoGiftCard xsi:nil="true"/>`}
           <descuentoAdicional>${Utilities.convertToFloat2(data.descuentoAdicional * data.tipoCambio)}</descuentoAdicional>
            ${data.codigoExcepcion ? `<codigoExcepcion>${data.codigoExcepcion}</codigoExcepcion>` : ' <codigoExcepcion xsi:nil="true"/>'}
            ${subsidiary.cafc ? `<cafc>${subsidiary.cafc}</cafc>` : '<cafc xsi:nil="true"/>'}
           <leyenda>${data.leyenda || subsidiary.leyenda}</leyenda>
           <usuario>${data.usuario}</usuario>
           <codigoDocumentoSector>${subsidiary.codigoDocumentoSector}</codigoDocumentoSector>
         </cabecera>${detalle}
       </${modalidadFacturacion}>`;

            return xmlStr.replace(/\n|\t/g, '').replace(/'  '/g, '').replace(/'    '/g, '').replace(/'      '/g, '');
        } catch (err) {
            return err;
        }
    }

    static buildDetailInvoice(tcFacturaDetalle, tipoCambio = 1) {
        var detalle = ``;
        tcFacturaDetalle.forEach(detail => {
            detalle += `<detalle><actividadEconomica>${detail.actividadEconomica || 1}</actividadEconomica><codigoProductoSin>${detail.codigoProductoSiat || detail.codigoProductoSin}</codigoProductoSin><codigoProducto>${detail.codigoProducto}</codigoProducto><descripcion>${detail.descripcion}</descripcion><cantidad>${detail.cantidad}</cantidad><unidadMedida>${detail.unidadMedida || 58}</unidadMedida><precioUnitario>${Utilities.convertToFloat2(detail.precioUnitario * tipoCambio).toFixed(2)}</precioUnitario><montoDescuento>${Utilities.convertToFloat2(detail.montoDescuento * tipoCambio).toFixed(2)}</montoDescuento><subTotal>${((Utilities.convertToFloat2(detail.precioUnitario * tipoCambio) * Utilities.convertToFloat2(detail.cantidad)) - (Utilities.convertToFloat2(detail.montoDescuento * tipoCambio || 0))).toFixed(2)}</subTotal><numeroSerie>${detail.numeroSerie || 0}</numeroSerie><numeroImei xsi:nil="true"/></detalle>`
        });

        return detalle;
    }

    static async xmlToBase64(xml, cuf) {
        return new Promise((resolve, reject) => {
            try {
                var fileName = cuf;
                var filePath = `${fileName}.xml`;
                var zipName = `${filePath}.zip`;
                var outputZip = fs.createWriteStream(zipName);
                // var signOpt = {
                //   compact: true,
                //   ignoreComment: true,
                //   spaces: 2,
                //   fullTagEmptyElement: true
                // };
                // const xml = convert.xml2js(req.body.xml, signOpt);
                fs.writeFile(`./${filePath}`, xml, function (err) {
                    const stream = fs.createReadStream(`./${filePath}`);
                    var gzip = zlib.createGzip();
                    stream
                        .pipe(gzip)
                        .pipe(outputZip)
                        .on("finish", () => {
                            sha256File(zipName, function (error, hash256) {
                                var archivo = fs.readFileSync(zipName);
                                var xmlBase = fs.readFileSync(filePath);
                                if (error) res.status(403).json(error);
                                else {
                                    var data = {
                                        xmlBase64: xmlBase.toString('base64'),
                                        archivo: archivo.toString('base64'),
                                        hashArchivo: hash256
                                    }
                                    fs.unlink(filePath, (err) => {
                                        fs.unlink(zipName, (err) => {
                                            resolve(data);
                                        });
                                    });
                                }
                            })
                        });
                })
            } catch (err) {
                reject(err);
            }
        })
    }

    static generateXmlData(data) {
        let horaEmision = data.horaEmision;
        let fechaEmision = data.fechaEmision;
        if (!horaEmision) {
            horaEmision = moment(data.fechaEmision).tz("America/La_Paz").format('HH:mm:ss.SSS');
            fechaEmision = moment(data.fechaEmision).tz("America/La_Paz").format('YYYY-MM-DD');
        }
        return {
            nitEmisor: data.nitEmisor,
            razonSocialEmisor: data.razonSocialEmisor,
            municipio: data.municipio,
            telefono: data.telefono,
            codigoSucursal: data.codigoSucursal,
            direccion: data.direccion,
            fechaEmision: fechaEmision,
            horaEmision: horaEmision,
            nombreRazonSocial: data.nombreRazonSocial,
            codigoTipoDocumentoIdentidad: data.codigoTipoDocumentoIdentidad,
            numeroDocumento: data.numeroDocumento,
            numeroFactura: data.numeroFactura,
            codigoCliente: data.codigoCliente,
            codigoMetodoPago: data.codigoMetodoPago,
            montoTotal: data.montoTotal,
            montoTotalSujetoIva: data.montoTotalSujetoIva,
            codigoMoneda: data.codigoMoneda,
            tipoCambio: data.tipoCambio,
            codigoSucursal: data.codigoSucursal,
            usuario: data.usuario || 'Usuario',
            leyenda: data.leyenda,
            descuentoAdicional: data.descuentoAdicional,
            numeroTarjeta: data.numeroTarjeta,
            montoGiftCard: data.montoGiftCard,
            tcFacturaDetalle: data.tcFacturaDetalle || data.detalle,
            codigoExcepcion: data.codigoExcepcion,
            cafc: data.cafc,
            cufd: data.cufd,
            complemento: data.complemento
        }
    }

    static anularFactura(merchantMongoose, emitedInvoice, subsidiary, username) {
        return new Promise((resolve, reject) => {

            var facturacion = new Facturacion({});
            facturacion.anulacionFactura(merchantMongoose, emitedInvoice, subsidiary, username).then(facturaAnulada => {
                resolve(facturaAnulada);
            }).catch(err => {
                reject(err);
            })

        })
    }

    static obetenerFactura(data, subsidiary, merchantConfig = undefined) {
        return new Promise((resolve, reject) => {
            const invoice = {
                CUF: data.cuf,
                Transaccion: true
            }
            data.tcFacturaDetalle = data.detalle;
            const xmlData = GenerateInvoiceOnline.generateXmlData(data);
            xmlData.leyenda = !xmlData.leyenda ? subsidiary.leyenda : xmlData.leyenda;
            const xml = GenerateInvoiceOnline.generateInvoiceXML(xmlData, subsidiary, invoice.CUF);

            GenerateInvoiceOnline.xmlToBase64(xml, data.cuf).then(dataBase => {
                xmlData.subsidiaryName = subsidiary.code;
                xmlData.cuf = data.cuf;
                xmlData.leyenda = subsidiary.leyenda;
                xmlData.numeroFactura = data.numeroFactura;
                xmlData.merchantConfig = merchantConfig;
                PDFGenerator.createInvoicePDF(xmlData).then((pdfData) => {
                    invoice.FacturaXML = dataBase.xmlBase64;
                    invoice.FacturaPDF = pdfData.pdfBase64;
                    resolve(invoice);
                }).catch(err => {
                    reject(err);
                })
            }).catch(err => {
                reject(err);
            })
        })
    }

    static consultarEstadoFactura(merchantMongoose, data, subsidiary) {
        return new Promise((resolve, reject) => {

            var facturacion = new Facturacion({});
            facturacion.verificacionEstadoFactura(merchantMongoose, data, subsidiary).then(result => {
                const invoice = {};
                invoice.EstadoSiat = result.RespuestaServicioFacturacion;
                if (result.RespuestaServicioFacturacion && result.RespuestaServicioFacturacion.codigoDescripcion == 'VALIDA') {
                    invoice.EstadoFacturaTech = {
                        Estado: 2,
                        Descripcion: "Aceptado"
                    }
                }

                resolve(invoice);
            }).catch(err => {
                reject(err);
            })
        })
    }

    static async generateFastInvoice(merchantMongoose, data, subsidiary, username) {
        try {
            // Populate tcFactura with subsidiary data
            Object.assign(data.tcFactura, {
                codigoSucursal: subsidiary.codigoSucursal,
                codigoPuntoVenta: subsidiary.codigoPuntoVenta,
                municipio: subsidiary.municipio,
                telefono: subsidiary.telefono,
                direccion: subsidiary.direccion,
                montoTotalSujetoIva: data.tcFactura.montoTotal,
                codigoMoneda: 1,
                tipoCambio: 1
            });

            // Fetch and update product details
            let products = []
            if (!data.tcFacturaDetalle.some(x => x.codigoProductoSin || x.actividadEconomica)) {
                products = await Product(merchantMongoose).completeProductsByCodigoProducto(data.tcFacturaDetalle);
                data.tcFacturaDetalle = data.tcFacturaDetalle.map(item => {
                    const product = products.find(p => p.code === item.codigoProducto);
                    return product ? {
                        ...item,
                        actividadEconomica: product.economicActivity,
                        codigoProductoSiat: product.SINCode,
                        montoDescuento: product.discount || 0
                    } : item;
                });

            }
            // Generate invoice
            return await GenerateInvoiceOnline.generateInvoice(merchantMongoose, data, subsidiary, username);

        } catch (err) {
            throw err; // Let the caller handle the error
        }
    }
}

module.exports = GenerateInvoiceOnline;
