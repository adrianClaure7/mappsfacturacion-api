module.exports = function(app) {
  let toGenerateInvoicesRouter = require("./toGenerateInvoice.router");

  app.use("/toGenerateInvoices", toGenerateInvoicesRouter);
};
