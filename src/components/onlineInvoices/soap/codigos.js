var MerchantConfig = require("../../merchantConfigs/merchantConfig.model");
var Utilities = require("../../../commons/utilities");
var InvoiceToken = require("../../invoiceTokens/invoiceToken.model");

var soap = require('soap');
var INVOICE_ROUTES = require("../../../commons/invoiceRoutes");
const Subsidiary = require("../../subsidiarys/subsidiary.model");
const Cufd = require("../../cufds/cufd.model");
var $q = require("q");

class Codigos {

    constructor(invoiceInfo) {

    }

    autoGenerateCufds(currentMongoose) {
        const that = this;
        return new Promise((resolve, reject) => {
            const promises = [];
            Subsidiary(currentMongoose).find().then(subsidiarys => {
                subsidiarys.forEach(subsidiary => {
                    promises.push(that.generateCufd(currentMongoose, subsidiary));
                });
                $q.all(promises).then(() => {
                    resolve(subsidiarys);
                })
            }).catch(err => {
                reject(err);
            })

        })
    }

    generateCuis(currentMongoose, data) {
        // TODO: Sincronizacion => get list of products from NIT Bolivia
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.CODES : INVOICE_ROUTES.CODES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudCuis = {
                            codigoAmbiente,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoModalidad: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1',
                            codigoSucursal,
                            codigoPuntoVenta: `${data.codigoPuntoVenta}` || '0'
                        };
                        client.cuis({ SolicitudCuis }, async (error, result, resultXML) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else if (result) {
                                if (result.RespuestaCuis && result.RespuestaCuis.codigo) {
                                    await Subsidiary(currentMongoose).updateOne({ code: data.subsidiaryCode }, { RespuestaCuis: result.RespuestaCuis });
                                    resolve(result);
                                } else {
                                    var error = '';

                                    result.RespuestaCuis.mensajesList.forEach(message => {
                                        error += `\n __Error Message: |${message.codigo}|: ${message.descripcion}`
                                    });
                                    reject({ error: error })
                                }
                            } else {
                                reject({ error: 'ERROR!' })
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    })
                }, error => {
                    console.error("[generateCuis][createClientAsync] Error:", error);
                })
            });
        })
    }

    generateCuisMasivo(currentMongoose, data) {
        // TODO: Sincronizacion => get list of products from NIT Bolivia
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.CODES : INVOICE_ROUTES.CODES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudCuisMasivoSistemas = {
                            codigoAmbiente,
                            codigoModalidad: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1',
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            datosSolicitud: [],
                            // codigoSucursal,
                            // codigoPuntoVenta: data.codigoPuntoVenta || '0'
                        };
                        client.cuisMasivo({ SolicitudCuisMasivoSistemas }, async (error, result, resultXML) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else if (result) {
                                if (result.RespuestaCuisMasivo && result.RespuestaCuisMasivo.transaccion) {
                                    // await Subsidiary(currentMongoose).updateOne({ code: data.subsidiaryCode }, { RespuestaCuis: result.RespuestaCuis });
                                    resolve(result);
                                } else {
                                    var error = '';
                                    result.RespuestaCuisMasivo.mensajesList.forEach(message => {
                                        error += `\n __Error Message: |${message.codigo}|: ${message.descripcion}`
                                    });
                                    reject({ error: error })
                                }
                            } else {
                                reject({ error: 'ERROR!' })
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    }, error => {
                        console.error("[generateCuisMasivo][createClientAsync] Error:", error);
                    })
                })
            });
        })
    }

    generateCufd(currentMongoose, data) {
        // TODO: Sincronizacion => get list of products from NIT Bolivia
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.CODES : INVOICE_ROUTES.CODES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudCufd = {
                            codigoAmbiente,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoModalidad: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1',
                            codigoSucursal,
                            codigoPuntoVenta: data.codigoPuntoVenta || '0',
                            cuis: data.cuis ? data.cuis : data.RespuestaCuis ? data.RespuestaCuis.codigo : ''
                        };
                        client.cufd({ SolicitudCufd }, async (error, result, resultXML) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                await Subsidiary(currentMongoose).updateOne({ codigoPuntoVenta: Utilities.convertToNumberIfNeeded(SolicitudCufd.codigoPuntoVenta), codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal) }, { RespuestaCufd: result.RespuestaCufd });
                                if (result && result.RespuestaCufd) {
                                    const cufdData = {
                                        codigo: result.RespuestaCufd.codigo,
                                        codigoControl: result.RespuestaCufd.codigoControl,
                                        direccion: result.RespuestaCufd.direccion,
                                        fechaVigencia: result.RespuestaCufd.fechaVigencia,
                                        codigoPuntoVenta: Utilities.convertToNumberIfNeeded(SolicitudCufd.codigoPuntoVenta),
                                        codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal)
                                    };
                                    await Cufd(currentMongoose).create(cufdData);
                                }

                                resolve(result);
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    }, error => {
                        console.error("[generateCufd][createClientAsync] Error:", error);
                    })
                })
            });
        })
    }

    generateCufdMasivo(currentMongoose, data) {
        // TODO: Sincronizacion => get list of products from NIT Bolivia
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.CODES : INVOICE_ROUTES.CODES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudCufdMasivo = {
                            codigoAmbiente,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoModalidad: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1',
                            // codigoSucursal,
                            // codigoPuntoVenta: '0',
                            datosSolicitud: [{ codigoSucursal, cuis: data.cuis }],
                            // cuis: data.cuis
                        };
                        client.cufdMasivo({ SolicitudCufdMasivo }, async (error, result, resultXML) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                if (result.RespuestaCufdMasivo && result.RespuestaCufdMasivo.listaRespuestasCufd) {
                                    await Subsidiary(currentMongoose).updateOne({ code: data.subsidiaryCode }, { $set: { RespuestaCufdMasivo: result.RespuestaCufdMasivo } });
                                    resolve(result);
                                } else {
                                    var error = '';

                                    result.RespuestaCuis.mensajesList.forEach(message => {
                                        error += `\n __Error Message: |${message.codigo}|: ${message.descripcion}`
                                    });
                                    reject({ error: error })
                                }
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    })
                }, error => {
                    console.error("[generateCufdMasivo][createClientAsync] Error:", error);
                })
            });
        })
    }

    getVerificarComunicacion(currentMongoose, data) {
        // TODO: Sincronizacion => get list of products from NIT Bolivia
        return new Promise((resolve, reject) => {
            if (data && data.subsidiaryCode && data.cuis) {
                this.verificarComunicacion(currentMongoose, data).then(result => {
                    resolve(result)
                }).catch(err => {
                    reject(err);
                })
            } else {
                Subsidiary(currentMongoose).findOne().then((subsidiary) => {
                    var data2 = {
                        subsidiaryCode: subsidiary.code,
                        cuis: subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
                        codigoSucursal: subsidiary.codigoSucursal
                    }
                    this.verificarComunicacion(currentMongoose, data2).then(result => {
                        resolve(result)
                    }).catch(err => {
                        reject(err);
                    })
                })
            }
        })
    }

    verificarComunicacion(currentMongoose, data) {
        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.SYNC : INVOICE_ROUTES.SYNC_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudSincronizacion = {
                            codigoAmbiente,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            cuis: data.cuis,
                            codigoSucursal,
                            codigoPuntoVenta: '0'
                        };
                        client.verificarComunicacion({}, (error, result, resultXML) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                if (result && result.return) {
                                    resolve(result.return);
                                } else {
                                    reject({ error: 'No se puedo verificar Comunicacion' })
                                }
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    })
                }, error => {
                    console.error("[verificarComunicacion][createClientAsync] Error:", error);
                })
            });
        })
    }

    verificarNit(currentMongoose, data) {

        return new Promise((resolve, reject) => {
            var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
            MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
                const codigoAmbiente = merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2';
                const soapRoute = codigoAmbiente == '2' ? INVOICE_ROUTES.CODES : INVOICE_ROUTES.CODES_PROD;
                soap.createClientAsync(soapRoute).then((client) => {
                    InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
                        var SolicitudVerificarNit = {
                            codigoAmbiente,
                            codigoSistema: invoiceToken.systemCode,
                            nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
                            codigoModalidad: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoModalidad}` : '1',
                            cuis: data.cuis,
                            codigoSucursal,
                            nitParaVerificacion: data.nit
                        };
                        client.verificarNit({ SolicitudVerificarNit }, (error, result, resultXML) => {
                            if (error) {
                                reject({ error: error ? error.message : error })
                            } else {
                                resolve(result);
                            }
                        }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
                    })
                }, error => {
                    console.error("[verificarNit][createClientAsync] Error:", error);
                })
            });
        })
    }


    // FUNCIONES PARA PASA PRUEBAS DE IMPUESTOS
    passTestGenerateCufd(currentMongoose, data) {
        return new Promise((resolve, reject) => {
            let repeatTimes = data.repeatTimes || 0;
            this.generateCufd(currentMongoose, data).then(result => {
                repeatTimes--;
                if (repeatTimes > 0) {
                    data.repeatTimes = repeatTimes;
                    setTimeout(() => {
                        this.passTestGenerateCufd(currentMongoose, data)
                    }, 3000)
                } else {
                    resolve(result);
                }
            }).catch(err => {
                reject(err);
            })
        })
    }
}

module.exports = Codigos;

