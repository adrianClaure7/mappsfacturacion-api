// grab the things we need
var mongoose = require("mongoose");
var Schema = mongoose.Schema,
  bcrypt = require("bcryptjs"),
  SALT_WORK_FACTOR = 10;
var $q = require("q");
const config = require("./../../../config/config");
var mongoseeConnections = require("./../../middlewares/mongoseConnections");

// create a schema
var AuthUserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
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
  phone: {
    type: Number,
    required: true
  },
  expirationDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  database: {
    type: String,
    required: true
  },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  updatedBy: { type: String },
  createdBy: { type: String }
});

AuthUserSchema.pre("save", function (next) {
  var authUser = this;

  if (!authUser.isNew) authUser.updatedOn = new Date();

  // only hash the password if it has been modified (or is new)
  if (!authUser.isModified("password")) return next();

  // generate a salt
  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err);

    // hash the password using our new salt
    bcrypt.hash(authUser.password, salt, function (err, hash) {
      if (err) return next(err);

      // override the cleartext password with the hashed one
      authUser.password = hash;
      next();
    });
  });
});

AuthUserSchema.pre(`findOneAndUpdate`, function (next) {
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

AuthUserSchema.methods.comparePassword = function (candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

AuthUserSchema.statics.checkIfUsersAreAvailables = function (users) {
  return new Promise((resolve, reject) => {
    mongoseeConnections(
      `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`,
      config.AUTHUSER_DB
    )
      .getConnection()
      .then(mongooseConnection => {
        var usersFound = [];
        users.forEach(user => {
          usersFound.push(
            AuthUser(mongooseConnection)
              .findOne({ username: user.username })
              .then(user => {
                if (user) {
                  resolve({
                    error: `error: username ${user.username} already exist`
                  });
                } else {
                  resolve({ error: false });
                }
              })
              .catch(err => {
                reject(err);
              })
          );
        });
        $q.all(usersFound)
          .then(userFounded => {
            var response = false;

            userFounded.forEach(user => {
              if (!!user && user.error) {
                response = user;
              }
            });
            resolve(response);
          })
          .catch(err => {
            reject(err);
          });
      });
  });
};

// the schema is useless so far
// we need to create a model using it
var AuthUser = function (mongooseCon) {
  return mongooseCon.model("AuthUser", AuthUserSchema);
};
// make this available to our authUsers in our Node applications
module.exports = AuthUser;
