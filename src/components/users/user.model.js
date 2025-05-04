// grab the things we need
var mongoose = require("mongoose");
var Schema = mongoose.Schema,
  bcrypt = require("bcryptjs"),
  SALT_WORK_FACTOR = 10;
var AuthUser = require("./../authUsers/authUser.model");
var config = require("./../../../config/config");
var mongoseeConnections = require("../../middlewares/mongoseConnections");
const WppNotifications = require("../wppNotifications");
var USER_PERMISSIONS = require("./../../commons/userPemissions");
var REMINDER_TYPES = require("./../../commons/reminderTypes");

// create a schema
var UserSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    default: ""
  },
  address: {
    type: String,
    default: ""
  },
  phone: {
    type: Number,
    required: true
  },
  iso2: { type: String },
  imgUrl: {
    type: String
  },
  imgRouteName: String,
  password: {
    type: String,
    required: true
  },
  permissions: [
    {
      code: {
        type: String,
        default: ""
      },
      description: {
        type: String,
        default: ""
      }
    }
  ],
  expirationDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  database: {
    type: String,
    required: true
  },
  notDelete: Boolean,
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  updatedBy: { type: String },
  createdBy: { type: String }
});

UserSchema.pre("save", function (next) {
  var user = this;

  if (!user.isNew) user.updatedOn = new Date();

  // only hash the password if it has been modified (or is new)
  if (!user.isModified("password")) return next();

  // generate a salt
  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err);

    // hash the password using our new salt
    bcrypt.hash(user.password, salt, function (err, hash) {
      if (err) return next(err);

      // override the cleartext password with the hashed one
      user.password = hash;
      next();
    });
  });
});

UserSchema.statics.encriptPasswordAndSave = function (user, users) {
  return new Promise((resolve, reject) => {
    bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
      if (err) return reject(err);

      // hash the password using our new salt
      bcrypt.hash(user.password, salt, function (err, hash) {
        if (err) return next(err);

        // override the cleartext password with the hashed one
        user.password = hash;
        resolve(users.create(user));
      });
    });
  });
};

UserSchema.statics.deleteUser = async function (userId, currentMongoose) {
  try {
    const user = await User(currentMongoose).findById(userId);
    if (!user) {
      throw { error: "Usuario no encontrado" };
    }

    const url = `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`;
    const authMongoose = await mongoseeConnections(url, config.AUTHUSER_DB).getConnection();

    // Delete from AuthUser
    const deletedAuthUser = await AuthUser(authMongoose).findOneAndDelete({
      username: user.username
    });

    // Delete from User
    const deletedUser = await User(currentMongoose).findByIdAndDelete(userId);

    return deletedUser;
  } catch (err) {
    throw err;
  }
};

UserSchema.statics.updateUser = function (
  user,
  username,
  userId,
  currentMongoose
) {
  return new Promise((resolve, reject) => {
    user.updatedBy = username;
    user.updatedOn = new Date();
    if (user.username) {
      User(currentMongoose).findByIdAndUpdate(
        userId,
        user,
        { new: true },
        (err, userFound) => {
          const auxUser = {
            password: user.password
          };
          if (err) reject(err);
          if (user.password) {
            const url = `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`;
            mongoseeConnections(url, config.AUTHUSER_DB)
              .getConnection()
              .then(async authMongoose => {
                const updatedUser = await AuthUser(authMongoose).findOneAndUpdate(
                  { username: user.username },
                  auxUser,
                  { new: true } // Ensures the updated document is returned
                );

                if (!updatedUser) {
                  resolve({ error: "User not found" });
                }

                resolve(updatedUser);
              });
          } else {
            resolve(userFound);
          }
        }
      );
    } else {
      reject(err);
    }
  });
};

UserSchema.pre(`findOneAndUpdate`, function (next) {
  var that = this;
  const password = this.getUpdate().password;
  if (!password) {
    return next();
  }

  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err);

    // hash the password using our new salt
    bcrypt.hash(password, salt, function (err, hash) {
      if (err) return next(err);

      // override the cleartext password with the hashed one

      that.getUpdate().password = hash;
      next();
    });
  });
});

UserSchema.methods.comparePassword = function (candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

UserSchema.methods.register = async function (currentMongoose) {
  try {
    const authMongoose = await mongoseeConnections(
      `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`,
      config.AUTHUSER_DB
    ).getConnection();

    const isValid = await this.validateAuthUser(this.username, authMongoose);
    if (isValid.error) {
      throw new Error("Error: pruebe con un 'username' diferente porfavor.");
    }

    const authUser = await this.createAuthUserFromUser(this, authMongoose);

    try {
      const resp = await this.save();
      if (resp.iso2 && resp.phone) {
        const wppNotification = new WppNotifications(currentMongoose, resp.createdBy);
        wppNotification.sendCreatedUserMessage(mongoseeConnections, config, this);
      }
      return resp;
    } catch (err) {
      await this.deleteAuthUsers(authUser, authMongoose);
      throw err;
    }
  } catch (err) {
    throw err;
  }
};

UserSchema.methods.validateAuthUser = function (username, authMongoose) {
  const that = this;

  return new Promise((resolve, reject) => {
    AuthUser(authMongoose)
      .findOne({ username })
      .then(user => {
        if (user) {
          resolve({
            error: `error: username ${username} already exist`
          });
        } else {
          resolve({ error: false });
        }
      })
      .catch(err => {
        reject(err);
      });
  });
}

UserSchema.methods.createAuthUserFromUser = function (user, authMongoose) {
  const that = this;

  return new Promise((resolve, reject) => {
    AuthUser(authMongoose)
      .create(user)
      .then(
        usersCreated => {
          usersCreated
            ? resolve(usersCreated)
            : reject({ error: "Usuarios no creados" });
        },
        err => {
          reject(err);
        }
      );
  });
}

UserSchema.methods.deleteAuthUsers = function (authUsers, authMongoose) {
  return new Promise((resolve, reject) => {
    AuthUser(authMongoose)
      .findByIdAndDelete(authUsers._id)
      .then(
        usersDeleted => {
          resolve(usersDeleted);
        },
        err => {
          reject(err);
        }
      );
  });
}

UserSchema.statics.prepareUserWithCustomer = function (
  customer
) {
  var user = {
    username: customer.email,
    permissions: [USER_PERMISSIONS.CUSTOMER],
    name: `${customer.firstName} ${customer.lastName}`,
    phone: customer.phone,
    iso2: customer.iso2,
    address: customer.address,
    status: "",
    database: customer.database,
    password: customer.email,
    createdBy: customer.createdBy || "Register"
  }
  return user;
}

UserSchema.statics.getUsersToSendAdminReminderByReminderType = function (reminderType) {
  var that = this;
  // TODO; IMprove validation of user permisions to users reciebe msjs
  return new Promise((resolve, reject) => {
    if (reminderType && reminderType == REMINDER_TYPES.LIMIT_PAYMENT.code) {
      that
        .find({ active: true, 'permissions.code': USER_PERMISSIONS.ADMIN.code })
        .select('phone iso2')
        .then(
          users => {
            resolve(users);
          },
          err => {
            reject(err);
          }
        );
    } else {
      resolve();
    }
  });
}

// the schema is useless so far
// we need to create a model using it
var User = function (mongooseCon) {
  return mongooseCon.model("User", UserSchema);
};
// make this available to our users in our Node applications
module.exports = User;
