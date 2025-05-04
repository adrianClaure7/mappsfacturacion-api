// grab the things we need
var mongoose = require("mongoose");
var Schema = mongoose.Schema;
const Dsig = require("../api/dsig");

// create a schema
var OnlineInvoiceSchema = new Schema({
  orderId: { type: String },
  nitEmisor: { type: Number, required: true }, // SI - Número de NIT registrado en el Padrón Nacional de Contribuyentes que corresponde a la persona o empresa que emite la factura.
  razonSocialEmisor: { type: String, required: true }, // SI - Razón Social o nombre registrado en el Padrón Nacional de Contribuyentes de la persona o empresa que emite la factura.
  municipio: { type: String, required: true }, // SI - Nombre del departamento o municipio que se refleja en la Factura. 
  telefono: { type: String }, // NO - Número de teléfono que se refleja en la Factura.
  numeroFactura: { type: Number, required: true }, // SI - Numeración propia que se le asigna a la Factura.
  cuf: { type: String, required: true }, // SI - Código único de facturación (CUF) debe ser generado por el emisor siguiendo el algoritmo indicado.
  cufd: { type: String, required: true }, // SI - Código único de facturación diario (CUFD), valor único que se obtiene al consumir el servicio web correspondiente.
  codigoSucursal: { type: Number, required: true }, // SI - Código de la sucursal registrada en el Padrón y en la cual se está emitiendo la factura.
  direccion: { type: String, required: true }, // SI - Dirección de la sucursal registrada en el Padrón Nacional de Contribuyentes.
  codigoPuntoVenta: { type: Number }, // NO - Código del punto de Venta creado mediante un servicio web y en el cual se emite la factura.
  fechaEmision: { type: Date, required: true }, // SI - Fecha y hora en la cual se emite la factura. Expresada en formato UTC Extendido, por ejemplo: “2020-02-15T08:40:12.215”.
  nombreRazonSocial: { type: String, required: true }, // NO - Razón Social o nombre de la persona u empresa a la cual se emite la factura.
  codigoTipoDocumentoIdentidad: { type: Number, required: true }, // SI - Valor de la paramétrica que identifica el Tipo de Documento utilizado para la emisión de la factura. Puede contener valores del 1 al 5.
  numeroDocumento: { type: String, required: true }, // SI - Número que corresponde al Tipo de Documento Identidad utilizado y al cual se realizará la facturación.
  complemento: { type: String, required: true }, // NO - Valor que otorga el SEGIP en casos de cédulas de identidad con número duplicado, En otro caso enviar un valor nulo agregando en la Etiqueta xsi:nil=”true”.
  codigoCliente: { type: String, required: true }, // SI - Código de identificación único del cliente, deberá ser asignado por el sistema de facturación del contribuyente.
  codigoMetodoPago: { type: Number, required: true }, // SI - Valor de la paramétrica que identifica el método de pago utilizado para realizar la compra. Por ejemplo 1 que representa a un pago en efectivo.
  numeroTarjeta: { type: Number, required: true }, // NO - Cuando el método de pago es 2 (Tarjeta), debe enviarse este valor pero ofuscado con los primeros y últimos 4 dígitos en claro y ceros al medio. Ej: 4797000000007896, en otro caso, debe enviarse un valor nulo.
  montoTotal: { type: Number, required: true }, // SI - Monto total por el cual se realiza el hecho generador.
  montoTotalSujetoIva: { type: Number, required: true }, // SI - Monto base para el cálculo del crédito fiscal.
  montoGiftCard: { type: Number }, // NO - Monto a ser cancelado con una Gift Card
  descuentoAdicional: { type: Number }, // NO - Monto Adicional al descuento por item
  codigoExcepcion: { type: Number }, // NO - Valor que se envía para autorizar el registro de una factura con NIT inválido. Por defecto, enviar cero (0) o nulo y uno (1) cuando se autorice el registro.
  cafc: { type: String }, // NO -  Código de Autorización de Facturas por Contingencia
  codigoMoneda: { type: Number, required: true }, // SI -	Valor de la paramétrica que identifica la moneda en la cual se realiza la transacción.
  tipoCambio: { type: Number, required: true }, // SI - Tipo de cambio de acuerdo a la moneda en la que se realiza el hecho generador, si el código de moneda es boliviano deberá ser igual a 1.
  montoTotalMoneda: { type: Number }, // SI - Es el Monto Total expresado en el tipo de moneda, si el código de moneda es boliviano deberá ser igual al monto total.
  leyenda: { type: String, required: true }, // SI - Leyenda asociada a la actividad económica.
  usuario: { type: String, required: true }, // SI - Identifica al usuario que emite la factura, deberá ser descriptivo. Por ejemplo JPEREZ
  codigoDocumentoSector: { type: Number, required: true }, // SI - Valor de la paramétrica que identifica el tipo de factura que se está emitiendo. Para este tipo de factura este valor es 1.
  detalle: [{
    actividadEconomica: { type: String, required: true }, // SI - Actividad económica registrada en el Padrón Nacional de Contribuyentes relacionada al NIT.
    codigoProductoSin: { type: Number, required: true }, // SI - Homologado a los códigos de productos genéricos enviados por el SIN a través del servicio de sincronización.
    codigoProducto: { type: String, required: true }, // SI - Código que otorga el contribuyente a su servicio o producto.
    descripcion: { type: String, required: true }, // SI - Descripción que otorga el contribuyente a su servicio o producto.
    cantidad: { type: Number, required: true }, // SI - Cantidad del producto o servicio otorgado. En caso de servicio este valor debe ser 1.
    unidadMedida: { type: Number, required: true }, // SI - Valor de la paramétrica que identifica la unidad de medida.
    precioUnitario: { type: Number, required: true }, // SI - Precio que otorga el contribuyente a su servicio o producto.
    montoDescuento: { type: Number }, // NO - Monto de descuento sobre el producto o servicio específico,  Si no aplica deberá ser nulo.
    subTotal: { type: Number, required: true }, // SI - El subtotal es igual a la (cantidad * precio unitario) – descuento.
    numeroSerie: { type: String }, // NO - Número de serie correspondiente al producto vendido de línea blanca o negra. Nulo en otro caso.
    numeroImei: { type: String }, // NO - Número de Imei del celular vendido. Nulo en otro caso.
  }],
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: { type: Date }, default: { type: Date }.now },
  updatedOn: { type: { type: Date }, default: { type: Date }.now }
});

OnlineInvoiceSchema.pre("save", function (next) {
  var onlineOnlineInvoice = this;

  if (!onlineOnlineInvoice.isNew) onlineOnlineInvoice.updatedOn = new { type: Date }();

  next();
});


OnlineInvoiceSchema.statics.createXML = function (currentMongoose, xmlObject) {

  return new Promise((resolve, reject) => {
    try {
      try {
        const signer = new Dsig('src/commons/certificates/ISRAELANTONIOCABRERASANCHEZ.p12', '4994872');
        const signedXML = signer.signXML(xmlObject.xml);
        resolve(signedXML)
      } catch (e) {
        console.error(e);
        reject(e);
      } finally {
        dsig.closeSession();
      }
    } catch (e) {
      reject(e);
    }
  });
};



// the schema is useless so far
// we need to create a model using it
var OnlineInvoice = function (mongooseCon) {
  return mongooseCon.model("OnlineInvoice", OnlineInvoiceSchema);
};
// make this available to our users in our Node applications
module.exports = OnlineInvoice;
