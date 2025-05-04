// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var MailerConfigSchema = new Schema({
  refreshToken: {
    type: String,
    required: true
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

MailerConfigSchema.pre("save", function (next) {
  var mailerConfig = this;

  if (!mailerConfig.isNew) mailerConfig.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var MailerConfig = function (mongooseCon) {
  return mongooseCon.model("MailerConfig", MailerConfigSchema);
};
// make this available to our users in our Node applications
module.exports = MailerConfig;
