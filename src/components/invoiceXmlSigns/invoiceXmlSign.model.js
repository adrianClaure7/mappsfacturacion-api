// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var InvoiceXmlSignSchema = new Schema({
  certificate: {
    type: String,
    required: true
  },
  privateKey: {
    type: String,
    required: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

InvoiceXmlSignSchema.pre("save", function (next) {
  var invoiceXmlSign = this;

  if (!invoiceXmlSign.isNew) invoiceXmlSign.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var InvoiceXmlSign = function (mongooseCon) {
  return mongooseCon.model("InvoiceXmlSign", InvoiceXmlSignSchema);
};
// make this available to our users in our Node applications
module.exports = InvoiceXmlSign;
