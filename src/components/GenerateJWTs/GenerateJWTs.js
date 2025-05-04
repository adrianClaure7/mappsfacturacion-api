let jwt = require("jsonwebtoken");
let config = require("./../../../config/config");

var mongoose = require('mongoose');

class GenerateJWTs {

    constructor() {

    }

    generateMerchantToken(merchantCode) {
        return new Promise((resolve, reject) => {
            var merchantPayload = {
                'jti': new mongoose.Types.ObjectId().toString(),
                'MerchantCode': merchantCode
            }

            var merchantToken = jwt.sign(merchantPayload, config.JWT_MERCHANTS_KEY, { algorithm: 'HS256', expiresIn: '15m' });

            resolve(merchantToken);
        });
    }

    decodeMerchantToken(merchantToken) {
        return new Promise((resolve, reject) => {
            jwt.verify(merchantToken, config.JWT_MERCHANTS_KEY, function (err, decoded) {
                if (err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            });
        });
    }

    generateExternalToken(externalAccessId, database) {
        var payload = {
            'jti': new mongoose.Types.ObjectId().toString(),
            'externalAccessId': externalAccessId,
            'database': database
        }

        return jwt.sign(payload, config.JWT_KEY);
    }

    decodeExternalToken(token) {
        return new Promise((resolve, reject) => {
            jwt.verify(token, config.JWT_KEY, function (err, decoded) {
                if (err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            });
        });
    }
}
module.exports = GenerateJWTs;
