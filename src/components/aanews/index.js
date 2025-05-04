module.exports = function(app) {
  let aanewsRouter = require("./aanew.router");

  app.use("/aanews", aanewsRouter);
};
