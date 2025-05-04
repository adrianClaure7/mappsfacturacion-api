var express = require("express");
var router = express.Router();
var PaqueteFactura = require("./paqueteFactura.model");
var Utilities = require("../../commons/utilities");

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

    const count = await PaqueteFactura(currentMongoose).countDocuments(filter);
    const data = await PaqueteFactura(currentMongoose)
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

    const count = await PaqueteFactura(currentMongoose).countDocuments(filter);
    const data = await PaqueteFactura(currentMongoose)
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
    PaqueteFactura(currentMongoose)
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

router.get("/:paqueteFacturaID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    PaqueteFactura(currentMongoose)
      .findById(req.params.paqueteFacturaID)
      .then(paqueteFactura => {
        if (!paqueteFactura) res.status(404).send("not found PaqueteFactura");

        res.send(paqueteFactura);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    PaqueteFactura(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(paqueteFactura => {
        if (!paqueteFactura) res.status(404).send("not found PaqueteFactura");
        else {
          res.send(paqueteFactura);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    PaqueteFactura(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(paqueteFactura => {
        if (!paqueteFactura) res.status(404).send({ err: "No Encontrados" });

        res.send(paqueteFactura);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:paqueteFacturaID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    PaqueteFactura(currentMongoose).findByIdAndDelete(
      req.params.paqueteFacturaID,
      (err, paqueteFacturaDeleted) => {
        if (err) res.status(403).send(err);

        res.send(paqueteFacturaDeleted);
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

    const paqueteFactura = new PaqueteFactura(currentMongoose)(req.body);
    paqueteFactura.createdBy = req.auth?.username || "";

    const resp = await paqueteFactura.save();
    res.send(resp);
  } catch (err) {
    res.status(403).send(err.errmsg);
  }
});

router.put("/:paqueteFacturaID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedPaqueteFactura = await PaqueteFactura(currentMongoose).findByIdAndUpdate(
      req.params.paqueteFacturaID,
      req.body,
      { new: true }
    );

    if (!updatedPaqueteFactura) {
      return res.status(404).json({ error: "PaqueteFactura not found" });
    }

    res.json(updatedPaqueteFactura);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

module.exports = router;
