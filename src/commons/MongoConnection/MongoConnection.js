const MongoClient = require('mongodb').MongoClient
const config = require("./../../../config/config");

class MongoConnection {
    static connect() {
        return MongoClient.connect(MongoConnection.url, MongoConnection.options)
    }
}

MongoConnection.url = config.MONGODB_URL1;
MongoConnection.options = {
    bufferMaxEntries:   0,
    reconnectTries:     5000,
    useNewUrlParser: true
};

module.exports = { MongoConnection }