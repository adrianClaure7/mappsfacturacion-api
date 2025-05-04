const logger = require("./../commons/logger");

module.exports = function(app) {
  app.use((req, res, next) => {
    logger.trace(`[${req.method}] ${req.url}`);
    next();
  });
};
