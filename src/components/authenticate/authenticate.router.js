const express = require("express");
const Auth = require("./authenticate");
var UserConected = require("./user-conected.model");

let router = express.Router();
let auth = new Auth();

router.post("/", function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  auth
    .login(username, password)
    .then(token => res.send(token))
    .catch(error => {
      res.status(404).send(error)
    });
});

router.get("/", function (req, res, next) {
  UserConected.find()
    .then(data => {
      res.json(data);
    })
    .catch(err => {
      res.status(403).json(err);
    });
});

router.put("/userConected/:userID", function (req, res) {
  UserConected.activateConected(req.params.userID, req.body)
    .then(userConected =>
      userConected
        ? res.send(userConected)
        : res.status(400).send("user conected not updated")
    )
    .catch(err => {
      res.status(400).send(err);
    });
});

router.post("/userConected/delete", function (req, res) {
  UserConected.deleteUserConected(req.body.token)
    .then(userConected =>
      userConected
        ? res.send(userConected)
        : res.status(400).send("user conected not updated")
    )
    .catch(err => {
      res.status(400).send(err);
    });
});

module.exports = router;
