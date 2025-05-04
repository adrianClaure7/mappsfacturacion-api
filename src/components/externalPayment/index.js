module.exports = function(app) {
  let externalPaymentsRouter = require("./externalPayment.router");

  app.use("/externalPayment", externalPaymentsRouter);
};
