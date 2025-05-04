const logger = require("./../commons/logger");
const config = require("./../../config/config");
const whitelist = [...config.CORS_ORIGINS];

let corsOptions = {
  origin: function(origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      const failedMessage = `The origin: ${origin} is not allowed by CORS`;
      logger.warn("[CORS]", failedMessage);
      callback(new Error(failedMessage));
    }
  }
};

module.exports = corsOptions;
