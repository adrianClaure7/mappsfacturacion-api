module.exports = function(app) {
  let invoiceActionsRouter = require("./invoiceActions");

  app.use("/invoiceActions", invoiceActionsRouter);
};
