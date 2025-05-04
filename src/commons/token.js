const config = require("./../../config/config");
const logger = require("./../commons/logger");
let jwt = require("jsonwebtoken");

class Token {
  static generateToken(data, externalAccess = undefined) {
    var token = '';
    if (externalAccess) {
      token = jwt.sign(data, config.JWT_KEY);
    } else {
      token = jwt.sign(data, config.JWT_KEY, { expiresIn: config.JWT_EXP });
    }
    logger.info("[Token][generateToken]", "A json web token was generated");
    return token;
  }
}

module.exports = Token;
