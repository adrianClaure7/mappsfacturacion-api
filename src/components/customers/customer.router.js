var express = require("express");
var router = express.Router();
var Customer = require("./customer.model");
var Utilities = require("../../commons/utilities");
const User = require("../users/user.model");
const MerchantConfig = require("../merchantConfigs/merchantConfig.model");

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
      Customer(currentMongoose).countDocuments(filter),
      Customer(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ customers: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      Customer(currentMongoose).countDocuments(filter),
      Customer(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ customers: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Customer(currentMongoose)
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

router.get("/:customerID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Customer(currentMongoose)
      .findById(req.params.customerID)
      .then(customer => {
        if (!customer) res.status(404).send("not found Customer");

        res.send(customer);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Customer(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(customer => {
        if (!customer) res.status(404).send("not found Customer");
        else {
          res.send(customer);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Customer(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(customer => {
        if (!customer) res.status(404).send({ err: "No Encontrados" });

        res.send(customer);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:customerID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Customer(currentMongoose).findByIdAndDelete(
      req.params.customerID,
      (err, customerDeleted) => {
        if (err) res.status(403).send(err);

        res.send(customerDeleted);
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

    const customer = new Customer(currentMongoose)(req.body);
    customer.createdBy = req.auth ? req.auth.username : "";

    const savedCustomer = await customer.save();

    if (savedCustomer.hasUser) {
      try {
        const merchantConfig = await MerchantConfig(currentMongoose).findOne().select('merchantDatabase');
        savedCustomer.database = merchantConfig.merchantDatabase;
        const preparedUser = User(currentMongoose).prepareUserWithCustomer(savedCustomer);
        const user = new User(currentMongoose)(preparedUser);

        await user.register(currentMongoose);
        res.json(savedCustomer);
      } catch (error) {
        await Customer(currentMongoose).findByIdAndDelete(savedCustomer._id);
        res.status(403).json({ error: "No se pudo crear el usuario", details: error.message });
      }
    } else {
      res.json(savedCustomer);
    }
  } catch (error) {
    res.status(403).json({ error: "Failed to save Customer", details: error.message });
  }
});

router.put("/:customerID", async function (req, res) {
  req.body.updatedBy = req.auth ? req.auth.username : "";

  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    try {
      const updatedCustomer = await Customer(currentMongoose).findByIdAndUpdate(
        req.params.customerID,
        req.body,
        { new: true }
      );

      if (!updatedCustomer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(updatedCustomer);
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getCustomerNitNameByNit", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose && req.body.nit) {
    Customer(currentMongoose)
      .getCustomerNitNameByNit(currentMongoose, req.body.nit)
      .then(invoiceClient => {
        if (invoiceClient) {
          res.json(invoiceClient);
        } else {
          res.json({});
        }
      })
      .catch(err => {
        res.status(403).json(err);
      })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;
