module.exports = function(app) {
  let emitedInvoicesRouter = require("./emitedInvoice.router");

  app.use("/emitedInvoices", emitedInvoicesRouter);
};
