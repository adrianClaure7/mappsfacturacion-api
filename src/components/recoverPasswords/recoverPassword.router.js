var express = require("express");
let token = require("./../../commons/token");
var router = express.Router();
var RecoverPassword = require("./recoverPassword.model");
var config = require("../../../config/config");
var mongoseeConnections = require("../../middlewares/mongoseConnections");
var Utilities = require('../../commons/utilities');
var USER_PERMISSIONS = require('../../commons/userPemissions');

var AuthUser = require('../authUsers/authUser.model');
var User = require('../users/user.model');
var MerchantConfig = require('../merchantConfigs/merchantConfig.model');
var Customer = require('../customers/customer.model');

router.post("/paginate/", async (req, res) => {
  try {
    const limit = req.query?.limit ? parseInt(req.query.limit, 10) || 20 : 20;
    const page = req.query?.page ? parseInt(req.query.page, 10) || 0 : 0;
    const skip = page * limit;
    const select = req.query?.select && req.query.select !== "0" ? req.query.select : null;

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(500).json({ error: "Mongoose connection not found" });
    }

    let filter = {};
    if (req.body?.commonFilters) {
      try {
        const { dateFilter, stringFilters, staticFilters } = req.body.commonFilters;
        const stringJSONFilter = `{${Utilities.prepareFilter(dateFilter, stringFilters, staticFilters)}}`;
        filter = JSON.parse(stringJSONFilter);
      } catch (err) {
        return res.status(400).json({ error: "Invalid filter format", details: err.message });
      }
    }

    const count = await Product(currentMongoose).countDocuments(filter);
    const data = await Product(currentMongoose)
      .find(filter)
      .skip(limit > 0 ? skip : 0)
      .limit(limit > 0 ? limit : 0)
      .select(select)
      .sort({ createdOn: -1 });

    const pages = limit > 0 ? Math.ceil(count / limit) : 0;

    res.json({ cuiss: data, pages, total: count });

  } catch (err) {
    console.error("Error in /paginate/ POST route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/paginate/", async (req, res) => {
  try {
    const limit = req.query?.limit ? parseInt(req.query.limit, 10) || 20 : 20;
    const page = req.query?.page ? parseInt(req.query.page, 10) || 0 : 0;
    const skip = page * limit;
    const select = req.query?.select && req.query.select !== "0" ? req.query.select : null;
    const filter = req.query?.filter ? JSON.parse(req.query.filter) : {};

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(500).json({ error: "Mongoose connection not found" });
    }

    const count = await Product(currentMongoose).countDocuments(filter);
    const data = await Product(currentMongoose)
      .find(filter)
      .skip(limit > 0 ? skip : 0)
      .limit(limit > 0 ? limit : 0)
      .select(select)
      .sort({ createdOn: -1 });

    const pages = limit > 0 ? Math.ceil(count / limit) : 0;

    res.json({ cufds: data, pages, total: count });
  } catch (err) {
    console.error("Error in /paginate route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    RecoverPassword(currentMongoose)
      .find()
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        res.status(404).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.get("/:recoverPasswordID", function (req, res) {
  const url = `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`;
  mongoseeConnections(url, config.AUTHUSER_DB)
    .getConnection()
    .then(authMongoose => {
      RecoverPassword(authMongoose)
        .findById(req.params.recoverPasswordID)
        .then(recoverPassword => {
          if (!recoverPassword) res.status(404).send("not found RecoverPassword");
          else {
            res.send(recoverPassword);
          }
        });
    });
});
router.post("/changePassword", async (req, res) => {
  try {
    const url = `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`;
    const authMongoose = await mongoseeConnections(url, config.AUTHUSER_DB).getConnection();

    const userInfo = req.body.recoverPasswordInfo;
    if (!userInfo.username || userInfo.password !== userInfo.confirmedPassword || !userInfo.recoverPasswordId) {
      return res.status(403).json({ error: "Invalid input parameters" });
    }

    const countRecoverPassword = await RecoverPassword(authMongoose).countDocuments({ _id: userInfo.recoverPasswordId });
    if (countRecoverPassword === 0) {
      return res.status(403).json({ error: "RecoverPassword entry does not exist" });
    }

    const userFound = await AuthUser(authMongoose).findOneAndUpdate(
      { username: userInfo.username },
      { password: userInfo.password },
      { new: true }
    );

    if (!userFound) {
      return res.status(403).json({ error: "User not found" });
    }

    await RecoverPassword(authMongoose).deleteOne({ _id: userInfo.recoverPasswordId });

    const userDbUrl = `${config.MONGODB_URL}${userFound.database}?authSource=admin`;
    const clientMongoose = await mongoseeConnections(userDbUrl, userFound.database).getConnection();

    const user = await User(clientMongoose).findOneAndUpdate(
      { username: userInfo.username },
      { password: userInfo.password },
      { new: true }
    );

    if (!user) {
      return res.status(403).json({ error: "User update failed" });
    }

    const [merchantConfig, customer] = await Promise.all([
      MerchantConfig(clientMongoose).findOne().select("expirationDate"),
      Customer(clientMongoose).findOne({ email: userInfo.username })
    ]);

    if (merchantConfig && merchantConfig.expirationDate) {
      user.expirationDate = merchantConfig.expirationDate;
    }

    let currentUser = {
      id: user.id,
      username: user.username,
      permissions: user.permissions,
      name: user.name,
      database: user.database,
      expirationDate: user.expirationDate,
      allowWppNotifications: user.allowWppNotifications,
      customerCode: customer?.code,
      phone: user.phone,
      iso2: user.iso2,
      email: user.email
    };

    res.json({ token: token.generateToken(currentUser) });

  } catch (err) {
    console.error("Error in /changePassword route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    RecoverPassword(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(recoverPassword => {
        if (!recoverPassword) res.status(404).send({ err: "No Encontrados" });

        res.send(recoverPassword);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:recoverPasswordID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    RecoverPassword(currentMongoose).findByIdAndDelete(
      req.params.recoverPasswordID,
      (err, recoverPasswordDeleted) => {
        if (err) res.status(403).send(err);

        res.send(recoverPasswordDeleted);
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/", function (req, res) {
  const url = `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`;
  mongoseeConnections(url, config.AUTHUSER_DB)
    .getConnection()
    .then(authMongoose => {
      var recoverPassword = new RecoverPassword(authMongoose)(req.body);

      recoverPassword
        .sendResetPassword(authMongoose)
        .then(newRecoverPassword => {
          res.json(newRecoverPassword);
        })
        .catch(err => {
          res.status(404).json(err);
        });
    })
    .catch(err => {
      res.status(404).json(err);
    });
});

router.put("/:recoverPasswordID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedRecoverPassword = await RecoverPassword(currentMongoose).findByIdAndUpdate(
      req.params.recoverPasswordID,
      req.body,
      { new: true }
    );

    if (!updatedRecoverPassword) {
      return res.status(404).json({ error: "RecoverPassword entry not found" });
    }

    res.json(updatedRecoverPassword);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});


module.exports = router;
