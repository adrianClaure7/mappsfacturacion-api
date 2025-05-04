var express = require("express");
var router = express.Router();
var Cuis = require("./cuis.model");
var Utilities = require("../../commons/utilities");

router.post("/paginate/", function (req, res, next) {
  var limit = req.query ? parseInt(req.query.limit) || 20 : 20;
  var page = req.query ? parseInt(req.query.page) || 0 * limit : 0;
  var skip = page * limit;
  var select = req.query ? (req.query.select != "0" ? req.query.select : 0) : 0;

  var currentMongoose = req.currentMongoose;
  var filter = {};

  if (req.body && !!req.body.commonFilters) {
    var stringJSONFilter = `{${Utilities.prepareFilter(req.body.commonFilters.dateFilter, req.body.commonFilters.stringFilters, req.body.commonFilters.staticFilters)}}`;

    filter = JSON.parse(stringJSONFilter);
  }

  if (currentMongoose) {
    Cuis(currentMongoose).countDocuments(filter, (err, count) => {
      Cuis(currentMongoose)
        .find(filter)
        .skip(limit == -1 ? "" : skip)
        .limit(limit == -1 ? "" : limit)
        .select(select)
        .sort({ createdOn: -1 })
        .then(data => {
          var pages = Math.ceil(count / limit);
          res.json({ cuiss: data, pages: pages === 1 ? 0 : pages, total: count });
        })
        .catch(err => {
          res.status(404).json(err);
        });
    });
  } else {
    res.status(404).json("Connection mongoose not found");
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
      Cuis(currentMongoose).countDocuments(filter),
      Cuis(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ cuiss: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });
  } catch (err) {
    console.error("Error in /paginate route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Cuis(currentMongoose)
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

router.get("/:cuisID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Cuis(currentMongoose)
      .findById(req.params.cuisID)
      .then(cuis => {
        if (!cuis) res.status(404).send("not found Cuis");

        res.send(cuis);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Cuis(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(cuis => {
        if (!cuis) res.status(404).send("not found Cuis");
        else {
          res.send(cuis);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Cuis(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(cuis => {
        if (!cuis) res.status(404).send({ err: "No Encontrados" });

        res.send(cuis);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:cuisID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Cuis(currentMongoose).findByIdAndDelete(
      req.params.cuisID,
      (err, cuisDeleted) => {
        if (err) res.status(403).send(err);

        res.send(cuisDeleted);
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

    const cuis = new Cuis(currentMongoose)(req.body);
    cuis.createdBy = req.auth ? req.auth.username : "";

    const savedCuis = await cuis.save();
    res.json(savedCuis);
  } catch (error) {
    res.status(403).json({ error: "Failed to save CUIS", details: error.message });
  }
});


router.put("/:cuisID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedCuis = await Cuis(currentMongoose).findByIdAndUpdate(
        req.params.cuisID,
        req.body,
        { new: true }
      );

      if (!updatedCuis) {
        return res.status(404).json({ error: "Cuis not found" });
      }

      res.json(updatedCuis);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
