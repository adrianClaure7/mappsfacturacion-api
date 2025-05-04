// grab the things we need
var mongoose = require("mongoose");
var LISENCE_TYPES = require("./../../commons/lisenceTypes");

var Schema = mongoose.Schema;
// create a schema
var MerchantConfigSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  merchantCode: {
    type: String,
    required: true,
    unique: true
  },
  merchantDatabase: {
    type: String,
    required: true,
    unique: true
  },
  expirationDate: {
    type: Date
  },
  cyberSourceMerchantId: String,
  businessName: { type: String },
  totalPrice: { type: Number },
  licenseType: { type: String, default: LISENCE_TYPES.DEMO },
  allowWppNotifications: { type: Boolean, required: true, default: false },
  facturacion: {
    nitEmisor: Number,
    razonSocialEmisor: String,
    codigoAmbiente: Number,
    codigoModalidad: Number
  },
  imgUrl: {
    type: String
  },
  imgRouteName: String,
  paymentInfo: {
    successUrl: String,
    errorUrl: String,
    callbackUrl: String
  },
  email: String,
  phone: Number,
  iso2: String,
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

MerchantConfigSchema.pre("save", function (next) {
  var merchantConfig = this;

  if (!merchantConfig.isNew) merchantConfig.updatedOn = new Date();

  next();
});

// the schema is useless so far
// we need to create a model using it
var MerchantConfig = function (mongooseCon) {
  return mongooseCon.model("MerchantConfig", MerchantConfigSchema);
};
// make this available to our users in our Node applications
module.exports = MerchantConfig;
