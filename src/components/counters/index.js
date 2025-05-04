module.exports = function (app) {
  let countersRouter = require("./counters.router");

  app.use("/counters", countersRouter);
};
