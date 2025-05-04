module.exports = function(app) {
  let paqueteFacturasRouter = require("./paqueteFactura.router");

  app.use("/paqueteFacturas", paqueteFacturasRouter);
};
