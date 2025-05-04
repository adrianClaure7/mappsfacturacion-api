class ApiFunctions {
    constructor() { }

    validResponse(data, message = undefined, messageSistema = undefined) {
        const response = {
            error: 0,
            status: 1,
            message: message || "Autenticación exitosa",
            messageMostrar: 0,
            messageSistema: messageSistema || "Authenticacion exitosa",
            values: data
        }
        return response;
    }

    errorResponse(data, message = undefined, messageSistema = undefined) {
        const response = {
            error: 1,
            status: 1,
            message: message || "Autenticación exitosa",
            messageMostrar: 0,
            messageSistema: messageSistema || "Authenticacion exitosa",
            values: data
        }
        return response;
    }

    errorResponseAxon(message = undefined) {
        const response = {
            error: 1,
            "respuesta": {
                "codRespuesta": "1",
                "txtRespuesta": message || "Autenticación exitosa",
            },
            "proceso": null,
            "facturaCompraVenta": null,
            "facturaCompraVentaBon": null,
            "facturaAlquiler": null,
            "facturaEntidadFinanciera": null,
            "facturaColegio": null,
            "notaMonedaExtranjera": null,
            "notaCreditoDebito": null,
            "facturaSeguros": null,
            "facturaComercialExportacionServicio": null
        }
        return response;
    }
}

module.exports = ApiFunctions;
