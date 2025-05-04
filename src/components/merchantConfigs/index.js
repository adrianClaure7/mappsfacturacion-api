module.exports = function(app) {
  let merchantConfigsRouter = require("./merchantConfig.router");

  app.use("/merchantConfigs", merchantConfigsRouter);
};
