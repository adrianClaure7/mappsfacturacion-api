// grab the things we need
var mongoose = require("mongoose");
const { NumberContext } = require("twilio/lib/rest/pricing/v1/voice/number");

var Schema = mongoose.Schema;

// create a schema
var WppMessageSchema = new Schema({
  sid: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

WppMessageSchema.pre("save", function (next) {
  var wppMessage = this;

  if (!wppMessage.isNew) wppMessage.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var WppMessage = function (mongooseCon) {
  return mongooseCon.model("WppMessage", WppMessageSchema);
};
// make this available to our users in our Node applications
module.exports = WppMessage;
