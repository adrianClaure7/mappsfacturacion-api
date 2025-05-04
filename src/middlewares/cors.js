const cors = require("cors");
const config = require("./../../config/config");
const logger = require("./../commons/logger");
let corsOptions = require("./../commons/cors-option");

module.exports = function(app) {
  if (config.CORS_VERIFY) {
    app.use(cors(corsOptions));
    logger.info(
      "[CORS] Verification active for the next origins: ",
      config.CORS_ORIGINS
    );
  } else {
    app.use(cors());
    logger.warn('[CORS] Verification origins is set as default "*"');
  }
};
