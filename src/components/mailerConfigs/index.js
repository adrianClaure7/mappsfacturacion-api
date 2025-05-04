module.exports = function(app) {
  let mailerConfigsRouter = require("./mailerConfig.router");

  app.use("/mailerConfigs", mailerConfigsRouter);
};
