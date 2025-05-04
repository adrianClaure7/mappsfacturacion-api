const mongoose = require("mongoose");
const { Schema } = mongoose;
const COMMON_CURRENCY_TYPES = require('../../commons/commonCurrencyTypes');

// Define the schema
const GeneratedProductSchema = new Schema({
  orderGeneratorId: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  SINCode: {
    type: String,
    required: true,
  },
  economicActivity: {
    type: String,
    required: true,
  },
  unitAmount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    default: COMMON_CURRENCY_TYPES.BOB.code,
  },
  currentQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  maxQuantity: {
    type: Number,
    required: true,
    default: 1
  },
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

// Pre-save hook to update the `updatedOn` field for existing documents
GeneratedProductSchema.pre("save", function (next) {
  if (!this.isNew) {
    this.updatedOn = new Date();
  }
  next();
});

// Static method to create or update products by orderGeneratorId
GeneratedProductSchema.statics.createAllByOrderGeneratorId = async function (currentMongoose, toGenerateProducts, orderGeneratorId) {
  try {
    if (!Array.isArray(toGenerateProducts) || toGenerateProducts.length === 0) {
      throw new Error("La lista de productos debe ser un array no vacío");
    }

    // Clean data
    const cleanedProducts = toGenerateProducts.map(({ _id, createdOn, ...rest }) => rest);

    const bulkOps = cleanedProducts.map(product => ({
      updateOne: {
        filter: {
          orderGeneratorId: orderGeneratorId,
          code: product.code,
        },
        update: {
          $set: {
            ...product,
            orderGeneratorId,
            updatedOn: new Date(),
          },
          $setOnInsert: {
            createdOn: new Date(),
          },
        },
        upsert: true, // This ensures that if the document doesn’t exist, it will be created
      },
    }));

    const result = await GeneratedProduct(currentMongoose).bulkWrite(bulkOps);

    if ((result.upsertedCount + result.modifiedCount) !== toGenerateProducts.length) {
      throw new Error("No se pudieron crear o actualizar todos los productos");
    }

    return result;
  } catch (err) {
    console.error("Error en createAllByOrderGeneratorId:", err);
    throw err;
  }
};


// Factory function to create a model using the schema and provided mongoose connection
const GeneratedProduct = function (mongooseCon) {
  return mongooseCon.model("GeneratedProduct", GeneratedProductSchema);
}

// Export the model factory
module.exports = GeneratedProduct;
