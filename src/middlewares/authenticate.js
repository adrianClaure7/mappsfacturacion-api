const { expressjwt } = require("express-jwt");
const config = require("./../../config/config");
const logger = require("./../commons/logger");
const mongoseeConnections = require("./mongoseConnections");

module.exports = function (app) {
  app.use(
    expressjwt({ secret: config.JWT_KEY, algorithms: ["HS256"] }).unless({
      path: [
        /^\/auth/,
        /^\/recoverPasswords/,
        /^\/recoverPasswords\/.*/,
        /^\/cybersourceAPI/,
        /^\/cybersourceAPI\/.*/,
        /^\/cyberPayments\/authWithCaptureSale/,
        /^\/cyberPayments\/authWithCaptureSaleOneNoToken/,
        /^\/cyberPayments\/authWithCaptureSaleAndCustomerInfo/,
        /^\/cyberPayments\/getInstrumentIdentifierPaymentById/,
        /^\/orders\/create/,
        /^\/merchants\/generateToken/,
        /^\/cyberCustomerTokens\/getCustomerPaymentMethods/,
        /^\/cyberCustomerTokens\/delete/,
        /^\/deviceFingerPrints\/getClientDeviceFingerPrintInfo/,
        /^\/api\/login/,
      ]
    })
  );

  app.use((req, res, next) => {
    const url = `${config.MONGODB_URL}${req.auth.database}?authSource=admin`;
    if (
      !req.auth.externalAccess || req.auth.externalAccess && req.auth.database ||
      req.originalUrl == '/externalPayment/getMerchantInfoByExternalToken' ||
      req.originalUrl == '/orders/generateJwt' ||
      req.originalUrl == '/deviceFingerPrints/getDeviceFingerPrintInfo' ||
      req.originalUrl == '/cyberPayments/callAuthWithCaptureSale'
    ) {
      mongoseeConnections(url, req.auth.database)
        .getConnection()
        .then(mongooseClone => {
          req.currentMongoose = mongooseClone;
          next();
        })
        .catch(err => {
          res.status(403).send(err);
        });
    } else {
      res.status(403).send({ error: 'Unauthorized Token' });
    }
  });

  // this middlewares is only executed when a error occurred
  app.use((err, req, res, next) => {
    if (err.status === 401) {
      let errorMessage = "Invalid token";
      console.error("[middleware][authenticate]", errorMessage);
      res.status(401).send(errorMessage);
    } else {
      console.error(err.message);

      console.error("[authenticate] error is not 401, ignoring");
      next();
    }
  });
};
