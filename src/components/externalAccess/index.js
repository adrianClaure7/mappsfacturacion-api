module.exports = function(app) {
  let externalAccessRouter = require("./externalAcces.router");

  app.use("/externalAccess", externalAccessRouter);
};
