const logger = require("./../commons/logger");

module.exports = function (app) {
  require("./authenticate")(app);
  require("./users")(app);
  require("./aanews")(app);
  require("./counters")(app);
  require("./merchants")(app);
  require("./merchantConfigs")(app);
  require("./orders")(app);
  require("./customers")(app);
  require("./recoverPasswords")(app);
  require("./reminders")(app);
  require("./subsidiarys")(app);
  require("./invoiceActions")(app);
  require("./products")(app);
  require("./externalPayment")(app);
  require("./externalAccess")(app);
  require("./invoiceTokens")(app);
  require("./emitedInvoices")(app);
  require("./significantEvents")(app);
  require("./cufds")(app);
  require("./cuiss")(app);
  require("./paqueteFacturas")(app);
  require("./mailerConfigs")(app);
  require("./orderGenerators")(app);
  require("./generatedProducts")(app);
  require("./toGenerateInvoices")(app);
  require("./invoiceXmlSigns")(app);
  
  // External APIs
  require("./api/servicio")(app);
  require("./api/login")(app);

  logger.info("Components loaded");
};
