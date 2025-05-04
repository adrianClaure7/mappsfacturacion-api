// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var InvoiceTokenSchema = new Schema({
  systemCode: {
    type: String,
    required: true
  },
  token:  {
    type: String,
    required: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

InvoiceTokenSchema.pre("save", function (next) {
  var invoiceToken = this;

  if (!invoiceToken.isNew) invoiceToken.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var InvoiceToken = function (mongooseCon) {
  return mongooseCon.model("InvoiceToken", InvoiceTokenSchema);
};
// make this available to our users in our Node applications
module.exports = InvoiceToken;
