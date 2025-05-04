module.exports = function(app) {
  let customersRouter = require("./customer.router");

  app.use("/customers", customersRouter);
};
