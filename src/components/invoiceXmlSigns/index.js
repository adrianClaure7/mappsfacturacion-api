module.exports = function(app) {
  let invoiceXmlSignsRouter = require("./invoiceXmlSign.router");

  app.use("/invoiceXmlSigns", invoiceXmlSignsRouter);
};
