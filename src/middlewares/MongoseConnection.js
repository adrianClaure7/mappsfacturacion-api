var mongooseConnections = [];
var isFirstTime = true;
const MongooseConnections = function () {
    return {
        get: function () {
            return mongooseConnections;
        },
        push: function (mongooseConnection) {
            mongooseConnections.push(mongooseConnection);
        },
        isFirstTime: function () {
            return isFirstTime;
        },
        changeFirstTime: function () {
            isFirstTime = false;
        }
    };
};
module.exports = MongooseConnections;