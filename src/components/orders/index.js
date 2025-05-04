module.exports = function(app) {
  let ordersRouter = require("./order.router");

  app.use("/orders", ordersRouter);
};
