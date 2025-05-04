const express = require("express");
const router = express.Router();
const Order = require("./order.model");
const Utilities = require("./../../commons/utilities");
const MongooseConnectionHandler = require("./../../middlewares/mongooseConnectionHandler");
const ConnectionHandler = new MongooseConnectionHandler();
const COMPARATION_OPERATORS = require("../../commons/comparationOperators");

router.post("/paginate/", async (req, res) => {
  try {
    const limit = req.query ? parseInt(req.query.limit) || 20 : 20;
    const page = req.query ? parseInt(req.query.page) || 0 * limit : 0;
    const skip = page * limit;
    const select = req.query ? (req.query.select != "0" ? req.query.select : 0) : 0;
    const currentMongoose = req.currentMongoose;
    let filter = {};

    if (req.body?.commonFilters) {
      if (req.auth?.customerCode) {
        req.body.commonFilters.staticFilters = req.body.commonFilters.staticFilters || [];
        if (!req.body.commonFilters.staticFilters.some(x => x.field === '_id')) {
          req.body.commonFilters.staticFilters.push({ field: 'clientCode', value: req.auth.customerCode, operator: COMPARATION_OPERATORS.EQUAL.value });
        }
      }

      const stringJSONFilter = `{${Utilities.prepareFilter(req.body.commonFilters.dateFilter, req.body.commonFilters.stringFilters, req.body.commonFilters.staticFilters)}}`;
      filter = JSON.parse(stringJSONFilter);
    } else if (req.auth?.customerCode) {
      req.body = { commonFilters: { staticFilters: [{ field: 'clientCode', value: req.auth.customerCode, operator: COMPARATION_OPERATORS.EQUAL.value }] } };
      const stringJSONFilter = `{${Utilities.prepareFilter(req.body.commonFilters.dateFilter, req.body.commonFilters.stringFilters, req.body.commonFilters.staticFilters)}}`;
      filter = JSON.parse(stringJSONFilter);
    }

    if (currentMongoose) {
      const count = await Order(currentMongoose).countDocuments(filter);
      const orders = await Order(currentMongoose)
        .find(filter)
        .skip(limit === -1 ? "" : skip)
        .limit(limit === -1 ? "" : limit)
        .select(select)
        .sort({ createdOn: -1 });

      const pages = Math.ceil(count / limit);
      res.json({ orders, pages: pages === 1 ? 0 : pages, total: count });
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/paginate/", async (req, res) => {
  try {
    const limit = req.query ? parseInt(req.query.limit) || 20 : 20;
    const page = req.query ? parseInt(req.query.page) || 0 * limit : 0;
    const skip = page * limit;
    const select = req.query ? (req.query.select != "0" ? req.query.select : 0) : 0;
    const filter = req.query?.filter ? JSON.parse(req.query.filter) : {};
    const currentMongoose = req.currentMongoose;

    if (currentMongoose) {
      const count = await Order(currentMongoose).countDocuments({});
      const orders = await Order(currentMongoose)
        .find(filter)
        .skip(limit === -1 ? "" : skip)
        .limit(limit === -1 ? "" : limit)
        .select(select)
        .sort({ createdOn: -1 });

      const pages = Math.ceil(count / limit);
      res.json({ orders, pages, total: count });
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const data = await Order(currentMongoose).find();
      res.json(data);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/:orderID", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const order = await Order(currentMongoose).findById(req.params.orderID);
      if (!order) res.status(404).send("Order not found");
      res.send(order);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getFirst", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const order = await Order(currentMongoose)
        .findOne(req.body.searchCriteria)
        .select(req.body.select);
      if (!order) res.status(404).send("Order not found");
      else res.send(order);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getByCriteria", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const orders = await Order(currentMongoose)
        .find(req.body.searchCriteria)
        .select(req.body.select);
      if (!orders) res.status(404).send({ err: "No Orders Found" });
      res.send(orders);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).json(err);
  }
});

router.delete("/:orderID", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const orderDeleted = await Order(currentMongoose).findByIdAndDelete(req.params.orderID);
      res.send(orderDeleted);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(403).send(err);
  }
});

router.post("/newOrder", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const order = new Order(currentMongoose)(req.body);
      order.createdBy = req.auth ? req.auth.username : "";
      const createdOrder = await order.createOrder();
      res.send(createdOrder);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(403).send(err);
  }
});

router.post("/create", async (req, res) => {
  try {
    const data = req.body;
    if (data.merchantCode) {
      const currentMongoose = await ConnectionHandler.getConnectionByMerchantCode(data.merchantCode);
      if (currentMongoose) {
        const order = new Order(currentMongoose)(req.body);
        order.createdBy = req.auth ? req.auth.username : "";
        const token = await order.create(currentMongoose);
        res.send(token);
      } else {
        res.status(403).send({ error: 'Invalid data' });
      }
    } else {
      res.status(403).send({ error: 'Invalid data' });
    }
  } catch (error) {
    res.status(403).send(error);
  }
});

router.post("/createTransitoryOrder", async (req, res) => {
  try {
    const data = req.body;
    if (data.merchantCode) {
      const currentMongoose = await ConnectionHandler.getConnectionByMerchantCode(data.merchantCode);
      if (currentMongoose) {
        const order = new Order(currentMongoose)(req.body);
        order.createdBy = req.auth ? req.auth.username : "";
        const token = await order.createTransitoryOrder(currentMongoose);
        res.send(token);
      } else {
        res.status(403).send({ error: 'Invalid data' });
      }
    } else {
      res.status(403).send({ error: 'Invalid data' });
    }
  } catch (error) {
    res.status(403).send(error);
  }
});

router.post("/generateJwt", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const token = await Order(currentMongoose).generateJwt(currentMongoose, req.body);
      res.send(token);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(403).send(err);
  }
});

router.put("/:orderID", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const order = await Order(currentMongoose).findByIdAndUpdate(req.params.orderID, req.body, { new: true });
      res.send(order);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(404).send(err);
  }
});

router.post("/getOrdersByIds", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (currentMongoose) {
      const orders = await Order(currentMongoose).find({ _id: { $in: req.body.orderIds } });
      res.send(orders);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(403).send(err);
  }
});


router.post("/deleteMany", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    const orderIds = req.body.orderIds;
    if (currentMongoose && orderIds) {
      const orders = await Order(currentMongoose).deleteMany({ _id: { $in: orderIds } });
      res.send(orders);
    } else {
      res.status(404).json("Connection mongoose not found");
    }
  } catch (err) {
    res.status(403).send(err);
  }
});

module.exports = router;
