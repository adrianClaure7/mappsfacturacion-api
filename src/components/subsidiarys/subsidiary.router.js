var express = require("express");
var router = express.Router();
var Subsidiary = require("./subsidiary.model");
var Utilities = require("../../commons/utilities");
const Operaciones = require("../onlineInvoices/soap/operaciones");
const Codigos = require("../onlineInvoices/soap/codigos");
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
      Subsidiary(currentMongoose).countDocuments(filter),
      Subsidiary(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ subsidiarys: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      Subsidiary(currentMongoose).countDocuments(filter),
      Subsidiary(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ subsidiarys: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Subsidiary(currentMongoose)
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

router.get("/:subsidiaryID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Subsidiary(currentMongoose)
      .findById(req.params.subsidiaryID)
      .then(subsidiary => {
        if (!subsidiary) res.status(404).send("not found Subsidiary");

        res.send(subsidiary);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Subsidiary(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(subsidiary => {
        if (!subsidiary) res.status(404).send("not found Subsidiary");
        else {
          res.send(subsidiary);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Subsidiary(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(subsidiary => {
        if (!subsidiary) res.status(404).send({ err: "No Encontrados" });

        res.send(subsidiary);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:subsidiaryID", async function (req, res) {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json({ error: "Conexión a la base de datos no encontrada." });
  }

  try {
    const subsidiaryDeleted = await Subsidiary(currentMongoose).findByIdAndDelete(req.params.subsidiaryID);

    if (!subsidiaryDeleted) {
      return res.status(404).json({ error: "Sucursal no encontrada o ya eliminada." });
    }

    return res.json(subsidiaryDeleted);

  } catch (err) {
    console.error("Error al eliminar la sucursal:", err);
    return res.status(403).json({ error: err.message || err });
  }
});

router.post("/", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json("Connection mongoose not found");
    }

    const subsidiary = new Subsidiary(currentMongoose)(req.body);
    subsidiary.createdBy = req.auth?.username || "";

    const resp = await subsidiary.save();

    if (subsidiary.codigoSucursal === 0 && subsidiary.codigoPuntoVenta === 0) {
      const codigos = new Codigos({});
      try {
        await codigos.generateCuis(currentMongoose, req.body);
      } catch (err) {
        console.error("Error generating CUIS:", err);
      }
    } else {
      const codigos = new Operaciones({});
      try {
        await codigos.registroPuntoVentaWithSubsidiary(currentMongoose, resp);
      } catch (err) {
        return res.status(403).send(err);
      }
    }

    res.send(resp);
  } catch (err) {
    res.status(403).send(err.errmsg);
  }
});

router.put("/:subsidiaryID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedSubsidiary = await Subsidiary(currentMongoose).updateSubsidiary(
      currentMongoose,
      Codigos,
      req.body,
      req.params.subsidiaryID
    );

    res.json(updatedSubsidiary);
  } catch (error) {
    res.status(403).json({ error: "Update failed", details: error.message });
  }
});

router.post("/getCuisByCodigoSucursal", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Subsidiary(currentMongoose).findOne(req.body).then(subsidiary => {
      var data = {
        cuis: subsidiary && subsidiary.RespuestaCuis ? subsidiary.RespuestaCuis.codigo : '',
        codigoPuntoVenta: subsidiary ? subsidiary.codigoPuntoVenta : '0'
      }
      res.send(data);
    }).catch(err => {
      res.status(403).json(err);
    });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getCufdByCodigoSucursalCodigoPuntoVenta", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const subsidiary = await Subsidiary(currentMongoose).findOne({ codigoSucursal: req.body.codigoSucursal, codigoPuntoVenta: req.body.codigoPuntoVenta })
    if (!subsidiary) {
      res.status(403).json({ error: "Failed to get CUFD", details: 'No existe el Punto de venta con los codigos que se usaron' });
    }
    if (subsidiary && subsidiary.RespuestaCufd) {
      const response = Utilities.copyObject(subsidiary.RespuestaCufd);
      response.numeroFactura = subsidiary.numeroFactura;
      res.json(response);
    }
    else {
      res.status(403).json({ error: "Failed to get CUFD", details: 'No existe el Punto de venta con los codigos que se usaron' });
    }
  } catch (error) {
    res.status(403).json({ error: "Failed to save CUFD", details: error.message });
  }
});

module.exports = router;
