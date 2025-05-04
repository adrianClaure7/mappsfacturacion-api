// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;
var COMMON_CURRENCY_TYPES = require('../../commons/commonCurrencyTypes');
var $q = require("q");

// create a schema
var ProductSchema = new Schema({
  code: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  SINCode: {
    type: String
  },
  economicActivity: {
    type: String
  },
  unitAmount: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    required: true,
    default: COMMON_CURRENCY_TYPES.BOB.code
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

ProductSchema.pre("save", function (next) {
  var product = this;

  if (!product.isNew) product.updatedOn = new Date();

  next();
});


ProductSchema.statics.completeProductsByCodigoProducto = function (detalle) {
  var that = this;

  return new Promise((resolve, reject) => {
    let productPromises = [];
    detalle.forEach(element => {
      productPromises.push(that.findOne({ code: element.codigoProducto }).select('code SINCode economicActivity'))
    });

    $q.all(productPromises)
      .then(products => {
        resolve(products);
      })
      .catch(err => {
        reject(err);
      });
  })
}
// the schema is useless so far
// we need to create a model using it
var Product = function (mongooseCon) {
  return mongooseCon.model("Product", ProductSchema);
};
// make this available to our users in our Node applications
module.exports = Product;
