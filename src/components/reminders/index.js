module.exports = function(app) {
  let remindersRouter = require("./reminder.router");

  app.use("/reminders", remindersRouter);
};
