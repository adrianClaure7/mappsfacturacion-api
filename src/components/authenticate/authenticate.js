let token = require("./../../commons/token");
var AuthUser = require("./../authUsers/authUser.model");
var User = require("./../users/user.model");
const config = require("./../../../config/config");
var mongoseeConnections = require("./../../middlewares/mongoseConnections");
const MerchantConfig = require("../merchantConfigs/merchantConfig.model");
const Customer = require("../customers/customer.model");
var USER_PERMISSIONS = require("./../../commons/userPemissions");
const { Client } = require("twilio/lib/twiml/VoiceResponse");

class Authenticate {
  constructor() { }

  login(username, password) {
    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`,
        config.AUTHUSER_DB
      )
        .getConnection()
        .then(authMongoose => {
          AuthUser(authMongoose)
            .findOne({ username: username })
            .select('username permissions password id name database expirationDate')
            .then(user => {
              if (user) {
                var foundUser = new AuthUser(authMongoose)(user);
                foundUser.comparePassword(password, (error, isSame) => {
                  if (error) {
                    console.error("[Authenticathe][password] - ");
                    reject({ error: "Error con la clave" });
                  }
                  if (isSame) {
                    const url = `${config.MONGODB_URL}${user.database}?authSource=admin`;
                    mongoseeConnections(url, user.database)
                      .getConnection()
                      .then(mongooseClone => {
                        MerchantConfig(mongooseClone)
                          .findOne().select('expirationDate allowWppNotifications').then(merchantConfig => {
                            User(mongooseClone)
                              .findOne({ username: username })
                              .select('username permissions id name database expirationDate')
                              .then(userf => {
                                if (merchantConfig && merchantConfig.expirationDate) {
                                  userf.expirationDate = merchantConfig.expirationDate;
                                }
                                var tokenUser = new User(mongooseClone)(userf);
                                if (merchantConfig) {
                                  tokenUser.allowWppNotifications = merchantConfig.allowWppNotifications;
                                }

                                var some = userf.permissions.some(
                                  x => x.code === USER_PERMISSIONS.CUSTOMER.code
                                )
                                if (some) {
                                  Customer(mongooseClone).findOne({ email: username }).then(customer => {
                                    tokenUser.customerCode = customer.code;
                                    var tokenInfo = this.createTokenWithUser(tokenUser);
                                    resolve(tokenInfo);
                                  }).catch(err => {
                                    reject(err);
                                  });
                                } else {
                                  var tokenInfo = this.createTokenWithUser(tokenUser);
                                  resolve(tokenInfo);
                                }
                              })
                              .catch(err => {
                                reject(err);
                              });
                          }).catch(err => {
                            reject(err);
                          });
                      });
                  } else {
                    console.error("[Authenticathe][password] - ");
                    reject({ error: "Clave no aceptada" });
                  }
                });
              } else {
                console.error("[Authenticathe][login] - ");
                reject({ error: "usuario no encotrado" });
              }
            })
            .catch(err => {
              reject(err);
            });
        });
    });
  }

  createTokenWithUser(user) {
    let currentUser = {
      id: user.id,
      username: user.username,
      permissions: user.permissions,
      name: user.name,
      database: user.database,
      expirationDate: user.expirationDate,
      allowWppNotifications: user.allowWppNotifications,
      customerCode: user.customerCode
    };
    let tokenInfo = { token: token.generateToken(currentUser) };
    console.log("tokenInfo: ", tokenInfo);
    return tokenInfo;
  }

  loginUserId(userId, merchantMongoose) {
    return new Promise((resolve, reject) => {
      MerchantConfig(merchantMongoose)
        .findOne().select('expirationDate allowWppNotifications').then(merchantConfig => {
          User(merchantMongoose)
            .findById(userId)
            .select('username permissions id name database expirationDate')
            .then(userf => {
              if (merchantConfig && merchantConfig.expirationDate) {
                userf.expirationDate = merchantConfig.expirationDate;
              }
              var tokenUser = new User(merchantMongoose)(userf);
              if (merchantConfig) {
                tokenUser.allowWppNotifications = merchantConfig.allowWppNotifications;
              }
              var tokenInfo = this.createTokenWithUser(tokenUser);
              resolve(tokenInfo);
            })
            .catch(err => {
              reject(err);
            });
        }).catch(err => {
          reject(err);
        });
    });
  }
}

module.exports = Authenticate;
