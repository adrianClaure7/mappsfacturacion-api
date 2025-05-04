module.exports = function(app) {
  let merchantsRouter = require("./merchant.router");

  app.use("/merchants", merchantsRouter);
};
