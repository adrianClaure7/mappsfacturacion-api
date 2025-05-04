var express = require("express");
var router = express.Router();
var MerchantConfig = require("./merchantConfig.model");

router.get("/paginate/", async (req, res) => {
  try {
    const limit = parseInt(req.query?.limit, 10) || 20;
    const page = parseInt(req.query?.page, 10) || 0;
    const skip = page * limit;
    const select = req.query?.select && req.query.select !== "0" ? req.query.select : null;
    const filter = req.query?.filter ? JSON.parse(req.query.filter) : {};

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(500).json({ error: "Mongoose connection not found" });
    }

    const [count, data] = await Promise.all([
      MerchantConfig(currentMongoose).countDocuments(filter),
      MerchantConfig(currentMongoose)
        .find(filter)
        .skip(skip)
        .limit(limit)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ merchantConfigs: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose)
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

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(merchantConfig => {
        if (!merchantConfig) res.status(404).send("not found MerchantConfig");
        else {
          res.send(merchantConfig);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.get("/first", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    var select = req.query ? (req.query.select != "0" ? req.query.select : 0) : 0;
    MerchantConfig(currentMongoose)
      .findOne()
      .select(select)
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


router.get("/:merchantConfigID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose)
      .findById(req.params.merchantConfigID)
      .then(merchantConfig => {
        if (!merchantConfig) res.status(404).send("not found MerchantConfig");

        res.send(merchantConfig);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/invoiceInfo", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose)
      .findOne()
      .select('facturacion')
      .then(merchantConfig => {
        if (!merchantConfig) res.status(404).send("not found MerchantConfig");

        res.send(merchantConfig.facturacion);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:merchantConfigID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose).findByIdAndDelete(
      req.params.merchantConfigID,
      (err, merchantConfigDeleted) => {
        if (err) res.status(403).send(err);

        res.send(merchantConfigDeleted);
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

    const merchantConfig = new MerchantConfig(currentMongoose)(req.body);
    merchantConfig.createdBy = req.auth ? req.auth.username : "";

    const savedMerchantConfig = await merchantConfig.save();
    res.json(savedMerchantConfig);
  } catch (error) {
    res.status(403).json({ error: "Error saving MerchantConfig", details: error.message });
  }
});

router.put("/:merchantConfigID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedMerchantConfig = await MerchantConfig(currentMongoose).findByIdAndUpdate(
        req.params.merchantConfigID,
        req.body,
        { new: true }
      );

      if (!updatedMerchantConfig) {
        return res.status(404).json({ error: "MerchantConfig not found" });
      }

      res.json(updatedMerchantConfig);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/updateConfigInvoice", async function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedMerchant = await MerchantConfig(currentMongoose).findOneAndUpdate(
        {},
        req.body,
        { new: true } // This ensures that the updated document is returned
      );

      if (!updatedMerchant) {
        return res.status(404).json({ error: "MerchantConfig not found" });
      }

      res.json(updatedMerchant);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/updateConfigPaymentUrl", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const merchantUpdated = await MerchantConfig(currentMongoose).findOneAndUpdate(
      {},
      req.body,
      { new: true } // Ensures that the updated document is returned
    );

    if (!merchantUpdated) {
      return res.status(404).json({ error: "MerchantConfig not found" });
    }

    res.json(merchantUpdated);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

router.post("/getHomeData", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose)
      .findOne()
      .select('businessName allowWppNotifications imgUrl imgRouteName')
      .then(merchantConfig => {
        if (!merchantConfig) res.status(404).send("not found MerchantConfig");
        var data = {
          merchantConfig
        };
        res.send(data);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
