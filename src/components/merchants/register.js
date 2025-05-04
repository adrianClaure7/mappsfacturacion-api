const config = require("./../../../config/config");
var mongoseeConnections = require("./../../middlewares/mongoseConnections");
const AuthUser = require("./../authUsers/authUser.model");
var USER_PERMISSIONS = require("./../../commons/userPemissions");
var MerchantConfig = require("./../merchantConfigs/merchantConfig.model");
var Counter = require("./../counters/counters.model");
var $q = require("q");
var User = require("./../users/user.model");

class Register {
  constructor() { }

  changeMerchantCode(merchant) {
    const that = this;

    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${merchant.database}?authSource=admin`,
        merchant.database
      )
        .getConnection()
        .then(merchantMongoose => {
          MerchantConfig(merchantMongoose).updateMany(
            {},
            {
              $set: {
                merchantCode: merchant.merchantCode
              }
            },
            (error, result2) => {
              if (error) {
                reject(error);
              }
              else {
                resolve(merchant);
              }
            }
          );
        });
    });
  }

  validateAuthUsersAndMerchant(merchant, superAdminMongoose, Merchant) {
    const that = this;

    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`,
        config.AUTHUSER_DB
      )
        .getConnection()
        .then(authMongoose => {
          Merchant(superAdminMongoose).findOne(
            { $or: [{ email: merchant.email }, { code: merchant.code }] },
            function (err, docs) {
              if (err) {
                reject(err);
              } else {
                if (docs) {
                  reject({
                    error:
                      "El email o empresa, negocio, usuario ya exiten, pruebe con uno diferente"
                  });
                } else {
                  that
                    .validateAuthUser(merchant.usernameMerchant, authMongoose)
                    .then(isValid => {
                      if (!isValid.error) {
                        resolve(true);
                      } else {
                        reject({
                          error:
                            "El email o empresa, negocio, usuario ya exiten, pruebe con uno diferente"
                        });
                      }
                    })
                    .catch(err => reject(err));
                }
              }
            }
          );
        });
    });
  }

  updateExpirationDate(merchant) {
    const that = this;

    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${merchant.database}?authSource=admin`,
        merchant.database
      )
        .getConnection()
        .then(merchantMongoose => {
          User(merchantMongoose).updateMany(
            {},
            { $set: { expirationDate: merchant.expirationDate } },
            (error, result) => {
              MerchantConfig(merchantMongoose).updateMany(
                {},
                {
                  $set: {
                    expirationDate: merchant.expirationDate
                  }
                },
                (error, result2) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              );
            }
          );
        });
    });
  }

  async registerMerchant(merchantParameters, superAdminMongoose, Merchant) {
    try {
      const authMongoose = await mongoseeConnections(
        `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`,
        config.AUTHUSER_DB
      ).getConnection();

      const merchant = await merchantParameters.save();

      const merchantMongoose = await mongoseeConnections(
        `${config.MONGODB_URL}${merchant.database}?authSource=admin`,
        merchant.database
      ).getConnection();

      const authUsers = await this.createAuthUser(merchant, authMongoose);
      const merchantConfig = await this.createMerchantConfig(merchant, merchantMongoose);
      const users = await this.createUser(merchant, merchantMongoose);
      await this.createCountersToMerchant(merchantMongoose);

      return { merchant };
    } catch (error) {
      console.error("Error registering merchant:", error);

      try {
        await Merchant(superAdminMongoose).findByIdAndDelete(merchant?.id);
      } catch (err) {
        console.error("Error removing merchant:", err);
      }

      try {
        if (authUsers) await this.deleteAuthUsers(authUsers, authMongoose);
      } catch (err) {
        console.error("Error deleting auth users:", err);
      }

      try {
        if (merchantConfig) {
          await MerchantConfig(merchantMongoose).findByIdAndDelete(merchantConfig._id);
        }
      } catch (err) {
        console.error("Error removing merchant config:", err);
      }

      try {
        if (users) await this.deleteUsers(users, merchantMongoose);
      } catch (err) {
        console.error("Error deleting users:", err);
      }

      throw error;
    }
  }

  deleteAuthUsers(authUsers, authMongoose) {
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


  deleteUsers(users, merchantMongoose) {
    return new Promise((resolve, reject) => {
      User(merchantMongoose)
        .findByIdAndDelete(users._id)
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

  validateAuthUser(username, authMongoose) {
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

  createUser(merchant, merchantMongoose) {
    var that = this;

    return new Promise((resolve, reject) => {
      var auxUser = that.prepareUserByMerchant(merchant);

      User(merchantMongoose)
        .create(auxUser)
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


  createCountersToMerchant(merchantMongoose) {
    const that = this;

    return new Promise((resolve, reject) => {
      var merchantCountersSavePromises = [];
      var counterCodes = [
        'customers',
      ]

      counterCodes.forEach(code => {
        const prepareCounter = {
          code,
          counter: 0
        }
        merchantCountersSavePromises.push(Counter(merchantMongoose).create(prepareCounter));
      });

      $q.all(merchantCountersSavePromises).then(
        countersCreated => {
          countersCreated
            ? resolve(countersCreated)
            : reject({ error: "Counters no creados" });
        },
        err => {
          reject(err);
        }
      );
    });
  }

  prepareUserByMerchant(merchant) {
    var newUser = {
      username: merchant.usernameMerchant,
      permissions: [USER_PERMISSIONS.ADMIN],
      name: merchant.name,
      phone: merchant.phone,
      address: merchant.address,
      status: "",
      database: merchant.database,
      createdBy: merchant.createdBy || "Register",
      password: merchant.usernameMerchant,
      expirationDate: merchant.expirationDate
    };

    return newUser;
  }

  createAuthUser(merchant, authMongoose) {
    const that = this;

    return new Promise((resolve, reject) => {
      var auxUser = that.prepareAuthUserByMerchant(merchant);
      AuthUser(authMongoose)
        .create(auxUser)
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

  async createMerchantConfig(merchant, merchantMongoose) {
    try {
      const merchantConfig = new MerchantConfig(merchantMongoose)({
        code: merchant.code,
        merchantCode: merchant.merchantCode,
        merchantDatabase: merchant.database,
        expirationDate: merchant.expirationDate,
        businessName: merchant.businessName,
        licenseType: merchant.licenseType,
        cyberSourceMerchantId: merchant.cyberSourceMerchantId,
        allowWppNotifications: merchant.allowWppNotifications,
        email: merchant.email,
        phone: merchant.phone,
        iso2: merchant.iso2
      });

      return await merchantConfig.save();
    } catch (error) {
      throw new Error(`Error creating merchant config: ${error.message}`);
    }
  }

  prepareAuthUserByMerchant(merchant) {
    var newUser = {
      username: merchant.usernameMerchant,
      permissions: [USER_PERMISSIONS.ADMIN],
      phone: merchant.phone,
      database: merchant.database,
      createdBy: merchant.createdBy || "Register",
      password: merchant.usernameMerchant,
      expirationDate: merchant.expirationDate
    };

    return newUser;
  }

  getPermissionByCode(code) {
    var currentPermission = "";

    switch (code) {
      case USER_PERMISSIONS.ADMIN.code:
        currentPermission = USER_PERMISSIONS.ADMIN;
        break;
    }
    return currentPermission;
  }

  updateAllowWppNotifications(merchant) {
    const that = this;

    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${merchant.database}?authSource=admin`,
        merchant.database
      )
        .getConnection()
        .then(merchantMongoose => {
          MerchantConfig(merchantMongoose).updateMany(
            {},
            {
              $set: {
                allowWppNotifications: merchant.allowWppNotifications
              }
            },
            (error, result2) => {
              if (error) reject(error);
              else resolve(result2);
            }
          );
        });
    });
  }

}

module.exports = Register;
