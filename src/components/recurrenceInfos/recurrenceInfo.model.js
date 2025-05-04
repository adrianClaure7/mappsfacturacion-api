// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;

// create a schema
var RecurrenceInfoSchema = new Schema({
  validUrl: {
    type: String,
    required: true
  },
  rescheduleUrl: {
    type: String,
    required: true
  },
  deletedUrl: {
    type: String,
    required: true
  },
  dayToRecorder: {
    type: Number,
    required: true,
    default: 1
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

RecurrenceInfoSchema.pre("save", function (next) {
  var recurrenceInfo = this;

  if (!recurrenceInfo.isNew) recurrenceInfo.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it
var RecurrenceInfo = function (mongooseCon) {
  return mongooseCon.model("RecurrenceInfo", RecurrenceInfoSchema);
};
// make this available to our users in our Node applications
module.exports = RecurrenceInfo;
