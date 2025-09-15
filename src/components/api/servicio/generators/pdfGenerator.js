const { jsPDF } = require("jspdf"); // will automatically load the node version
require('jspdf-autotable'); // Import jsPDF's autoTable plugin for handling tables
const NumeroALetras = require("../../../../commons/numerosALetras");
const TIPOS_EMISION = require("../../../../commons/tiposEmision");
const LEYENDAS_COMUNES = require("../../../../commons/leyendasComunes");
var QRCode = require('qrcode');
const fs = require('fs');
const moment = require('moment-timezone');
var INVOICE_ROUTES = require("../../../../commons/invoiceRoutes");
const Utilities = require("../../../../commons/utilities");

class PDFGenerator {
    constructor() { }

    static createInvoicePDF = (data, canceledInvoice = false) => {
        return new Promise((resolve, reject) => {
            var doc = new jsPDF({ putOnlyUsedFonts: true });
            const pageWidth = doc.internal.pageSize.getWidth(); // Get the page width
            const margin = 10; // Define the margin on both sides
            const tableWidth = pageWidth * 0.8; // 80% of the PDF width
            const razonSocialX = margin; // Use the same X position as "Nombre/Razón Social"
            const leftMargin = razonSocialX; // Align the table to start at this position

            let currentY = 20; // Start point after the header

            // Header Information
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(data.razonSocialEmisor, margin, currentY);
            currentY += 5;

            doc.text(data.subsidiaryName || "Casa Matriz", margin, currentY);
            currentY += 5;

            doc.setFont("helvetica", "normal");
            doc.text(`No Punto de Venta - ${data.codigoPuntoVenta || 0}`, margin, currentY);
            currentY += 5;

            const direccion = data.direccion || '';
            const maxCharsPerLine = 60;
            let startIndex = 0;
            while (startIndex < direccion.length) {
                const line = direccion.substring(startIndex, startIndex + maxCharsPerLine);
                doc.text(line, margin, currentY);
                currentY += 5;
                startIndex += maxCharsPerLine;
            }

            doc.text(`Telefono: ${data.telefono}`, margin, currentY);
            currentY += 5;

            doc.text(data.municipio, margin, currentY);
            currentY += 5;

            // RIGHT SIDE HEADER
            doc.setFont("helvetica", "bold");
            doc.text(`NIT:`, pageWidth - margin - 50, 20); // Right-aligned NIT
            doc.setFont("helvetica", "normal");
            doc.text(`${data.nitEmisor}`, pageWidth - margin, 20, null, null, "right");

            doc.setFont("helvetica", "bold");
            doc.text(`FACTURA Nº:`, pageWidth - margin - 50, 25);
            doc.setFont("helvetica", "normal");
            doc.text(`${data.numeroFactura}`, pageWidth - margin, 25, null, null, "right");

            // Splitting CUF into parts for easier reading (fixed splitting)
            let part1 = data.cuf.slice(0, 18);
            let part2 = data.cuf.slice(18, 36);
            let part3 = data.cuf.slice(36, 54);
            let part4 = data.cuf.slice(54);

            doc.setFont("helvetica", "bold");
            doc.text(`COD. AUTORIZACIÓN:`, pageWidth - margin - 50, 30);
            doc.setFont("helvetica", "normal");
            doc.text(`${part1}`, pageWidth - margin, 35, null, null, "right");
            doc.text(`${part2}`, pageWidth - margin, 40, null, null, "right");
            doc.text(`${part3}${part4}`, pageWidth - margin, 45, null, null, "right");

            currentY = 60; // Adjust Y to start after the header

            // Center Mid Section
            doc.setFont("helvetica", "bold");
            doc.text("FACTURA", pageWidth / 2, currentY, null, null, "center");
            currentY += 5;

            doc.setFont("helvetica", "normal");
            doc.text("(Con Derecho a Crédito Fiscal)", pageWidth / 2, currentY, null, null, "center");
            currentY += 10;

            // Align Fecha and NIT/CI/CEX on the same Y position
            doc.setFont("helvetica", "bold");
            doc.text("Fecha:", margin, currentY); // Fecha starts at the margin
            doc.setFont("helvetica", "normal");
            if (data.horaEmision) {
                doc.text(`${data.fechaEmision} ${data.horaEmision.slice(0, 5)}`, margin + 50, currentY);
            } else {
                doc.text(moment(data.fechaEmision).tz("America/La_Paz").format('DD-MM-YYYY HH:mm'), margin + 50, currentY);
            }

            // Align NIT/CI/CEX to the same Y position as Fecha
            doc.setFont("helvetica", "bold");
            doc.text("NIT/CI/CEX:", pageWidth - margin - 60, currentY); // Align at the same Y as Fecha
            doc.setFont("helvetica", "normal");
            doc.text(`${data.numeroDocumento}`, pageWidth - margin - 15, currentY, null, null, "right");

            currentY += 5;

            // Align Nombre/Razón Social and Cod. Cliente at the same X and Y positions
            doc.setFont("helvetica", "bold");
            doc.text("Nombre/Razón Social:", margin, currentY); // Title positioning
            doc.setFont("helvetica", "normal");
            doc.text(`${data.nombreRazonSocial}`, margin + 50, currentY); // Include Razon Social Data

            // Align Cod. Cliente with the same X position as NIT/CI/CEX and same Y position as Nombre/Razón Social
            doc.setFont("helvetica", "bold");
            doc.text("Cod. Cliente:", pageWidth - margin - 60, currentY); // Cod. Cliente aligned with NIT/CI/CEX X position
            doc.setFont("helvetica", "normal");
            doc.text(`${data.codigoCliente || 'N/A'}`, pageWidth - margin - 15, currentY, null, null, "right");

            currentY += 10;

            // Prepare table content for autoTable
            let tableData = [];
            let subTotal = 0;

            (data.tcFacturaDetalle || data.detalle).forEach(element => {
                subTotal += Utilities.convertToFloat2(Utilities.convertToFloat2(element.precioUnitario) * Utilities.convertToFloat2(element.cantidad));

                tableData.push({
                    codigoProducto: element.codigoProducto,
                    descripcion: element.descripcion,
                    cantidad: `${Utilities.convertToFloat2(element.cantidad)}`,
                    precioUnitario: `${Utilities.convertToFloat2(element.precioUnitario).toFixed(2)}`,
                    subTotal: `${(Utilities.convertToFloat2(element.precioUnitario) * Utilities.convertToFloat2(element.cantidad)).toFixed(2)}`
                });
            });

            // Add SUBTOTAL and other values in rows with merged columns for CANTIDAD and PRECIO UNITARIO
            tableData.push({ codigoProducto: "", descripcion: "", cantidad: "SUBTOTAL Bs.", precioUnitario: "", subTotal: `${subTotal.toFixed(2)}` });
            tableData.push({ codigoProducto: "", descripcion: "", cantidad: "DESCUENTO Bs.", precioUnitario: "", subTotal: `0.00` });
            tableData.push({ codigoProducto: "", descripcion: "", cantidad: "TOTAL Bs.", precioUnitario: "", subTotal: `${subTotal.toFixed(2)}` });
            tableData.push({ codigoProducto: "", descripcion: "", cantidad: "MONTO GIFT CARD Bs.", precioUnitario: "", subTotal: `0.00` });
            tableData.push({ codigoProducto: "", descripcion: "", cantidad: "MONTO A PAGAR Bs.", precioUnitario: "", subTotal: `${subTotal.toFixed(2)}` });
            tableData.push({ codigoProducto: "", descripcion: "", cantidad: "IMPORTE BASE CRÉDITO FISCAL Bs.", precioUnitario: "", subTotal: `${subTotal.toFixed(2)}` });

            const totalRowCount = tableData.length;

            // Adjusted column widths for 80% width of PDF
            const columnWidths = {
                0: { cellWidth: tableWidth * 0.15 }, // CODIGO
                1: { cellWidth: tableWidth * 0.35 }, // DESCRIPCIÓN
                2: { cellWidth: tableWidth * 0.25 }, // CANTIDAD
                3: { cellWidth: tableWidth * 0.25, halign: 'right' } // SUBTOTAL (right-aligned)
            };

            // Use autoTable to render the table, aligned with Nombre/Razón Social title and tiny borders
            doc.autoTable({
                startY: currentY,
                margin: { left: leftMargin }, // Align table with Nombre/Razón Social X position
                head: [['CODIGO', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO UNITARIO', 'SUBTOTAL']],
                body: tableData.map((item, index) => {
                    if (index < totalRowCount - 6) {
                        // Regular details section (before totals)
                        return [
                            { content: item.codigoProducto, styles: { lineWidth: 0.1 } },
                            { content: item.descripcion, styles: { lineWidth: 0.1 } },
                            item.cantidad,
                            item.precioUnitario,
                            { content: item.subTotal, styles: { halign: 'right' } }
                        ];
                    } else {
                        // Totals section: Merge CANTIDAD and PRECIO UNITARIO columns
                        return [
                            {
                                content: index === totalRowCount - 3 ? `Son: ${NumeroALetras.numeroALetras(subTotal)}` : '',
                                colSpan: 2,
                                styles: { halign: 'center', fontStyle: 'bold', lineWidth: 0, lineColor: [0, 0, 0], borderTop: true } // Add top border here
                            },
                            { content: item.cantidad, colSpan: 2, styles: { halign: 'center', lineWidth: 0.1, fontStyle: 'bold' } }, // Merged CANTIDAD and PRECIO UNITARIO
                            { content: item.subTotal, styles: { halign: 'right', lineWidth: 0.1 } } // Right-aligned SUBTOTAL column
                        ];
                    }
                }),
                styles: {
                    fontSize: 9,
                    cellPadding: 2,
                    lineWidth: 0.1, // Minimal borders
                    lineColor: [0, 0, 0], // Black border color
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: [10, 10, 10], // Light blue for header
                },
                columnStyles: columnWidths,
                theme: 'grid',
                tableWidth: 'wrap', // Adjust table width to fit the content
            });

            // Update currentY after table rendering
            const tableY = doc.lastAutoTable.finalY;
            currentY = tableY + 10;

            // Final Section: QR Code and Leyenda (with correct padding)
            const infoToQR = PDFGenerator.getInvoiceToGenerateQRCode(data);
            QRCode.toDataURL(infoToQR)
                .then(url => {
                    doc.addImage(url, "PNG", pageWidth - margin - 50, currentY, 45, 45);

                    // Leyenda
                    doc.setFont("helvetica", "normal");
                    doc.text(LEYENDAS_COMUNES.LEYENDA_DEFAULT, leftMargin, currentY + 10, { maxWidth: 133 });
                    doc.text(data.leyenda || '', leftMargin, currentY + 25, { maxWidth: 133 });

                    let leyenda3 = LEYENDAS_COMUNES.LEYENDA_ONLINE;
                    if (data.codigoEmision == TIPOS_EMISION.OFFLINE.code) {
                        leyenda3 = LEYENDAS_COMUNES.LEYENDA_OFFLINE;
                    }
                    doc.text(leyenda3, leftMargin, currentY + 40, { maxWidth: 133 });

                    const docFileName = `${data.cuf}.pdf`;
                    doc.save(docFileName); // Save the PDF

                    const archivo = fs.readFileSync(docFileName);
                    const response = { pdfBase64: archivo.toString('base64'), invoice: data };
                    fs.unlink(docFileName, (err) => {
                        resolve(response);
                    });
                })
                .catch(err => {
                    reject(err);
                });

            // If the invoice is canceled
            if (canceledInvoice) {
                doc.setTextColor(255, 0, 0);
                doc.setFillColor(255, 0, 0, 0.2);
                doc.setFontSize(50);
                doc.text("ANULADA", margin, currentY, { width: 133 });
                doc.setFontSize(10);
                doc.setFillColor(0, 0, 0, 0);
                doc.setFillColor(0, 0, 0, 0);
            }
        });
    }

    static getInvoiceToGenerateQRCode(data) {
        const codigoAmbiente = data.merchantConfig && data.merchantConfig.facturacion ? `${data.merchantConfig.facturacion.codigoAmbiente}` : '2';
        const qrUrl = codigoAmbiente == '2' ? INVOICE_ROUTES.QR_URL : INVOICE_ROUTES.QR_URL_PROD;
        return `${qrUrl}?nit=${data.nitEmisor}&cuf=${data.cuf}&numero=${data.numeroFactura}&t=${data.tamano || 2}`;
    }
}

module.exports = PDFGenerator;
