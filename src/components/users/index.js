module.exports = function(app) {
  let userRouter = require("./user.router");

  app.use("/users", userRouter);
};
