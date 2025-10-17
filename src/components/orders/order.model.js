// grab the things we need
const mongoose = require("mongoose");
const COMMON_STATUS = require("./../../commons/commonStatus/");

const { Schema } = mongoose;
var COMMON_CURRENCY_TYPES = require('../../commons/commonCurrencyTypes');
const Utilities = require("../../commons/utilities");

// create a schema
const OrderSchema = new Schema({
  orderNumber: {
    type: Number,
  },
  clientCode: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  orderDetails: [
    {
      code: String,
      SINCode: String,
      economicActivity: String,
      description: String,
      quantity: Number,
      unitAmount: Number,
      currency: String,
      discount: Number,
    },
  ],
  shipping: {
    type: Number,
    required: true,
    default: 0,
  },
  status: {
    type: String,
    required: true,
    default: COMMON_STATUS.PENDING,
  },
  transitory: {
    type: Boolean,
    required: true,
    default: false,
  },
  codigoSucursal: {
    type: Number,
    required: true,
    default: 0,
  },
  codigoPuntoVenta: {
    type: Number,
    required: true,
    default: 0,
  },
  recurrent: { type: Boolean, default: false },
  payments: [
    {
      paymentId: { type: String },
      currency: { type: String },
      totalAmount: {
        type: Number,
        default: 0,
      },
      createdOn: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  recurrence: {
    recurrenceType: { type: String },
    quantity: { type: Number },
  },
  appointments: [
    {
      appointmentId: String,
      name: String,
      totalAmount: Number,
    },
  ],
  orderGeneratorId: String,
  descuentoAdicional: Number,
  montoGiftCard: Number,
  numeroTarjeta: String,
  codigoMoneda: Number,
  tipoCambio: Number,
  extraData: { ntra: String },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
});

// Middleware to update 'updatedOn' field
OrderSchema.pre("save", function (next) {
  if (!this.isNew) {
    this.updatedOn = new Date();
  }
  next();
});

// Methods
OrderSchema.methods.createOrder = async function () {
  try {
    const resp = await this.save();
    return resp;
  } catch (err) {
    throw new Error(err.message);
  }
};

// Statics
OrderSchema.statics.createOrderWithEmitedInvoice = async function (invoiceData, subsidiary = undefined) {
  try {
    const orderToSave = convertInvoiceToOrder(invoiceData, subsidiary);
    const order = new this(orderToSave);
    await order.save();
    return order;
  } catch (err) {
    console.error("[createOrderWithEmitedInvoice] Error: ", err)
    throw new Error(err.message);
  }
};

const convertInvoiceToOrder = (invoice, subsidiary) => {
  // Calculate total amount from all items in 'detalle'
  let totalAmount = 0;

  const orderDetails = invoice.detalle.map((item) => {
    const unitAmount = Utilities.convertToFloat2(item.precioUnitario);
    const quantity = Utilities.convertToFloat2(item.cantidad);
    const subTotal = Utilities.convertToFloat2(unitAmount * quantity); // Calculate subTotal for each item

    totalAmount += subTotal; // Sum up all subtotals to get the total amount

    return {
      description: item.descripcion || undefined, // Map from descripcion
      code: item.codigoProducto || undefined, // Map from codigoProducto
      SINCode: item.codigoProductoSiat || undefined, // Map from codigoProductoSiat
      economicActivity: item.actividadEconomica || undefined, // Map from actividadEconomica
      quantity: quantity, // Parsed from cantidad
      unitAmount: unitAmount, // Parsed from precioUnitario
      currency: COMMON_CURRENCY_TYPES.BOB.code,
    };
  });

  return {
    clientCode: invoice.codigoCliente, // Default value
    status: COMMON_STATUS.PENDING,
    amount: totalAmount, // Convert to float
    currency: COMMON_CURRENCY_TYPES.BOB.code,
    recurrent: false,
    subsidiaryCode: subsidiary ? subsidiary.code : '', // Default value
    codigoSucursal: invoice.codigoSucursal ? parseInt(invoice.codigoSucursal) : 0, // Parsed from invoice
    codigoPuntoVenta: invoice.codigoPuntoVenta ? parseInt(invoice.codigoPuntoVenta) : 0, // Parsed from invoice
    orderDetails
  };
}

// Create and export the model
var Order = function (mongooseCon) {
  return mongooseCon.model("Order", OrderSchema);
};
module.exports = Order;
