var express = require("express");
var router = express.Router();
var WppMessage = require("./wppMessage.model");
var Utilities = require('../../commons/utilities');
const WppNotifications = require("../wppNotifications");

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

    const count = await WppMessage(currentMongoose).countDocuments(filter);
    const data = await WppMessage(currentMongoose)
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

    const count = await WppMessage(currentMongoose).countDocuments(filter);
    const data = await WppMessage(currentMongoose)
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
    WppMessage(currentMongoose)
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

router.get("/:wppMessageID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    WppMessage(currentMongoose)
      .findById(req.params.wppMessageID)
      .then(wppMessage => {
        if (!wppMessage) res.status(404).send("not found WppMessage");
        else {
          res.send(wppMessage);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    WppMessage(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(wppMessage => {
        if (!wppMessage) res.status(404).send("not found WppMessage");
        else {
          res.send(wppMessage);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    WppMessage(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(wppMessage => {
        if (!wppMessage) res.status(404).send({ err: "No Encontrados" });
        else {
          res.send(wppMessage);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.get("/getBySid/:messageSidID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  var sid = req.params.messageSidID;

  if (currentMongoose && sid) {
    var wppNotifications = new WppNotifications(currentMongoose);
    wppNotifications.getMessageWppBySid(sid).then(message => {
      var auxMessage = {
        to: message.to,
        status: message.status,
        body: message.body
      }
      res.json(auxMessage);
    }).catch(err => {
      res.status(403).json(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
