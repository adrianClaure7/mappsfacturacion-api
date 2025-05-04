module.exports = function(app) {
  let recurrenceInfosRouter = require("./recurrenceInfo.router");

  app.use("/recurrenceInfos", recurrenceInfosRouter);
};
