var MerchantConfig = require("../../merchantConfigs/merchantConfig.model");
var InvoiceToken = require("../../invoiceTokens/invoiceToken.model");
var SignificantEvent = require("../../significantEvents/significantEvent.model");

var soap = require('soap');
var INVOICE_ROUTES = require("../../../commons/invoiceRoutes");
const Subsidiary = require("../../subsidiarys/subsidiary.model");
const moment = require('moment');
const Utilities = require("../../../commons/utilities");

class Operaciones {
    constructor(invoiceInfo) {

    }

    async registroEventoSignificativo(currentMongoose, data) {
        try {
            const codigoSucursal = data?.codigoSucursal ? `${data.codigoSucursal}` : '0';
            const merchantConfig = await MerchantConfig(currentMongoose).findOne().select();
            const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
            const soapRoute = codigoAmbiente === '2' ? INVOICE_ROUTES.OPERATION_SERVICE : INVOICE_ROUTES.OPERATION_SERVICE_PROD;
            const client = await soap.createClientAsync(soapRoute);

            const subsidiary = await Subsidiary(currentMongoose)
                .findOne({ codigoSucursal: data.codigoSucursal, codigoPuntoVenta: data.codigoPuntoVenta })
                .select();

            const invoiceToken = await InvoiceToken(currentMongoose).findOne().select();

            const fechaHoraFinEvento = Utilities.getBolivianInvoiceDateFormat(moment(data.fechaHoraFinEvento).add(-5, 'milliseconds').toDate());
            const SolicitudEventoSignificativo = {
                codigoAmbiente,
                codigoSistema: invoiceToken.systemCode,
                nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                cuis: data.cuis || (subsidiary?.RespuestaCuis?.codigo || ''),
                cufd: data.cufd || (subsidiary?.RespuestaCufd?.codigo || ''),
                codigoSucursal,
                codigoMotivoEvento: `${data.codigoMotivoEvento || 1}`,
                descripcion: data.descripcion,
                fechaHoraInicioEvento: data.fechaHoraInicioEvento,
                fechaHoraFinEvento: fechaHoraFinEvento,
                cufdEvento: data.cufdEvento || data.cufd || (subsidiary?.RespuestaCufd?.codigo || ''),
                codigoPuntoVenta: `${data.codigoPuntoVenta || subsidiary?.codigoPuntoVenta || '0'}`,
            };

            return new Promise((resolve, reject) => {
                client.registroEventoSignificativo({ SolicitudEventoSignificativo }, async (error, result) => {
                    if (error) {
                        return reject({ error: error.message });
                    }

                    if (result?.RespuestaListaEventos?.codigoRecepcionEventoSignificativo) {
                        SolicitudEventoSignificativo.codigoRecepcionEventoSignificativo =
                            result.RespuestaListaEventos.codigoRecepcionEventoSignificativo;

                        const significantEvent = new SignificantEvent(currentMongoose)(SolicitudEventoSignificativo);
                        const savedEvent = await significantEvent.save();

                        resolve(savedEvent);
                    } else {
                        let errorMsg = '';
                        result?.RespuestaListaEventos?.mensajesList?.forEach(message => {
                            errorMsg += `\n __Error Message: |${message.codigo}|: ${message.descripcion}`;
                        });
                        reject({ error: errorMsg || 'Unknown error' });
                    }
                }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
            });

        } catch (error) {
            throw new Error(`Error registering significant event: ${error.message}`);
        }
    }

    registroPuntoVentaWithSubsidiary(currentMongoose, subsidiary) {
        const that = this;

        return new Promise((resolve, reject) => {
            if (subsidiary) {
                const puntoVentaToSave = {
                    codigoPuntoVenta: subsidiary.codigoPuntoVenta,
                    cuis: subsidiary && subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
                    nombrePuntoVenta: subsidiary.code,
                    descripcion: subsidiary.descripcion || subsidiary.code,
                    codigoSucursal: subsidiary.codigoSucursal,
                    codigoTipoPuntoVenta: subsidiary.codigoTipoPuntoVenta
                }
                Subsidiary(currentMongoose).findOne({ codigoSucursal: 0, codigoPuntoVenta: 0 }).then(foundSubsidiary => {
                    if (foundSubsidiary) {
                        puntoVentaToSave.cuis = foundSubsidiary.RespuestaCuis.codigo
                        that.registroPuntoVenta(currentMongoose, puntoVentaToSave).then((puntoVenta) => {
                            resolve(puntoVenta)
                        }).catch(err => {
                            reject(err);
                        })
                    } else {
                        reject({ error: 'Subsidiary not found' });
                    }
                }).catch(err => {
                    reject(err);
                })
            } else {
                resolve();
            }
        })
    }

    registroPuntoVenta(currentMongoose, data) {
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.OPERATION_SERVICE : INVOICE_ROUTES.OPERATION_SERVICE_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    if (client) {
                        InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                            const codigoModalidad = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1';
                            var SolicitudRegistroPuntoVenta = {
                                codigoAmbiente,
                                codigoModalidad,
                                codigoSistema: invoiceToken.systemCode,
                                codigoSucursal,
                                cuis: data.cuis,
                                codigoTipoPuntoVenta: `5`,
                                descripcion: data.nombrePuntoVenta,
                                nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                                nombrePuntoVenta: data.nombrePuntoVenta,
                            }

                            client.registroPuntoVenta({ SolicitudRegistroPuntoVenta }, (error, result, resultXML) => {
                                if (error) {
                                    reject({ error: error ? error.message : error, data })
                                } else {
                                    resolve({ data, result });
                                }
                            }, {}, { apikey: `TokenApi ${invoiceToken.token}` });

                        }).catch(err => {
                            reject(err);
                        })
                    } else {
                        resolve({ data });
                    }
                }).catch(err => {
                    reject(err);
                })
            }).catch(err => {
                reject(err);
            })
        })
    }
}

module.exports = Operaciones;

