const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define the schema
const AanewSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
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
AanewSchema.pre("save", async function (next) {
  if (!this.isNew) {
    this.updatedOn = new Date();
  }
  next();
});

// Factory function to create a model using the schema and provided mongoose connection
const Aanew = function (mongooseCon) {
  return mongooseCon.model("Aanew", AanewSchema);
}

// Export the model factory
module.exports = Aanew;
