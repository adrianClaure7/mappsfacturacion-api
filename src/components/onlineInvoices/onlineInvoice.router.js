var express = require("express");
var router = express.Router();
var OnlineInvoice = require("./onlineOnlineInvoice.model");
var moment = require("moment");
var Utilities = require('../../commons/utilities');

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
      OnlineInvoice(currentMongoose).countDocuments(filter),
      OnlineInvoice(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ customerNITs: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      OnlineInvoice(currentMongoose).countDocuments(filter),
      OnlineInvoice(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ customerNITs: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/getAllDeclaredDates", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose)
      .getAllDeclaredDates(currentMongoose)
      .then(declaredDates => {
        res.json(declaredDates);
      })
      .catch(err => res.status(403).send(err));
  }
});

router.post("/getByMonth", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    if (req.body.year) {
      var start = new Date();
      var end = new Date();
      if (req.body.month == 12) {
        start = moment().set({ 'year': req.body.year, 'month': 0 }).startOf('month').startOf('day').toDate()
        end = moment().set({ 'year': req.body.year, 'month': 11 }).endOf('month').endOf('day').toDate()
      } else {
        start = moment().set({ 'year': req.body.year, 'month': req.body.month }).startOf('month').startOf('day').toDate()
        end = moment().set({ 'year': req.body.year, 'month': req.body.month }).endOf('month').endOf('day').toDate()
      }

      OnlineInvoice(currentMongoose)
        .find({
          "createdOn": { "$gte": start, "$lt": end }
        })
        .then(data => {
          res.json(data);
        })
        .catch(err => {
          res.status(403).send(err)
        });
    } else {
      res.status(403).json("Missing month and year");
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose)
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

router.get("/:onlineInvoiceID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose)
      .findById(req.params.onlineInvoiceID)
      .then(onlineInvoice => {
        if (!onlineInvoice) res.status(404).send("not found OnlineInvoice");

        res.send(onlineInvoice);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(onlineInvoice => {
        if (!onlineInvoice) res.status(404).send({ err: "No Encontrados" });

        res.send(onlineInvoice);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:onlineInvoiceID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose).findByIdAndDelete(
      req.params.onlineInvoiceID,
      (err, onlineInvoiceDeleted) => {
        if (err) res.status(403).send(err);

        res.send(onlineInvoiceDeleted);
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    var onlineInvoice = new OnlineInvoice(currentMongoose)(req.body);
    onlineInvoice.createdBy = req.auth ? req.auth.username : "";

    onlineInvoice
      .create(currentMongoose)
      .then(onlineInvoice => {
        if (!onlineInvoice) res.status(403).send("not OnlineInvoice created");
        else res.send(onlineInvoice);
      })
      .catch(err => {
        res.status(403).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/onlineOnlineInvoice", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose)
      .createXML(currentMongoose, req.body)
      .then(onlineInvoice => {
        if (!onlineInvoice) res.status(403).send("not OnlineInvoice created");
        else res.send(onlineInvoice);
      })
      .catch(err => {
        res.status(403).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.put("/:onlineInvoiceID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    OnlineInvoice(currentMongoose).findByIdAndUpdate(
      req.params.onlineInvoiceID,
      req.body,
      { new: true },
      (err, onlineInvoice) => {
        if (err) res.status(404).send(err);

        res.send(onlineInvoice);
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.put("/updateState/:onlineInvoiceID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    OnlineInvoice(currentMongoose).findByIdAndUpdate(
      req.params.onlineInvoiceID,
      req.body,
      { new: true },
      (err, onlineInvoice) => {
        if (err) {
          res.status(404).send(err);
        } else {
          res.send(onlineInvoice);
        }
      }
    );
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/onlineInvoice", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    OnlineInvoice(currentMongoose)
      .createXML(currentMongoose, req.body)
      .then(invoice => {
        if (!invoice) res.status(403).send("not OnlineInvoice created");
        else res.send(invoice);
      })
      .catch(err => {
        res.status(403).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


module.exports = router;
