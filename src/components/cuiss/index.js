module.exports = function(app) {
  let cuissRouter = require("./cuis.router");

  app.use("/cuiss", cuissRouter);
};
