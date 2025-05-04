module.exports = function(app) {
  let productsRouter = require("./product.router");

  app.use("/products", productsRouter);
};
