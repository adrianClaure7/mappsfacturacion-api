var express = require("express");
var router = express.Router();
var Merchant = require("./merchant.model");
var Counter = require("./../counters/counters.model");
var USER_PERMISSIONS = require("./../../commons/userPemissions");
var COUNTER_CODES = require("./../../commons/counterCodes");

var Utilities = require("./../../commons/utilities");
const GenerateJWTs = require("./../GenerateJWTs/GenerateJWTs");
var MongooseConnectionHandler = require("./../../middlewares/mongooseConnectionHandler");
var ConnectionHandler = new MongooseConnectionHandler();

router.post("/paginate/", async (req, res) => {
  try {
    const limit = parseInt(req.query?.limit, 10) || 20;
    const page = parseInt(req.query?.page, 10) || 0;
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

    const [count, data] = await Promise.all([
      Merchant(currentMongoose).countDocuments(filter),
      Merchant(currentMongoose)
        .find(filter)
        .skip(skip)
        .limit(limit)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ merchants: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ POST route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/paginate/", async (req, res) => {
  try {
    const limit = parseInt(req.query?.limit, 10) || 50;
    const page = parseInt(req.query?.page, 10) || 0;
    const skip = page * limit;
    const select = req.query?.select && req.query.select !== "0" ? req.query.select : null;
    const filter = req.query?.filter ? JSON.parse(req.query.filter) : {};

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(500).json({ error: "Mongoose connection not found" });
    }

    const [count, data] = await Promise.all([
      Merchant(currentMongoose).countDocuments(filter),
      Merchant(currentMongoose)
        .find(filter)
        .skip(skip)
        .limit(limit)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ merchants: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose)
      .find()
      .sort({ createdOn: -1 })
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

router.get("/:merchantID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose)
      .findById(req.params.merchantID)
      .then(merchant => {
        if (!merchant) res.status(404).send("not found Merchant");

        res.send(merchant);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .sort({ createdOn: -1 })
      .then(merchant => {
        if (!merchant) res.status(404).send({ err: "No Encontrados" });

        res.send(merchant);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:merchantID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose).findByIdAndDelete(
      req.params.merchantID,
      (err, merchantDeleted) => {
        if (err) res.status(403).send(err);

        res.send(merchantDeleted);
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const merchant = new Merchant(currentMongoose)(req.body);
    merchant.createdBy = req.auth ? req.auth.username : "";

    const savedMerchant = await merchant.save();
    res.json(savedMerchant);
  } catch (error) {
    res.status(403).json({ error: "Error saving Merchant", details: error.message });
  }
});

router.put("/updateExpirationDate/:merchantID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";
    const currentMongoose = req.currentMongoose;

    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedMerchant = await Merchant(currentMongoose).findByIdAndUpdate(
      req.params.merchantID,
      { expirationDate: req.body.expirationDate },
      { new: true }
    );

    if (!updatedMerchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    try {
      await Merchant(currentMongoose).updateExpirationDate(updatedMerchant);
      res.json(updatedMerchant);
    } catch (err) {
      res.status(403).json({ error: "Error updating expiration date", details: err.message });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

router.put("/updateUsers/:merchantID", function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose).findByIdAndUpdate(
      req.params.merchantID,
      { activeUsers: req.body.activeUsers },
      { new: true },
      (err, merchant) => {
        if (err) res.status(404).send(err);
        Merchant(currentMongoose)
          .addMerchantUsers(merchant, req.body.usersToAdd, req.body.usersToDelete)
          .then(usersMerchant => {
            res.send(merchant);
          })
          .catch(err => res.status(403).send(err));
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/registerMerchant", async function (req, res) {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json({ error: "Conexión a la base de datos no encontrada." });
  }

  const merchantData = req.body;
  const merchant = new Merchant(currentMongoose)(merchantData);

  // Configurar datos adicionales
  merchant.database = `${merchant.code}DB`;
  merchant.notDelete = true;
  merchant.createdBy = req.auth ? req.auth.username : "";

  // Validar permisos
  const hasSuperAdmin = req.auth &&
    req.auth.permissions.some(
      x => x.code === USER_PERMISSIONS.SUPER_ADMIN.code
    );

  if (!hasSuperAdmin) {
    return res.status(403).json({ error: "El usuario debe tener permisos de super administrador." });
  }

  try {
    const newMerchant = await merchant.registerMerchant(currentMongoose);

    if (!newMerchant) {
      return res.status(403).json({ error: "No se pudo crear el comercio (merchant)." });
    }

    // Incrementar contador
    await Counter(currentMongoose).updateOne(
      { code: COUNTER_CODES.MERCHANTS },
      { $inc: { counter: 1 } }
    );

    return res.json(newMerchant);

  } catch (err) {
    console.error("Error al registrar merchant:", err);
    return res.status(403).json({ error: err.message || err });
  }
});

router.post("/generateToken", function (req, res) {
  var data = req.body;

  if (data.merchantCode) {
    ConnectionHandler.getConnectionByMerchantCode(data.merchantCode)
      .then(merchantMongoose => {
        if (merchantMongoose) {
          var generateJWT = new GenerateJWTs();
          generateJWT.generateMerchantToken(data.merchantCode).then(token => {
            if (token) {
              res.json({ token });
            } else {
              res.status(403).send({ error: 'token not generated' })
            }
          }).catch(err => {
            res.status(403).send(err);
          });
        } else {
          res.status(403).send({ error: 'Invalid data' });
        }
      }).catch(error => {
        res.status(403).send(error);
      });
  } else {
    res.status(403).send({ error: 'Invalid data' });
  }
});

router.put("/updateAllowWppNotifications/:merchantID", function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose).findByIdAndUpdate(
      req.params.merchantID,
      { allowWppNotifications: req.body.allowWppNotifications },
      { new: true },
      (err, merchant) => {
        if (err) res.status(404).send(err);
        Merchant(currentMongoose)
          .updateAllowWppNotifications(merchant)
          .then(usersMerchant => {
            res.send(merchant);
          })
          .catch(err => {
            res.status(403).send(err)
          });
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


router.put("/changeMerchantCode/:merchantID", function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Merchant(currentMongoose).changeMerchantCode(currentMongoose,
      req.params.merchantID,
      req.body).then((merchant) => {
        res.send(merchant);
      }).catch(err => {
        res.status(403).send(err)
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
