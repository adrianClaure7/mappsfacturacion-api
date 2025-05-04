const moment = require('moment');
const bigInt = require('big-integer');

class CufGenerator {
    constructor(CUF) {
        this.CUF = CufGenerator.copyCUFValues(CUF);
        this.CUF.fechaEmision = moment(CUF.fechaEmision).format('yyyyMMDDHHmmssSSS');
    }

    static copyCUFValues(CUF) {
        const cufObject = {
            nitEmisor: CUF.nitEmisor || 0,
            fechaEmision: CUF.fechaEmision || '',
            codigoSucursal: CUF.codigoSucursal || 0,
            modalidad: CUF.modalidad || 0,
            tipoEmision: CUF.tipoEmision || 0,
            tipoFactura: CUF.tipoFactura || 0,
            tipoDoc: CUF.tipoDoc || 0,
            numeroFactura: CUF.numeroFactura || 0,
            codigoPuntoVenta: CUF.codigoPuntoVenta || 0
        };

        return cufObject;
    }

    completeDataWithZeros() {
        var dataSizes = {
            nitEmisor: {
                value: this.CUF.nitEmisor,
                size: 13
            },
            fechaEmision: {
                value: this.CUF.fechaEmision,
                size: 17
            },
            codigoSucursal: {
                value: this.CUF.codigoSucursal,
                size: 4
            },
            modalidad: {
                value: this.CUF.modalidad,
                size: 1
            },
            tipoEmision: {
                value: this.CUF.tipoEmision,
                size: 1
            },
            tipoFactura: {
                value: this.CUF.tipoFactura,
                size: 1
            },
            tipoDoc: {
                value: this.CUF.tipoDoc,
                size: 2
            },
            numeroFactura: {
                value: this.CUF.numeroFactura,
                size: 10
            },
            codigoPuntoVenta: {
                value: this.CUF.codigoPuntoVenta,
                size: 4
            }
        };

        return this.zeroPad(dataSizes.nitEmisor) +
            this.zeroPad(dataSizes.fechaEmision) +
            this.zeroPad(dataSizes.codigoSucursal) +
            this.zeroPad(dataSizes.modalidad) +
            this.zeroPad(dataSizes.tipoEmision) +
            this.zeroPad(dataSizes.tipoFactura) +
            this.zeroPad(dataSizes.tipoDoc) +
            this.zeroPad(dataSizes.numeroFactura) +
            this.zeroPad(dataSizes.codigoPuntoVenta);
    }

    zeroPad(data) {
        if (typeof data.value === 'string') {
            return data.value.padStart(data.size, "0");
        }
        return data.value.toString().padStart(data.size, "0");
    }

    module11Algorith(text, digitNumber, limit, x10) {
        var mult, sum, i, n, digit;

        if (!x10) {
            digitNumber = 1;
        }
        for (n = 1; n <= digitNumber; n++) {
            sum = 0;
            mult = 2;
            for (i = text.length - 1; i >= 0; i--) {
                sum += (mult * parseInt(text.substring(i, i + 1)));
                if (++mult > limit) {
                    mult = 2;
                }
            }
            if (x10) {
                digit = ((sum * 10) % 11) % 10;
            } else {
                digit = sum % 11;
            }
            if (digit == 10) {
                text += '1';
            }
            if (digit == 11) {
                text += '0';
            }
            if (digit < 10) {
                text += digit.toString().valueOf();
            }
        }

        return text.substring(text.length - digitNumber, text.length);
    }

    generateBase16() {
        var digits = this.completeDataWithZeros();
        var data = bigInt(digits + this.module11Algorith(digits, 1, 9, false));

        return data.toString(16);
    }

    generateCuf() {
        return this.generateBase16().toUpperCase();
    }
}

module.exports = CufGenerator;