const { resolve } = require("q");
var config = require("./../../config/config");
var mongoseeConnections = require("./mongoseConnections");
const Merchant = require("../components/merchants/merchant.model");

class MongooseConnectionHandler {
  constructor() { }

  getSuperAdminConnection() {
    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${config.SUPER_ADMIN_DB}?authSource=admin`,
        config.SUPER_ADMIN_DB
      )
        .getConnection()
        .then(superAdminMongoose => {
          resolve(superAdminMongoose);
        }).catch(err => {
          reject(err);
        })
    })
  }

  getConnectionByDb(db) {
    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${db}?authSource=admin`,
        db
      )
        .getConnection()
        .then(currentMongoose => {
          resolve(currentMongoose);
        }).catch(err => {
          reject(err);
        })
    })
  }

  getConnectionByMerchantCode(merchantCode) {
    return new Promise((resolve, reject) => {
      mongoseeConnections(
        `${config.MONGODB_URL}${config.SUPER_ADMIN_DB}?authSource=admin`,
        config.SUPER_ADMIN_DB
      )
        .getConnection()
        .then(superAdminMongoose => {
          Merchant(superAdminMongoose).findOne({ merchantCode }).then((merchant) => {
            if (merchant) {
              mongoseeConnections(
                `${config.MONGODB_URL}${merchant.database}?authSource=admin`,
                merchant.database
              )
                .getConnection()
                .then(merchantMongoose => {
                  resolve(merchantMongoose);
                }).catch(err => {
                  reject(err);
                })
            }
          }).catch(err => {
            reject(err);
          })
        }).catch(err => {
          reject(err);
        })
    })
  }
}

module.exports = MongooseConnectionHandler;
