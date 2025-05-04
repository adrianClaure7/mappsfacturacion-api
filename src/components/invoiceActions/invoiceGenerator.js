var Order = require("../orders/order.model");
var Subsidiary = require("../subsidiarys/subsidiary.model");
var Facturacion = require("../onlineInvoices/soap/facturacion");
var Sincronizacion = require("../onlineInvoices/soap/sincronizacion");
const EmitedInvoice = require("../emitedInvoices/emitedInvoice.model");
const GenerateInvoiceOnline = require("../api/servicio/generators/generateInvoice");
const Utilities = require("../../commons/utilities");
const moment = require('moment-timezone'); // Import moment-timezone
const Mailer = require("../mailer");
let mailer = new Mailer();
const InvoiceToMakro = require("./InvoiceToMakro");
let invoiceToMakro = new InvoiceToMakro();

class InvoiceGenerator {
    constructor(currentMongoose, merchantConfig) {
        this.currentMongoose = currentMongoose;
        this.merchantConfig = merchantConfig;
    }

    static createEmitedInvoiceFromOrder(order) {
        const now = moment.tz("America/La_Paz"); // Set the timezone to Bolivia (GMT-4)
        const fechaEnvio = now.format('YYYY-MM-DD'); // Format the date as YYYY-MM-DD

        // Format the time as HH:MM:SS.SSS in Bolivia timezone
        const horaEnvio = now.format('HH:mm:ss.SSS'); // Format the time as HH:MM:SS.xxx

        const emitedInvoice = {
            codigoTipoDocumentoIdentidad: "1", // Assuming this is a fixed value, or you can pass this as a parameter
            nombreRazonSocial: "Control Tributario", // You need to provide or map this from your own logic
            numeroDocumento: "99002", // Map this if you have this in the order
            codigoCliente: order.clientCode || "UNKNOWN_CLIENT_CODE", // Map clientCode to codigoCliente
            correo: "", // Add logic to retrieve the customer's email if available
            codigoMetodoPago: "1", // Assuming 1 as default. Update this if needed
            codigoSucursal: order.codigoSucursal || "0",
            codigoPuntoVenta: order.codigoPuntoVenta || "0",
            detalle: order.orderDetails.map(detail => ({
                actividadEconomica: detail.economicActivity || "UNKNOWN_ACTIVITY", // Map or provide a default value
                codigoProductoSiat: detail.SINCode || "UNKNOWN_SINCODE", // Map SINCode to codigoProductoSiat
                codigoProducto: detail.code || "UNKNOWN_CODE", // Map code to codigoProducto
                descripcion: detail.description || "UNKNOWN_DESCRIPTION", // Map description
                cantidad: detail.quantity || 1, // Map quantity
                precioUnitario: detail.unitAmount || 0, // Map unitAmount to precioUnitario
                subTotal: detail.unitAmount * detail.quantity || 0, // Calculate subTotal (unitAmount * quantity)
                unidadMedida: "58", // Assuming a default value for unidadMedida
                montoDescuento: "0", // Assuming no discount
            })),
            montoTotal: order.amount,
            montoTotalMoneda: order.amount, // Assuming same amount for total in the selected currency
            montoTotalSujetoIva: order.amount, // Assuming full amount is subject to IVA
            emailToSend: "", // Add customer email if available
            fechaEnvio: fechaEnvio,
            horaEnvio: horaEnvio,
        };

        return emitedInvoice;
    }


