const helmet = require("helmet");
const Merchant = require("../components/merchants/merchant.model");
var mongooseConnections = require('./MongoseConnection')();
const config = require("./../../config/config");
var Mongoose = require("mongoose").Mongoose;
var $q = require("q");

const createMongooseConnection = (url, mongooseConnections) => {
  return new Promise((resolve, reject) => {
    var mongooseCloned = new Mongoose();

    mongooseCloned
      .connect(url)
      .then(
        connection => {
          let mongooseCloned2 = mongooseConnections.get().find(
            x => x.connection.name === connection.connection.name
          );
          if (!mongooseCloned2) {
            var scheduler = require("./../workers/schedulerFactory");
            mongooseConnections.push(mongooseCloned);
            // PRODUCTION
            scheduler.startCUFD(mongooseCloned);
            scheduler.validateOrderGenerators(mongooseCloned);
          }
          resolve(connection)
        }).catch(err => {
          reject(err)
        })
  })
}
module.exports = function (app) {
  app.use(helmet());
  if (mongooseConnections.isFirstTime) {
    mongooseConnections.changeFirstTime();
    const url = `${config.MONGODB_URL}${config.SUPER_ADMIN_DB}?authSource=admin`;
    mongooseCloned = new Mongoose();
    mongooseCloned
      .connect(url)
      .then(
        connection => {
          mongooseConnections.push(mongooseCloned);
          Merchant(mongooseCloned).find().then(merchants => {
            const promises = [];
            merchants.forEach(merchant => {
              const url = `${config.MONGODB_URL}${merchant.database}?authSource=admin`;
              promises.push(createMongooseConnection(url, mongooseConnections))
            })

            $q.all(promises).then(() => {
              resolve(promises);
            })
          })
        }
      );
    mongooseCloned.set("strictQuery", false);
  }
};
