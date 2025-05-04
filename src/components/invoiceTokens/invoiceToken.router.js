var express = require("express");
var router = express.Router();
var InvoiceToken = require("./invoiceToken.model");
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
      InvoiceToken(currentMongoose).countDocuments(filter),
      InvoiceToken(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ invoiceTokens: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      InvoiceToken(currentMongoose).countDocuments(filter),
      InvoiceToken(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ invoiceTokens: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceToken(currentMongoose)
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

router.get("/:invoiceTokenID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceToken(currentMongoose)
      .findById(req.params.invoiceTokenID)
      .then(invoiceToken => {
        if (!invoiceToken) res.status(404).send("not found InvoiceToken");

        res.send(invoiceToken);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceToken(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(invoiceToken => {
        if (!invoiceToken) res.status(404).send("not found InvoiceToken");
        else {
          res.send(invoiceToken);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceToken(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(invoiceToken => {
        if (!invoiceToken) res.status(404).send({ err: "No Encontrados" });

        res.send(invoiceToken);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:invoiceTokenID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceToken(currentMongoose).findByIdAndDelete(
      req.params.invoiceTokenID,
      (err, invoiceTokenDeleted) => {
        if (err) res.status(403).send(err);

        res.send(invoiceTokenDeleted);
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

    const invoiceToken = new InvoiceToken(currentMongoose)(req.body);
    invoiceToken.createdBy = req.auth ? req.auth.username : "";

    const savedToken = await invoiceToken.save();
    res.json(savedToken);
  } catch (error) {
    res.status(403).json({ error: "Failed to save InvoiceToken", details: error.message });
  }
});

router.put("/:invoiceTokenID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedInvoiceToken = await InvoiceToken(currentMongoose).findByIdAndUpdate(
        req.params.invoiceTokenID,
        req.body,
        { new: true }
      );

      if (!updatedInvoiceToken) {
        return res.status(404).json({ error: "InvoiceToken not found" });
      }

      res.json(updatedInvoiceToken);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
