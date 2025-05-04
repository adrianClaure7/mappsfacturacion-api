// grab the things we need
var mongoose = require("mongoose");
var Schema = mongoose.Schema;

// create a schema
var UserConectedSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  extraData: [],
  user: {
    type: Map,
    of: String,
    required: true
  },
  conected: {
    type: Map,
    of: String
  },
  permissions: [],
  createdOn: { type: Date, default: Date.now }
});

UserConectedSchema.methods.create = async function () {
  try {
    const userConected = await this.save();

    if (!userConected) {
      throw new Error("User connected relation not created");
    }

    await UserConected.clearUserConecteds(userConected.user, userConected._id);
    return userConected;

  } catch (error) {
    console.error("Error creating UserConnected:", error);
    throw error;
  }
};

UserConectedSchema.statics.clearUserConecteds = function (user, id) {
  return new Promise((resolve, reject) => {
    UserConected.deleteMany({ user, _id: { $ne: id } }, function (err) {
      if (err) {
        reject(err);
      }
      resolve("cleared userConecteds for user " + user);
    });
  });
};

UserConectedSchema.statics.activateConected = async function (userId, { conected, token }) {
  try {
    const userConected = await this.findOne({ token, "user.id": userId });

    if (!userConected) {
      throw new Error("User connection not found");
    }

    userConected.conected = conected;
    const updatedUserConected = await userConected.save();

    return updatedUserConected;
  } catch (error) {
    console.error("Error activating user connection:", error);
    throw error;
  }
};


UserConectedSchema.statics.deleteUserConected = function (token) {
  var that = this;

  return new Promise((resolve, reject) => {
    that.deleteOne({ token }, function (err) {
      if (err) {
        reject(err);
      }
      resolve("borrado userConected");
    });
  });
};

// the schema is useless so far
// we need to create a model using it
var UserConected = mongoose.model("UserConected", UserConectedSchema);

// make this available to our users in our Node applications
module.exports = UserConected;
