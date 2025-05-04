const config = require("../../../config/config");
const axios = require('axios');

class InvoiceToMakro {
    constructor() {
        this.token = null;
    }

    async getToken() {
        return await this.autorizacion();
    }

    async notaDeVenta(invoiceToNote) {
        try {
            const token = await this.getToken();

            const response = await axios.post(
                `${config.EXTERNAL_MAKRO_URL}/sai-api/invoice/api/Ventas/NotaDeVenta`,
                invoiceToNote,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.datos && response.data.resp == 0) {
                return response.data;
            } else {
                console.error("❌ Error al procesar nota de venta:", response.data);
                throw new Error("❌ No se pudo procesar la nota de venta.");
            }
        } catch (error) {
            console.error("❌ Error en notaDeVenta:", error.message);
            throw error;
        }
    }

    async reversionNotaDeVenta(numeroFactura, usuario = "JSS") {
        try {
            const token = await this.getToken();

            const response = await axios.post(
                `${config.EXTERNAL_MAKRO_URL}/sai-api/invoice/api/Ventas/Reversionnotadeventa`,
                {
                    numeroFactura: numeroFactura || "2614",
                    frev: "",
                    usua: usuario
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.xml_firmado) {
                return response.data.xml_firmado;
            } else {
                console.error("❌ Error revirtiendo nota:", response.data);
                throw new Error("❌ No se pudo revertir la nota.");
            }
        } catch (error) {
            console.error("❌ Error en reversionNotaDeVenta:", error.message);
            throw error;
        }
    }

    async autorizacion() {
        try {
            const response = await axios.post(
                `${config.EXTERNAL_MAKRO_URL}/sai-api/invoice/api/Cliente/Autorizacion`,
                {
                    user: "uapivt_mkp@prueba",
                    pass: "clav_webapi2k5"
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.data && response.data.datos && response.data.datos.token) {
                this.token = response.data.datos.token;
                return this.token;
            } else {
                console.error("❌ Error en Autorización:", response.data);
                throw new Error("❌ No se pudo obtener el token.");
            }
        } catch (error) {
            console.error("❌ Error en Autorización:", error.message);
            throw error;
        }
    }
}

module.exports = InvoiceToMakro;
