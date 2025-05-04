// grab the things we need
var mongoose = require("mongoose");
const CustomerNIT = require("../customerNITs/customerNIT.model");

var Schema = mongoose.Schema;

// create a schema
var CustomerSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  iso2: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  description: {
    type: String,
  },
  company: {
    type: String,
  },
  nit: {
    type: String
  },
  nitName: {
    type: String
  },
  discount: Number,
  hasUser: {
    type: Boolean,
    default: false
  },
  currency: {
    type: String
  },
  active: {
    type: Boolean,
    required: true,
    default: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

CustomerSchema.pre("save", function (next) {
  var customer = this;

  if (!customer.isNew) customer.updatedOn = new Date();

  next();
});

CustomerSchema.statics.getCustomerNitNameByNit = function (merchantMongoose, nit) {
  return new Promise((resolve, reject) => {
    CustomerNIT(merchantMongoose)
      .findOne({ numeroDocumento: nit })
      .then(customer => {
        if (customer) {
          resolve(customer);
        } else {
          resolve({});
        }
      })
      .catch(err => {
        reject(err);
      })
  });
}

// the schema is useless so far
// we need to create a model using it
var Customer = function (mongooseCon) {
  return mongooseCon.model("Customer", CustomerSchema);
};
// make this available to our users in our Node applications
module.exports = Customer;
