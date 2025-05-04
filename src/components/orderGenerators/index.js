module.exports = function(app) {
  let orderGeneratorsRouter = require("./orderGenerator.router");

  app.use("/orderGenerators", orderGeneratorsRouter);
};
