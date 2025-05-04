class GenerateInvoiceOnline {
    static generateInvoiceXML(data) {
        let invoice = GenerateInvoiceOnline.validateAndConvertStringToJSON(data);

        return invoice;
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
            "Credencial": Credencial,
            "Nit": Nit,
            "RazonSocial": RazonSocial,
            "Direccion": Direccion,
            "Localidad": Localidad,
            "Telefonos": Telefonos
        };
    }

    static convertPuntoVentaStringToObject(inputString) {
        const [CodigoSucursal, CodigoPuntoVenta, NombreSucursal, NombrePuntoVenta, Direccion, Telefonos] = inputString.split('ß');

        return {
            "CodigoSucursal": !isNaN(CodigoSucursal) ? parseInt(CodigoSucursal) : CodigoSucursal,
            "CodigoPuntoVenta": !isNaN(CodigoPuntoVenta) ? parseInt(CodigoPuntoVenta) : CodigoPuntoVenta,
            "NombreSucursal": NombreSucursal,
            "NombrePuntoVenta": NombrePuntoVenta,
            "Direccion": Direccion,
            "Telefonos": Telefonos
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
            "NitEmisor": !isNaN(NitEmisor) ? parseInt(NitEmisor) : NitEmisor,
            "RazonSocialEmisor": RazonSocialEmisor,
            "Municipio": Municipio,
            "Telefono": Telefono,
            "NumeroFactura": !isNaN(NumeroFactura) ? parseInt(NumeroFactura) : NumeroFactura,
            "CodigoSucursal": !isNaN(CodigoSucursal) ? parseInt(CodigoSucursal) : CodigoSucursal,
            "Direccion": Direccion,
            "CodigoPuntoVenta": !isNaN(CodigoPuntoVenta) ? parseInt(CodigoPuntoVenta) : CodigoPuntoVenta,
            "FechaEmision": FechaEmision,
            "HoraEmision": HoraEmision,
            "NombreRazonSocial": NombreRazonSocial,
            "CodigoTipoDocumentoIdentidad": !isNaN(CodigoTipoDocumentoIdentidad) ? parseInt(CodigoTipoDocumentoIdentidad) : CodigoTipoDocumentoIdentidad,
            "NumeroDocumento": NumeroDocumento,
            "Complemento": Complemento,
            "CodigoCliente": CodigoCliente,
            "CodigoMetodoPago": !isNaN(CodigoMetodoPago) ? parseInt(CodigoMetodoPago) : CodigoMetodoPago,
            "NumeroTarjeta": !isNaN(NumeroTarjeta) ? parseInt(NumeroTarjeta) : NumeroTarjeta,
            "MontoTotal": MontoTotal.includes(',') ? parseFloat(MontoTotal.replace(',', '.')) : parseFloat(MontoTotal),
            "MontoTotalSujetoIva": MontoTotalSujetoIva.includes(',') ? parseFloat(MontoTotalSujetoIva.replace(',', '.')) : parseFloat(MontoTotalSujetoIva),
            "CodigoMoneda": !isNaN(CodigoMoneda) ? parseInt(CodigoMoneda) : CodigoMoneda,
            "TipoCambio": !isNaN(TipoCambio) ? parseInt(TipoCambio) : TipoCambio,
            "MontoGiftCard": MontoGiftCard.includes(',') ? parseFloat(MontoGiftCard.replace(',', '.')) : parseFloat(MontoGiftCard),
            "DescuentoAdicional": DescuentoAdicional.includes(',') ? parseFloat(DescuentoAdicional.replace(',', '.')) : parseFloat(DescuentoAdicional),
            "CodigoExcepcion": !isNaN(CodigoExcepcion) ? parseInt(CodigoExcepcion) : CodigoExcepcion,
            "Usuario": Usuario,
            "Sector": !isNaN(Sector) ? parseInt(Sector) : Sector,
            "CorreoCliente": CorreoCliente
        };
    }

    static convertFacturaDetalleStringToObject(inputString) {
        const items = inputString.split('þ');

        const facturaDetalle = items.map(item => {
            const [CodigoProducto, Descripcion, Cantidad, UnidadMedida, PrecioUnitario, MontoDescuento, SubTotal, NumeroSerie, NumeroImei] = item.split('ß');

            const [CodigoProductoToCopy, ActividadEconomica, CodigoProductoSiat] = CodigoProducto.split('¦');
            return {
                "CodigoProducto": CodigoProductoToCopy,
                "ActividadEconomica": ActividadEconomica,
                "CodigoProductoSiat": CodigoProductoSiat,
                "Descripcion": Descripcion,
                "Cantidad": !isNaN(Cantidad) ? parseInt(Cantidad) : Cantidad,
                "UnidadMedida": !isNaN(UnidadMedida) ? parseInt(UnidadMedida) : UnidadMedida,
                "PrecioUnitario": PrecioUnitario.includes(',') ? parseFloat(PrecioUnitario.replace(',', '.')) : parseFloat(PrecioUnitario),
                "MontoDescuento": MontoDescuento.includes(',') ? parseFloat(MontoDescuento.replace(',', '.')) : parseFloat(MontoDescuento),
                "SubTotal": SubTotal.includes(',') ? parseFloat(SubTotal.replace(',', '.')) : parseFloat(SubTotal),
                "NumeroSerie": NumeroSerie,
                "NumeroImei": NumeroImei
            };
        });

        return facturaDetalle;
    }
}

module.exports = GenerateInvoiceOnline;
