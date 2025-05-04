module.exports = function(app) {
  let authUserRouter = require("./aanew.router");

  app.use("/authUser", authUserRouter);
};
