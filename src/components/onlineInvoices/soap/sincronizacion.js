var MerchantConfig = require("../../merchantConfigs/merchantConfig.model");
var InvoiceToken = require("../../invoiceTokens/invoiceToken.model");

var soap = require('soap');
var INVOICE_ROUTES = require("../../../commons/invoiceRoutes");
const Subsidiary = require("../../subsidiarys/subsidiary.model");
const Utilities = require("../../../commons/utilities");

class Sincronizacion {

  constructor(invoiceInfo) {

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
            codigoSucursal: subsidiary.codigoSucursal,
            codigoPuntoVenta: subsidiary.codigoPuntoVenta || 0,
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
              codigoPuntoVenta: `${data.codigoPuntoVenta || '0'}`
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

  getFechaHora(currentMongoose, data) {
    // TODO: Sincronizacion => get list of products from NIT Bolivia
    return new Promise((resolve, reject) => {
      if (data && data.subsidiaryCode && data.cuis) {
        this.sincronizarFechaHora(currentMongoose, data).then(result => {
          resolve(result)
        }).catch(err => {
          reject(err);
        })
      } else {
        Subsidiary(currentMongoose).findOne().then((subsidiary) => {
          var data2 = {
            subsidiaryCode: subsidiary.code,
            cuis: subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
            codigoSucursal: subsidiary.codigoSucursal,
            codigoPuntoVenta: subsidiary.codigoPuntoVenta || 0,
          }
          this.sincronizarFechaHora(currentMongoose, data2).then(result => {
            resolve(result)
          }).catch(err => {
            reject(err);
          })
        })
      }
    })
  }

  sincronizarFechaHora(currentMongoose, data) {
    return new Promise((resolve, reject) => {
      var codigoSucursal = data && data.codigoSucursal ? `${data.codigoSucursal}` : '0';
      soap.createClientAsync(INVOICE_ROUTES.SYNC).then((client) => {
        MerchantConfig(currentMongoose).findOne().select().then(merchantConfig => {
          InvoiceToken(currentMongoose).findOne().select().then(invoiceToken => {
            var SolicitudSincronizacion = {
              codigoAmbiente: merchantConfig.facturacion ? `${merchantConfig.facturacion.codigoAmbiente}` : '2',
              codigoSistema: invoiceToken.systemCode,
              nit: merchantConfig.facturacion ? `${merchantConfig.facturacion.nitEmisor}` : '',
              cuis: data.cuis,
              codigoSucursal,
              codigoPuntoVenta: `${data.codigoPuntoVenta || '0'}`
            };
            client.sincronizarFechaHora({ SolicitudSincronizacion }, (error, result, resultXML) => {
              if (error) {
                reject({ error: error ? error.message : error })
              } else {
                if (result && result.RespuestaFechaHora && result.RespuestaFechaHora) {
                  resolve(result.RespuestaFechaHora);
                } else {
                  reject({ error: 'No existe Fecha hora' })
                }
              }
            }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
          })
        })
      }, error => {
        console.error("[verificarComunicacion][createClientAsync] Error:", error);
      });
    })
  }

  lowerizeFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  getLeyenda(currentMongoose, subsidiary, economicActivity) {
    return new Promise((resolve, reject) => {
      this.getLista('ListaLeyendasFactura', currentMongoose, subsidiary, 'ListaParametricasLeyendas', 'listaLeyendas').then(result => {
        let leyendas = result;
        if (leyendas) {
          if (result.some(x => x.codigoActividad == economicActivity)) {
            leyendas = result.filter(x => x.codigoActividad == economicActivity);
          }
          const randomLeyendaNumber = Utilities.getRandomNumber(0, leyendas.length - 1);

          resolve(leyendas[randomLeyendaNumber]);
        } else {
          reject({ error: 'No pudimos cargar las leyendas disponibles' })
        }
      }).catch(err => {
        reject(err);
      })
    })
  }

  getParametricaTipoDocumentoIdentidad(currentMongoose, subsidiary, economicActivity) {
    return new Promise((resolve, reject) => {
      this.getLista('ParametricaTipoDocumentoIdentidad', currentMongoose, subsidiary, 'ListaParametricas', 'listaCodigos').then(result => {
        resolve(result);
      }).catch(err => {
        reject(err);
      })
    })
  }

  getMetodosDePagoDisponibles(currentMongoose, subsidiary) {
    return new Promise((resolve, reject) => {
      this.getLista('ParametricaTipoMetodoPago', currentMongoose, subsidiary, 'ListaParametricas', 'listaCodigos').then(result => {
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
        resolve(list);
      }).catch(err => {
        reject(err);
      })
    })
  }

  getLista(method, currentMongoose, data, auxMethod = undefined, auxSubMethod = undefined) {
    return new Promise((resolve, reject) => {
      if (data && data.subsidiaryCode && data.cuis && data.codigoSucursal && data.codigoPuntoVenta) {
        this.sincronizarLista(method, currentMongoose, data, auxMethod, auxSubMethod).then(result => {
          resolve(result)
        }).catch(err => {
          reject(err);
        })
      } else if (data.subsidiaryCode) {
        Subsidiary(currentMongoose).findOne({ code: data.subsidiaryCode }).then((subsidiary) => {
          if (subsidiary) {
            var data2 = {
              subsidiaryCode: subsidiary.code,
              cuis: subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
              codigoSucursal: subsidiary.codigoSucursal,
              codigoPuntoVenta: subsidiary.codigoPuntoVenta,
            }
            this.sincronizarLista(method, currentMongoose, data2, auxMethod, auxSubMethod).then(result => {
              resolve(result)
            }).catch(err => {
              reject(err);
            })
          } else {
            reject({ error: 'Codigo de sucursal no existe.' })
          }
        })
      } else {
        let searchData = {};
        if (data.codigoSucursal != undefined && data.codigoPuntoVenta != undefined) {
          searchData = { codigoSucursal: data.codigoSucursal, codigoPuntoVenta: data.codigoPuntoVenta }
        }
        Subsidiary(currentMongoose).findOne(searchData).then((subsidiary) => {
          if (subsidiary) {
            var data2 = {
              subsidiaryCode: subsidiary.code,
              cuis: subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
              codigoSucursal: subsidiary.codigoSucursal,
              codigoPuntoVenta: subsidiary.codigoPuntoVenta,
            }
            this.sincronizarLista(method, currentMongoose, data2, auxMethod, auxSubMethod).then(result => {
              resolve(result)
            }).catch(err => {
              reject(err);
            })
          } else {
            reject({ error: 'Codigo de sucursal no existe.' })
          }
        })
      }
    })
  }

  sincronizarLista(method, currentMongoose, data, auxMethod = undefined, auxSubMethod = undefined) {
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
              codigoPuntoVenta: `${data.codigoPuntoVenta || '0'}`
            };
            client[`sincronizar${method}`]({ SolicitudSincronizacion }, (error, result, resultXML) => {
              if (error) {
                reject({ error: error ? error.message : error })
              } else {
                if (result && result[`Respuesta${auxMethod || method}`] && result[`Respuesta${auxMethod || method}`][`${this.lowerizeFirstLetter(auxSubMethod || auxMethod || method)}`]) {
                  resolve(result[`Respuesta${auxMethod || method}`][`${this.lowerizeFirstLetter(auxSubMethod || auxMethod || method)}`]);
                } else {
                  reject({ error: `No existe ${auxMethod || method}` })
                }
              }
            }, {}, { apikey: `TokenApi ${invoiceToken.token}` });
          })
        }, error => {
          console.error("[sincronizarLista] Error:", error);
        })
      });
    })
  }

  // FUNCIONES PARA PASA PRUEBAS DE IMPUESTOS
  passTestGetLista(method, currentMongoose, data, auxMethod = undefined, auxSubMethod = undefined) {
    let repeatTimes = data.repeatTimes || 0;
    return new Promise((resolve, reject) => {
      this.getLista(method, currentMongoose, data, auxMethod, auxSubMethod).then(result => {
        repeatTimes--;
        if (repeatTimes > 0) {
          data.repeatTimes = repeatTimes;
          setTimeout(() => {
            this.passTestGetLista(method, currentMongoose, data, auxMethod, auxSubMethod)
          }, 3000)
        } else {
          resolve(result);
        }
      }).catch(err => {
        reject(err);
      })
    })
  }

  passTestGetFechaHora(currentMongoose, data) {
    let repeatTimes = data.repeatTimes || 0;
    return new Promise((resolve, reject) => {
      this.getFechaHora(currentMongoose, data).then(result => {
        repeatTimes--;
        if (repeatTimes > 0) {
          data.repeatTimes = repeatTimes;
          setTimeout(() => {
            this.passTestGetFechaHora(currentMongoose, data);
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

module.exports = Sincronizacion;

