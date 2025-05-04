var express = require("express");
var router = express.Router();
var CustomerNIT = require("./customerNIT.model");
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
        const { dateFilter, stringFilters, staticFilters } = req.body.commonFilters;
        const stringJSONFilter = `{${Utilities.prepareFilter(dateFilter, stringFilters, staticFilters)}}`;
        filter = JSON.parse(stringJSONFilter);
      } catch (err) {
        return res.status(400).json({ error: "Invalid filter format", details: err.message });
      }
    }

    const [count, data] = await Promise.all([
      CustomerNIT(currentMongoose).countDocuments(filter),
      CustomerNIT(currentMongoose)
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
      CustomerNIT(currentMongoose).countDocuments(filter),
      CustomerNIT(currentMongoose)
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

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    CustomerNIT(currentMongoose)
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

router.get("/:customerNITID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    CustomerNIT(currentMongoose)
      .findById(req.params.customerNITID)
      .then(customerNIT => {
        if (!customerNIT) res.status(404).send("not found CustomerNIT");

        res.send(customerNIT);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    CustomerNIT(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(customerNIT => {
        if (!customerNIT) res.status(404).send("not found CustomerNIT");
        else {
          res.send(customerNIT);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    CustomerNIT(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(customerNIT => {
        if (!customerNIT) res.status(404).send({ err: "No Encontrados" });

        res.send(customerNIT);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:customerNITID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    CustomerNIT(currentMongoose).findByIdAndDelete(
      req.params.customerNITID,
      (err, customerNITDeleted) => {
        if (err) res.status(403).send(err);

        res.send(customerNITDeleted);
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

    const customerNIT = new CustomerNIT(currentMongoose)(req.body);
    customerNIT.createdBy = req.auth ? req.auth.username : "";

    const savedCustomerNIT = await customerNIT.save();
    res.json(savedCustomerNIT);
  } catch (error) {
    res.status(403).json({ error: "Failed to save Customer NIT", details: error.message });
  }
});

router.put("/:customerNITID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedCustomerNIT = await CustomerNIT(currentMongoose).findByIdAndUpdate(
        req.params.customerNITID,
        req.body,
        { new: true }
      );

      if (!updatedCustomerNIT) {
        return res.status(404).json({ error: "CustomerNIT not found" });
      }

      res.json(updatedCustomerNIT);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
