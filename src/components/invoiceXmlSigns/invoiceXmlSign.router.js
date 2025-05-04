var express = require("express");
var router = express.Router();
var InvoiceXmlSign = require("./invoiceXmlSign.model");
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
      InvoiceXmlSign(currentMongoose).countDocuments(filter),
      InvoiceXmlSign(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ invoiceXmlSigns: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      InvoiceXmlSign(currentMongoose).countDocuments(filter),
      InvoiceXmlSign(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ invoiceXmlSigns: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceXmlSign(currentMongoose)
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

router.get("/:invoiceXmlSignID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceXmlSign(currentMongoose)
      .findById(req.params.invoiceXmlSignID)
      .then(invoiceXmlSign => {
        if (!invoiceXmlSign) res.status(404).send("not found InvoiceXmlSign");

        res.send(invoiceXmlSign);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceXmlSign(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(invoiceXmlSign => {
        if (!invoiceXmlSign) res.status(404).send("not found InvoiceXmlSign");
        else {
          res.send(invoiceXmlSign);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceXmlSign(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(invoiceXmlSign => {
        if (!invoiceXmlSign) res.status(404).send({ err: "No Encontrados" });

        res.send(invoiceXmlSign);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:invoiceXmlSignID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    InvoiceXmlSign(currentMongoose).findByIdAndDelete(
      req.params.invoiceXmlSignID,
      (err, invoiceXmlSignDeleted) => {
        if (err) res.status(403).send(err);

        res.send(invoiceXmlSignDeleted);
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

    const invoiceXmlSign = new InvoiceXmlSign(currentMongoose)(req.body);
    invoiceXmlSign.createdBy = req.auth ? req.auth.username : "";

    const savedToken = await invoiceXmlSign.save();
    res.json(savedToken);
  } catch (error) {
    res.status(403).json({ error: "Failed to save InvoiceXmlSign", details: error.message });
  }
});

router.put("/:invoiceXmlSignID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedInvoiceXmlSign = await InvoiceXmlSign(currentMongoose).findByIdAndUpdate(
        req.params.invoiceXmlSignID,
        req.body,
        { new: true }
      );

      if (!updatedInvoiceXmlSign) {
        return res.status(404).json({ error: "InvoiceXmlSign not found" });
      }

      res.json(updatedInvoiceXmlSign);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