    async handleSubsidiaryUpdateAndCUF(emitedInvoiceData, currentOrder = undefined) {
        try {
            const codigoSucursal = emitedInvoiceData?.codigoSucursal || '0';
            const codigoPuntoVenta = emitedInvoiceData?.codigoPuntoVenta || '0';

            const filterSubsidiary = {
                codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal),
                codigoPuntoVenta: Utilities.convertToNumberIfNeeded(codigoPuntoVenta),
            };

            const subsidiary = await Subsidiary(this.currentMongoose).findOneAndUpdate(filterSubsidiary, { $inc: { numeroFactura: 1 } });

            const order = currentOrder || await Order(this.currentMongoose).createOrderWithEmitedInvoice(emitedInvoiceData, subsidiary);

            subsidiary.numeroFactura--;
            let leyenda = '';
            if (order.orderDetails && order.orderDetails.length > 0) {
                const codigos = new Sincronizacion({});
                const leyendaData = await codigos.getLeyenda(this.currentMongoose, subsidiary, order.orderDetails[0].economicActivity);
                leyenda = leyendaData.descripcionLeyenda;
            }

            emitedInvoiceData = {
                ...emitedInvoiceData,
                orderId: order._id,
                cuis: subsidiary?.RespuestaCuis?.codigo || '',
                cufd: subsidiary?.RespuestaCufd?.codigo || '',
                leyenda,
                usuario: '',
                nitEmisor: this.merchantConfig.facturacion?.nitEmisor || '',
                razonSocialEmisor: this.merchantConfig.facturacion?.razonSocialEmisor || '',
                direccion: subsidiary?.direccion || '',
                telefono: subsidiary?.telefono || '',
                municipio: subsidiary?.municipio || '',
                codigoMoneda: 1,
                tipoCambio: 1,
                descuentoAdicional: 0,
                codigoDocumentoSector: subsidiary.codigoDocumentoSector,
                codigoModalidad: this.merchantConfig.facturacion?.codigoModalidad || '1',
                tipoFacturaDocumento: subsidiary.tipoFactura || 1,
                codigoEmision: subsidiary.tipoEmision || 1,
                emailToSend: emitedInvoiceData.correo,
                fechaEmision: emitedInvoiceData.fechaEnvio,
                horaEmision: emitedInvoiceData.horaEnvio,
            };

            const CUF = GenerateInvoiceOnline.generateCuf({ tcFactura: emitedInvoiceData }, subsidiary);
            emitedInvoiceData.CUF = CUF;
            emitedInvoiceData.cuf = CUF;
            emitedInvoiceData.numeroFactura = subsidiary.numeroFactura;

            return { subsidiary, emitedInvoiceData };
        } catch (err) {
            console.error("[handleSubsidiaryUpdateAndCUF] Error:", err);
        }
    }

    async handleEmitedInvoice(dataEmitedInvoice, subsidiary, registerOnSai = true) {
        try {
            delete dataEmitedInvoice.id;
            delete dataEmitedInvoice._id;
            const emitedInvoice = new EmitedInvoice(this.currentMongoose)(dataEmitedInvoice);

            dataEmitedInvoice.montoTotal = Utilities.convertToFloat2(dataEmitedInvoice.montoTotal);
            dataEmitedInvoice.montoTotalMoneda = Utilities.convertToFloat2(dataEmitedInvoice.montoTotalMoneda);
            dataEmitedInvoice.montoTotalSujetoIva = Utilities.convertToFloat2(dataEmitedInvoice.montoTotalSujetoIva);

            const result = await GenerateInvoiceOnline.generateXmlAndPdfFromEmitedInvoice(
                this.currentMongoose,
                dataEmitedInvoice,
                subsidiary,
                this.merchantConfig
            );
            const dataBase = await GenerateInvoiceOnline.xmlToBase64(result.xmlData, emitedInvoice.cuf);

            dataEmitedInvoice.archivo = dataBase.archivo.toString('base64');
            dataEmitedInvoice.hashArchivo = dataBase.hashArchivo;
            dataEmitedInvoice.FacturaXML = dataBase.xmlBase64;

            const facturacion = new Facturacion({});
            const facturaEmitida = await facturacion.recepcionFactura(
                this.currentMongoose,
                dataEmitedInvoice,
                this.merchantConfig
            );

            dataEmitedInvoice.id = emitedInvoice.id;
            dataEmitedInvoice.fechaEmision = moment(`${dataEmitedInvoice.fechaEmision}T${dataEmitedInvoice.horaEnvio}`).toDate();
            const resp = await emitedInvoice.save();

            dataEmitedInvoice.merchantConfig = facturaEmitida.merchantConfig;
            if (dataEmitedInvoice.emailToSend) {
                mailer.sendEmitedInvoice(this.currentMongoose, dataEmitedInvoice, this.merchantConfig);
            }
            if (registerOnSai) {
                await this.registerInMakroSai(dataEmitedInvoice, emitedInvoice);
            }

            return resp;
        } catch (err) {
            console.log(`[handleEmitedInvoice] Error: `, err);
            const codigoSucursal = dataEmitedInvoice?.codigoSucursal || '0';
            const codigoPuntoVenta = dataEmitedInvoice?.codigoPuntoVenta || '0';
            await Subsidiary(this.currentMongoose)
                .updateOne(
                    { codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal), codigoPuntoVenta: Utilities.convertToNumberIfNeeded(codigoPuntoVenta) },
                    { $inc: { numeroFactura: -1 } }
                );

            throw err;
        }
    }
    async registerInMakroSai(dataEmitedInvoice, model = null, generateInvoiceInMakro = false) {
        try {
            console.log('[registerInMakroSai] before call [mapInvoiceToNote]')
            const invoiceToNote = this.mapInvoiceToNote(dataEmitedInvoice, generateInvoiceInMakro);
            if (!invoiceToNote) {
                console.error('[handleEmitedInvoice] [mapInvoiceToNote] Error: No existe invoiceToNote');
            }
            console.log('[registerInMakroSai] before call [notaDeVenta]')
            const sendInvoiceToMakro = await invoiceToMakro.notaDeVenta(invoiceToNote);
            if (!sendInvoiceToMakro) {
                console.error('[handleEmitedInvoice] [invoiceToMakro.notaDeVenta] Error: No se pudo registrar nota de venta en MAKRO');
            } else {
                if (model) {
                    if (sendInvoiceToMakro.datos && sendInvoiceToMakro?.datos.ntra) {
                        model.extraData = { ntra: sendInvoiceToMakro.datos.ntra };
                        await model.save();
                    } else {
                        console.error('[registerInMakroSai] [notaDeVenta] Error: No se recibió ntra en la respuesta', sendInvoiceToMakro);
                    }
                }
            }
        } catch (err) {
            console.log(`[registerInMakroSai] Error: `, err);
            throw err;
        }
    }
    mapInvoiceToNote(invoiceGenerated, generateInvoiceInMakro = false) {
        const formatDate = (iso) => {
            const d = new Date(iso);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        const formatTime = (iso) => {
            const d = new Date(iso);
            const hh = String(d.getHours());
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        };

        let factura = null;
        if (generateInvoiceInMakro) {
            factura = {
                ccuf: invoiceGenerated.cuf,
                nfac: invoiceGenerated.numeroFactura,
                femi: formatDate(invoiceGenerated.fechaEmision),
                hemi: formatTime(invoiceGenerated.fechaEmision),
                cdse: invoiceGenerated.codigoDocumentoSector,
                nsuc: parseInt(invoiceGenerated.codigoSucursal)
            };
        }

        return {
            ntro: `${invoiceGenerated.numeroFactura}`, // último 4 dígitos como nro transacción
            ftra: formatDate(invoiceGenerated.fechaEnvio),
            cage: 21092,
            cmon: 1,
            tcam: 6.96,
            impt: invoiceGenerated.montoTotal,
            pdsc: invoiceGenerated.descuentoAdicional || 0,
            idsc: invoiceGenerated.descuentoAdicional || 0,
            efectivo: {
                ncja: invoiceGenerated.codigoPuntoVenta,
                impo: invoiceGenerated.montoTotal
            },
            calm: 100,
            cloc: 102,
            tdid: parseInt(invoiceGenerated.codigoTipoDocumentoIdentidad, 10),
            ndid: invoiceGenerated.numeroDocumento,
            nomb: invoiceGenerated.nombreRazonSocial,
            emai: invoiceGenerated.correo || invoiceGenerated.emailToSend || '',
            factura,
            detalle: invoiceGenerated.detalle.map((item) => ({
                cart: item.codigoProducto,
                cant: item.cantidad,
                puni: item.precioUnitario,
                tota: item.subTotal,
                pdsc: parseFloat(item.montoDescuento) || 0,
                idsc: parseFloat(item.montoDescuento) || 0
            })),
            cven: 21092,
            hora: invoiceGenerated.horaEmision,
            glos: invoiceGenerated.leyenda || 'PRUEBA DE FACTURACION',
            usua: invoiceGenerated.usuario || 'JSS'
        };
    }
}

module.exports = InvoiceGenerator;
