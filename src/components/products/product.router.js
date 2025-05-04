var express = require("express");
var router = express.Router();
var Product = require("./product.model");
var Utilities = require("../../commons/utilities");
const Sincronizacion = require("../onlineInvoices/soap/sincronizacion");
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
      Product(currentMongoose).countDocuments(filter),
      Product(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ products: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      Product(currentMongoose).countDocuments(filter),
      Product(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ products: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Product(currentMongoose)
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

router.get("/:productID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Product(currentMongoose)
      .findById(req.params.productID)
      .then(product => {
        if (!product) res.status(404).send("not found Product");

        res.send(product);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Product(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(product => {
        if (!product) res.status(404).send("not found Product");
        else {
          res.send(product);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Product(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(product => {
        if (!product) res.status(404).send({ err: "No Encontrados" });

        res.send(product);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:productID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Product(currentMongoose).findByIdAndDelete(
      req.params.productID,
      (err, productDeleted) => {
        if (err) res.status(403).send(err);

        res.send(productDeleted);
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

    const product = new Product(currentMongoose)(req.body);
    product.createdBy = req.auth?.username || "";

    const resp = await product.save();
    res.send(resp);
  } catch (err) {
    res.status(403).send(err.errmsg);
  }
});

router.put("/:productID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedProduct = await Product(currentMongoose).findByIdAndUpdate(
      req.params.productID,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

router.post("/getNitProducts", function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    var onlineInvoice = new Sincronizacion({});
    onlineInvoice.getLista('ListaProductosServicios', currentMongoose, req.body, 'ListaProductos', 'listaCodigos').then(products => {
      res.send(products);
    }).catch(err => {
      res.status(403).send(err);
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
