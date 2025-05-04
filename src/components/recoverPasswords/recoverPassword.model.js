// grab the things we need
var mongoose = require("mongoose");
var config = require("../../../config/config");

var Schema = mongoose.Schema;
var AuthUser = require("../authUsers/authUser.model");
var User = require("../users/user.model");
var mongoseeConnections = require("../../middlewares/mongoseConnections");
// create a schema
var RecoverPasswordSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: Number,
    required: true,
    default: 0
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

RecoverPasswordSchema.pre("save", function (next) {
  var recoverPassword = this;

  if (!recoverPassword.isNew) recoverPassword.updatedOn = new Date();

  next();
});
// the schema is useless so far
// we need to create a model using it


RecoverPasswordSchema.methods.createRecoverPassword = async function (mongooseCon) {
  try {
    const recoverPassword = await this.save();
    return recoverPassword;
  } catch (err) {
    throw err;
  }
};

RecoverPasswordSchema.statics.changePassword = async function (userInfo, mongooseCon) {
  try {
    if (!userInfo.username || userInfo.password !== userInfo.confirmedPassword || !userInfo.recoverPasswordId) {
      throw new Error("Invalid input parameters");
    }

    const countRecoverPassword = await this.countDocuments({ _id: userInfo.recoverPasswordId });
    if (countRecoverPassword === 0) {
      throw new Error("RecoverPassword entry does not exist");
    }

    const userFound = await AuthUser(mongooseCon).findOneAndUpdate(
      { username: userInfo.username },
      { password: userInfo.password },
      { new: true }
    );

    if (!userFound) {
      throw new Error("User not found in AuthUser");
    }

    await this.deleteOne({ _id: userInfo.recoverPasswordId });

    const url = `${config.MONGODB_URL}${userFound.database}?authSource=admin`;
    const clientMongoose = await mongoseeConnections(url, userFound.database).getConnection();

    const userChanged = await User(clientMongoose).findOneAndUpdate(
      { username: userInfo.username },
      { password: userInfo.password },
      { new: true }
    );

    return userChanged;
  } catch (error) {
    throw error;
  }
};

var RecoverPassword = function (mongooseCon) {
  return mongooseCon.model("RecoverPassword", RecoverPasswordSchema);
};
// make this available to our users in our Node applications
module.exports = RecoverPassword;
