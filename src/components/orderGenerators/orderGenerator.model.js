const mongoose = require("mongoose");
const { Schema } = mongoose;
const ORDER_GENERATOR_STATUS = require("../../commons/orderGeneratorStatus");
const GeneratedProduct = require("../generatedProducts/generatedProduct.model");

// Define the OrderGenerator schema
const OrderGeneratorSchema = new Schema({
  description: {
    type: String,
    required: true,
    default: "NO",
  },
  startDayHour: {
    type: Number,
    required: true,
    default: 7
  },
  endDayHour: {
    type: Number,
    required: true,
    default: 19
  },
  executionStartDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  executionEndDate: {
    type: Date,
    required: true,
  },
  minAmountPerOrder: {
    type: Number,
    required: true,
  },
  maxAmountPerOrder: {
    type: Number,
    required: true,
  },
  totalAmountOfOrders: {
    type: Number,
    required: true,
  },
  blankInvoices: {
    type: Boolean,
    required: true,
    default: true,
  },
  generateInvoices: {
    type: Boolean,
    required: true,
    default: false,
  },
  accumulatedOrderList: [
    {
      orderId: String,
      emitedInvoiceId: String,
      amount: Number,
      date: Date, // Add the date field to track the order creation date
    },
  ],
  status: {
    type: Number,
    required: true,
    default: ORDER_GENERATOR_STATUS.STARTED.code,
    enum: Object.values(ORDER_GENERATOR_STATUS).map((status) => status.code),
  },
  codigoSucursal: Number,
  codigoPuntoVenta: Number,
  createdBy: {
    type: String,
  },
  updatedBy: {
    type: String,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  updatedOn: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save hook to update `updatedOn` for existing documents
OrderGeneratorSchema.pre("save", function (next) {
  if (!this.isNew) {
    this.updatedOn = new Date();
  }
  next();
});

// Static method to create an order generator
OrderGeneratorSchema.statics.create = async function (currentMongoose, data) {
  try {
    const orderGenerator = new OrderGenerator(currentMongoose)(data);
    await GeneratedProduct(currentMongoose).createAllByOrderGeneratorId(
      currentMongoose,
      data.generatedProducts,
      orderGenerator._id
    );
    const newOrderGenerator = await orderGenerator.save();
    if (!newOrderGenerator) {
      throw new Error("No se pudo crear la generacion de ordenes");
    }
    return newOrderGenerator;
  } catch (err) {
    throw err;
  }
};

// Static method to update an order generator
OrderGeneratorSchema.statics.updateOrderGenerator = async function (currentMongoose, orderGeneratorId, data) {
  try {
    if (data.generatedProducts) {
      const deleted = await GeneratedProduct(currentMongoose).deleteMany({ orderGeneratorId })
      await GeneratedProduct(currentMongoose).createAllByOrderGeneratorId(
        currentMongoose,
        data.generatedProducts,
        orderGeneratorId
      );
    }
    const updatedOrderGenerator = await OrderGenerator(currentMongoose).findByIdAndUpdate(
      orderGeneratorId,
      data,
      { new: true }
    );
    return updatedOrderGenerator;
  } catch (err) {
    throw err;
  }
};

// Static method to delete an order generator
OrderGeneratorSchema.statics.deleteOrderGenerator = async function (currentMongoose, orderGeneratorId) {
  try {
    const foundOrderGenerator = await this.findById(orderGeneratorId);
    if (!foundOrderGenerator.accumulatedOrderList || foundOrderGenerator.accumulatedOrderList.length == 0) {
      const deleted = await GeneratedProduct(currentMongoose).deleteMany({ orderGeneratorId })
      const updatedOrderGenerator = await OrderGenerator(currentMongoose).findByIdAndDelete(orderGeneratorId);
      return updatedOrderGenerator;
    } else {
      throw new Error('Ya Existen ordenes generadas por este generador de ordenes no se puede borrar.')
    }
  } catch (err) {
    throw err;
  }
};

// Factory function to create a model using the schema and provided mongoose connection
const OrderGenerator = function (mongooseCon) {
  return mongooseCon.model("OrderGenerator", OrderGeneratorSchema);
};

// Export the model factory
module.exports = OrderGenerator;
