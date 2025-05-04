module.exports = function(app) {
  let recoverPasswordsRouter = require("./recoverPassword.router");

  app.use("/recoverPasswords", recoverPasswordsRouter);
};
