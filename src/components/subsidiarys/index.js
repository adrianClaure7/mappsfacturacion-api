module.exports = function(app) {
  let subsidiarysRouter = require("./subsidiary.router");

  app.use("/subsidiarys", subsidiarysRouter);
};
