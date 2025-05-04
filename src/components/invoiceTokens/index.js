module.exports = function(app) {
  let invoiceTokensRouter = require("./invoiceToken.router");

  app.use("/invoiceTokens", invoiceTokensRouter);
};
