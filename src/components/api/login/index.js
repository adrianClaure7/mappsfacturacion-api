module.exports = function (app) {
  let loginRouter = require("./login.router");

  app.use("/api/login", loginRouter);
};