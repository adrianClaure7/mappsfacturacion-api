module.exports = function(app) {
  let generatedProductsRouter = require("./generatedProduct.router");

  app.use("/generatedProducts", generatedProductsRouter);
};
