const bodyParser = require("body-parser");

module.exports = function(app) {
  // parse application/json
  app.use(bodyParser.json({ limit: "50mb" }));
};
