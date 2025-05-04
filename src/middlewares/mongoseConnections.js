var Mongoose = require("mongoose").Mongoose;
var mongooseConnections = require('./MongoseConnection')();

module.exports = function (connectionUrl, db) {
  var connection = {};

  connection.getConnection = function () {
    return new Promise((resolve, reject) => {
      let mongooseCloned = mongooseConnections.get().find(
        x => x.connection.db.databaseName === db
      );
      if (mongooseCloned) {
        resolve(mongooseCloned);
      } else {
        mongooseCloned = new Mongoose();
        mongooseCloned
          .connect(connectionUrl)
          .then(
            connection => {
              let mongooseCloned2 = mongooseConnections.get().find(
                x => x.connection.name === connection.connection.name
              );
              if (!mongooseCloned2) {
                mongooseConnections.push(mongooseCloned);
              }

              resolve(mongooseCloned);
            },
            error => {
              reject(error);
            }
          );
      }
    });
  };

  connection.removeConnection = function () {
    return new Promise((resolve, reject) => {
      var mongooseClonedTo = mongooseConnections.get().find(
        x => x.connection.db.databaseName === db
      );
      mongooseClonedTo.connection.db.dropDatabase();
      var removeIndex = mongooseConnections.map(x => x.connection.db.databaseName)
        .indexOf(db);

      if (removeIndex && removeIndex !== -1) {
        mongooseConnections.splice(removeIndex, 1);
      }
      resolve();
    });
  }

  return connection;
};
