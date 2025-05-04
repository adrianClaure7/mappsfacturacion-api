var express = require("express");
var router = express.Router();
var EmitedInvoice = require("./emitedInvoice.model");
var Utilities = require("../../commons/utilities");
var $q = require("q");
const Subsidiary = require("../subsidiarys/subsidiary.model");
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
      EmitedInvoice(currentMongoose).countDocuments(filter),
      EmitedInvoice(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ emitedInvoices: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      EmitedInvoice(currentMongoose).countDocuments(filter),
      EmitedInvoice(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ emitedInvoices: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    EmitedInvoice(currentMongoose)
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

router.get("/:emitedInvoiceID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    EmitedInvoice(currentMongoose)
      .findById(req.params.emitedInvoiceID)
      .then(emitedInvoice => {
        if (!emitedInvoice) res.status(404).send("not found EmitedInvoice");

        res.send(emitedInvoice);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    EmitedInvoice(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(emitedInvoice => {
        if (!emitedInvoice) res.status(404).send("not found EmitedInvoice");
        else {
          res.send(emitedInvoice);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    EmitedInvoice(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(emitedInvoice => {
        if (!emitedInvoice) res.status(404).send({ err: "No Encontrados" });

        res.send(emitedInvoice);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:emitedInvoiceID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    EmitedInvoice(currentMongoose).findByIdAndDelete(
      req.params.emitedInvoiceID,
      (err, emitedInvoiceDeleted) => {
        if (err) res.status(403).send(err);

        res.send(emitedInvoiceDeleted);
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

    const emitedInvoice = new EmitedInvoice(currentMongoose)(req.body);
    emitedInvoice.createdBy = req.auth ? req.auth.username : "";

    const savedInvoice = await emitedInvoice.save();
    res.json(savedInvoice);
  } catch (error) {
    res.status(403).json({ error: "Failed to save EmitedInvoice", details: error.message });
  }
});

router.put("/:emitedInvoiceID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedEmitedInvoice = await EmitedInvoice(currentMongoose).findByIdAndUpdate(
        req.params.emitedInvoiceID,
        req.body,
        { new: true }
      );

      if (!updatedEmitedInvoice) {
        return res.status(404).json({ error: "EmitedInvoice not found" });
      }

      res.json(updatedEmitedInvoice);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/addAll", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose && req.body.invoices) {
    var invoicesPromises = [];
    var codigoSucursal = 0;
    var codigoPuntoVenta = 0;
    req.body.invoices.forEach(invoice => {
      var emitedInvoice = new EmitedInvoice(currentMongoose)(invoice);
      emitedInvoice.createdBy = req.auth ? req.auth.username : "";
      codigoSucursal = invoice.codigoSucursal;
      codigoPuntoVenta = invoice.codigoPuntoVenta;
      invoicesPromises.push(emitedInvoice.save());
    });

    $q.all(invoicesPromises)
      .then(async invoices => {
        await Subsidiary(currentMongoose).updateOne({ codigoSucursal: Utilities.convertToNumberIfNeeded(codigoSucursal), codigoPuntoVenta: Utilities.convertToNumberIfNeeded(codigoPuntoVenta) }, { $set: { numeroFactura: req.body.numeroFactura } });
        res.send(invoices);
      })
      .catch(err => {
        res.status(403).send(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


module.exports = router;
