// grab the things we need
var mongoose = require("mongoose");
var Register = require("./register");
var register = new Register();
var LISENCE_TYPES = require("./../../commons/lisenceTypes");

var Schema = mongoose.Schema;

// create a schema
var MerchantSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  merchantCode: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    required: true,
    default: true
  },
  address: {
    type: String
  },
  database: {
    type: String,
    required: true,
    unique: true
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  email: {
    type: String,
    default: "NO"
  },
  usernameMerchant: {
    type: String,
    required: true,
    unique: true
  },
  businessName: {
    type: String
  },
  licenseType: { type: String, default: LISENCE_TYPES.DEMO },
  expirationDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  cyberSourceMerchantId: String,
  platformUrl: { type: String },
  allowWppNotifications: { type: Boolean, required: true, default: false },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

MerchantSchema.pre("save", function (next) {
  var merchant = this;

  if (!merchant.isNew) merchant.updatedOn = new Date();

  next();
});

MerchantSchema.methods.registerMerchant = function (currentMongoose) {
  var that = this;

  return new Promise((resolve, reject) => {
    register
      .validateAuthUsersAndMerchant(that, currentMongoose, Merchant)
      .then(isValid => {
        if (isValid.error) {
          reject(isValid.error);
        } else {
          register
            .registerMerchant(that, currentMongoose, Merchant)
            .then(data => {
              resolve(data.merchant);
            })
            .catch(error => {
              if (error.errmsg && error.code === 11000) {
                reject({
                  error:
                    "Existe un negocio, empresa o usuario con un nombre similar, porfavor elija otro."
                });
              } else {
                reject(error);
              }
            });
        }
      })
      .catch(err => {
        reject(err);
      });
  });
};

MerchantSchema.statics.updateAllowWppNotifications = function (merchant) {
  return new Promise((resolve, reject) => {
    register.updateAllowWppNotifications(merchant).then(merchantConfig => {
      resolve(merchant);
    }).catch(err => {
      reject(err)
    })
  });
};

MerchantSchema.statics.updateLicenceData = function (merchant) {
  return new Promise((resolve, reject) => {
    register.updateLicenceData(merchant).then(merchant => {
      resolve(merchant);
    }).catch(err => {
      reject(err)
    })
  });
};

MerchantSchema.statics.updateExpirationDate = function (merchant) {
  return new Promise((resolve, reject) => {
    register.updateExpirationDate(merchant).then(merchant => {
      resolve(merchant);
    }).catch(err => {
      reject(err)
    })
  });
};

MerchantSchema.statics.changeMerchantCode = function (superAdminMongoose, merchantId, merchantData) {
  return new Promise(async (resolve, reject) => {
    try {
      const updatedMerchant = await Merchant(superAdminMongoose).findByIdAndUpdate(
        merchantId,
        merchantData,
        { new: true }
      );

      if (!updatedMerchant) {
        return reject(new Error("Merchant not found"));
      }

      try {
        const changedMerchant = await register.changeMerchantCode(updatedMerchant);
        resolve(changedMerchant);
      } catch (err) {
        reject(err);
      }
    } catch (error) {
      reject(error);
    }
  });
};

// the schema is useless so far
// we need to create a model using it
var Merchant = function (mongooseCon) {
  return mongooseCon.model("Merchant", MerchantSchema);
};
// make this available to our users in our Node applications
module.exports = Merchant;
