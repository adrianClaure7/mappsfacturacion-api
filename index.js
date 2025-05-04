const express = require("express");
const logger = require("./src/commons/logger");
const SocketManager = require("./src/commons/socket-manager");

let app = express();
const server = require("http").createServer(app);
require('dotenv').config();

require("./src")(app);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

server.listen(process.env.PORT || 3001, () => {
  logger.info("Server running on port:", process.env.PORT || 3001);
});
