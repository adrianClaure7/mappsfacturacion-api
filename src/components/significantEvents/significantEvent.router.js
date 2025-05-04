var express = require("express");
var router = express.Router();
var SignificantEvent = require("./significantEvent.model");
var Utilities = require("../../commons/utilities");
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
      SignificantEvent(currentMongoose).countDocuments(filter),
      SignificantEvent(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ significantEvents: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      SignificantEvent(currentMongoose).countDocuments(filter),
      SignificantEvent(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ significantEvents: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    SignificantEvent(currentMongoose)
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

router.get("/:significantEventID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    SignificantEvent(currentMongoose)
      .findById(req.params.significantEventID)
      .then(significantEvent => {
        if (!significantEvent) res.status(404).send("not found SignificantEvent");

        res.send(significantEvent);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    SignificantEvent(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(significantEvent => {
        if (!significantEvent) res.status(404).send("not found SignificantEvent");
        else {
          res.send(significantEvent);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    SignificantEvent(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(significantEvent => {
        if (!significantEvent) res.status(404).send({ err: "No Encontrados" });

        res.send(significantEvent);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:significantEventID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    SignificantEvent(currentMongoose).findByIdAndDelete(
      req.params.significantEventID,
      (err, significantEventDeleted) => {
        if (err) res.status(403).send(err);

        res.send(significantEventDeleted);
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
      return res.status(404).json("Connection mongoose not found");
    }

    const significantEvent = new SignificantEvent(currentMongoose)(req.body);
    significantEvent.createdBy = req.auth?.username || "";

    const resp = await significantEvent.save();
    res.send(resp);
  } catch (err) {
    res.status(403).send(err.errmsg);
  }
});

router.put("/:significantEventID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedSignificantEvent = await SignificantEvent(currentMongoose).findByIdAndUpdate(
      req.params.significantEventID,
      req.body,
      { new: true }
    );

    if (!updatedSignificantEvent) {
      return res.status(404).json({ error: "SignificantEvent not found" });
    }

    res.json(updatedSignificantEvent);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

module.exports = router;
