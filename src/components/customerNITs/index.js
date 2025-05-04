module.exports = function(app) {
  let customerNITsRouter = require("./customerNIT.router");

  app.use("/customerNITs", customerNITsRouter);
};
