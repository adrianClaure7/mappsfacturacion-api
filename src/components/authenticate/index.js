module.exports = function(app) {
  let authRouter = require("./authenticate.router");

  app.use("/auth", authRouter);
};
