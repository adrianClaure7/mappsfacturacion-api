const express = require("express");
const Auth = require("../../authenticate/authenticate");
const GenerateJWTs = require("../../GenerateJWTs/GenerateJWTs");
var MongooseConnectionHandler = require("../../../middlewares/mongooseConnectionHandler");
const ExternalAcces = require("../../externalAccess/externalAcces.model");
const ApiFunctions = require('../api');
const apiFunctions = new ApiFunctions();
var ConnectionHandler = new MongooseConnectionHandler();

let router = express.Router();
let auth = new Auth();

router.post("/", function (req, res) {
  if (req.body && req.body.TokenService) {
    const generateJWT = new GenerateJWTs();
    generateJWT.decodeExternalToken(req.body.TokenService)
      .then(tokenData => {
        ConnectionHandler.getConnectionByDb(tokenData.database)
          .then(merchantMongoose => {
            ExternalAcces(merchantMongoose).findById(tokenData.externalAccessId)
              .then(externalAccess => {
                auth
                  .loginUserId(externalAccess.userId, merchantMongoose)
                  .then(token => {
                    const response = apiFunctions.validResponse(token.token);
                    res.send(response)
                  })
                  .catch(error => {
                    res.status(404).send(error)
                  });
              })
              .catch(error => {
                res.status(404).send(error)
              });
          })
          .catch(error => {
            res.status(404).send(error)
          });
      })
      .catch(error => {
        res.status(404).send(error)
      });

  } else {
    res.status(404).send({ error: 'Invalida Data' });
  }
});

module.exports = router;
