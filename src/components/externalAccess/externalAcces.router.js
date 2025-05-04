var express = require("express");
var router = express.Router();
var ExternalAcces = require("./externalAcces.model");
var Utilities = require("../../commons/utilities");
const GenerateJWTs = require("./../GenerateJWTs/GenerateJWTs");

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
        const stringJSONFilter = `{${Utilities.prepareFilter(req.body.commonFilters.dateFilter, req.body.commonFilters.stringFilters, req.body.commonFilters.staticFilters)}}`;
        filter = JSON.parse(stringJSONFilter);
      } catch (err) {
        return res.status(400).json({ error: "Invalid filter format", details: err.message });
      }
    }

    const [count, data] = await Promise.all([
      ExternalAcces(currentMongoose).countDocuments(filter),
      ExternalAcces(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ externalAccess: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ POST route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

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
      ExternalAcces(currentMongoose).countDocuments(filter),
      ExternalAcces(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ externalAccess: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    ExternalAcces(currentMongoose)
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

router.get("/:externalAccesID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    ExternalAcces(currentMongoose)
      .findById(req.params.externalAccesID)
      .then(externalAcces => {
        if (!externalAcces) res.status(404).send("not found ExternalAcces");

        res.send(externalAcces);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    ExternalAcces(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(externalAcces => {
        if (!externalAcces) res.status(404).send("not found ExternalAcces");
        else {
          res.send(externalAcces);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    ExternalAcces(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(externalAcces => {
        if (!externalAcces) res.status(404).send({ err: "No Encontrados" });

        res.send(externalAcces);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:externalAccesID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    ExternalAcces(currentMongoose).findByIdAndDelete(
      req.params.externalAccesID,
      (err, externalAccesDeleted) => {
        if (err) res.status(403).send(err);

        res.send(externalAccesDeleted);
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

    const externalAcces = new ExternalAcces(currentMongoose)(req.body);
    externalAcces.createdBy = req.user ? req.user.username : "";

    const savedAccess = await externalAcces.save();
    res.json(savedAccess);

  } catch (error) {
    console.error("Error saving ExternalAccess:", error);
    res.status(403).json({ error: error.message });
  }
});


router.put("/:externalAccesID", async function (req, res) {
  req.body.updatedBy = req.user ? req.user.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedExternalAcces = await ExternalAcces(currentMongoose).findByIdAndUpdate(
        req.params.externalAccesID,
        req.body,
        { new: true }
      );

      if (!updatedExternalAcces) {
        return res.status(404).json({ error: "ExternalAcces not found" });
      }

      res.json(updatedExternalAcces);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/generateTokenWithUser", async function (req, res) {
  var user = req.auth;
  var currentMongoose = req.currentMongoose;

  if (currentMongoose && user) {
    try {
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };
      const externalAccessUpdated = await ExternalAcces(currentMongoose).findOneAndUpdate(
        { userId: user.id, database: user.database },
        { userId: user.id, database: user.database, createdBy: user.username, updatedBy: user.username },
        options
      );

      if (!externalAccessUpdated) {
        return res.status(404).json({ error: "External Access not found or created" });
      }

      const generateJWT = new GenerateJWTs();
      const tokenInfo = {
        token: generateJWT.generateExternalToken(externalAccessUpdated._id, user.database),
        externalAccessId: externalAccessUpdated._id
      };

      res.json(tokenInfo);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
