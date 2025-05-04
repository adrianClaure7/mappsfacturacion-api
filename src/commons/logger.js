const config = require("./../../config/config");
const log4js = require("log4js");

log4js.configure({
  appenders: {
    app: { type: "file", filename: config.LOGGER_FILENAME },
    out: { type: "stdout" }
  },
  categories: {
    default: { appenders: ["app", "out"], level: config.LOGGER_LEVEL }
  }
});

let logger = log4js.getLogger("app");
logger.level = config.LOGGER_LEVEL;

class Logger {
  static trace(...messages) {
    logger.trace(...messages);
  }

  static debug(...messages) {
    logger.debug(...messages);
  }

  static info(...messages) {
    logger.info(...messages);
  }

  static warn(...messages) {
    logger.warn(...messages);
  }

  static error(...messages) {
    logger.error(...messages);
  }

  static fatal(...messages) {
    logger.fatal(...messages);
  }
}

module.exports = Logger;
