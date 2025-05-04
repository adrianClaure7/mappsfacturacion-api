module.exports = function (app) {
  let facturarRouter = require("./servicio.router");

  app.use("/api/servicio", facturarRouter);
};