module.exports = function(app) {
  require("./middlewares")(app);
  require("./components")(app);
};
