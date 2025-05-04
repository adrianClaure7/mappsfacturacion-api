module.exports = function(app) {
  let onlineInvoicesRouter = require("./onlineInvoice.router");

  app.use("/onlineInvoices", onlineInvoicesRouter);
};
 