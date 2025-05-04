module.exports = function(app) {
  let wppMessagesRouter = require("./wppMessage.router");

  app.use("/wppMessages", wppMessagesRouter);
};
