const logger = require("./../commons/logger");
let userConnected = new Map();

class SocketManager {
  constructor() {
    this.io = null;
  }

  static setUser(userId, socket) {
    userConnected.set(userId, socket);
    logger.info("[SocketManager][setUser] - ", userId);
  }

  static getSocketByUser(userId) {
    logger.info("[SocketManager][getSocketByUser] - ", userId);
    return userConnected.get(userId);
  }

  static emitToSocketByUserId(userId, eventName, data) {
    let socket = this.getSocketByUser(userId);
    if (socket) {
      logger.info(
        "[SocketManager][emitToSocketByUserId] - ",
        `Socket emit to: ${userId}`
      );
      socket.emit(eventName, data);
    } else {
      logger.warn(
        "[SocketManager][emitToSocketByUserId] - ",
        `Not was able to emit to: ${userId}`
      );
    }
  }
}

module.exports = SocketManager;
