module.exports = function(app) {
  let cufdsRouter = require("./cufd.router");

  app.use("/cufds", cufdsRouter);
};
