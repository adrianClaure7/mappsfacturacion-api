module.exports = function(app) {
  let significantEventsRouter = require("./significantEvent.router");

  app.use("/significantEvents", significantEventsRouter);
};
