const logger = require("./../commons/logger");

module.exports = function(app) {
  require("./security")(app);
  require("./jsonParser")(app);
  require("./requestLog")(app);
  require("./cors")(app);
  require("./authenticate")(app);
  logger.info("Middlewares loaded");
};
