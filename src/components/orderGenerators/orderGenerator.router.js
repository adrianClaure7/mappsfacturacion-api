const express = require("express");
const router = express.Router();
const OrderGenerator = require("./orderGenerator.model");
const Utilities = require("../../commons/utilities");

const calculatePagination = (req) => {
  const limit = req.query ? parseInt(req.query.limit) || 20 : 20;
  const page = req.query ? parseInt(req.query.page) || 0 : 0;
  const skip = page * limit;
  const select = req.query ? (req.query.select !== "0" ? req.query.select : 0) : 0;
  return { limit, skip, select };
};

const getFilterFromRequest = (req) => {
  if (req.body && req.body.commonFilters) {
    const stringJSONFilter = `{${Utilities.prepareFilter(
      req.body.commonFilters.dateFilter,
      req.body.commonFilters.stringFilters,
      req.body.commonFilters.staticFilters
    )}}`;
    return JSON.parse(stringJSONFilter);
  }
  return {};
};

router.post("/paginate", async (req, res) => {
  const { limit, skip, select } = calculatePagination(req);
  const filter = getFilterFromRequest(req);
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const count = await OrderGenerator(currentMongoose).countDocuments(filter);
    const data = await OrderGenerator(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ orderGenerators: data, pages: pages === 1 ? 0 : pages, total: count });
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/paginate", async (req, res) => {
  const { limit, skip, select } = calculatePagination(req);
  const filter = req.query && req.query.filter ? JSON.parse(req.query.filter) : {};
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const count = await OrderGenerator(currentMongoose).countDocuments(filter);
    const data = await OrderGenerator(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ orderGenerators: data, pages, total: count });
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const data = await OrderGenerator(currentMongoose).find();
    res.json(data);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/:orderGeneratorID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const orderGenerator = await OrderGenerator(currentMongoose).findById(req.params.orderGeneratorID);
    if (!orderGenerator) {
      return res.status(404).send("not found OrderGenerator");
    }
    res.json(orderGenerator);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getFirst", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const orderGenerator = await OrderGenerator(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select);
    if (!orderGenerator) {
      return res.status(404).send("not found OrderGenerator");
    }
    res.json(orderGenerator);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getByCriteria", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const orderGenerators = await OrderGenerator(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select);
    res.json(orderGenerators);
  } catch (err) {
    res.status(404).json({ err: "No Encontrados" });
  }
});

router.delete("/:orderGeneratorID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const orderGeneratorDeleted = await OrderGenerator(currentMongoose).deleteOrderGenerator(currentMongoose, req.params.orderGeneratorID);
    res.json(orderGeneratorDeleted);
  } catch (err) {
    res.status(403).json(err);
  }
});

router.post("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }
  try {
    const resp = await OrderGenerator(currentMongoose).create(currentMongoose, req.body);
    res.json(resp);
  } catch (err) {
    res.status(403).json(err.errmsg);
  }
});

router.put("/:orderGeneratorID", async (req, res) => {
  req.body.updatedBy = req.user ? req.user.username : "";
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) {
    return res.status(404).json("Connection mongoose not found");
  }

  try {
    const resp = await OrderGenerator(currentMongoose).updateOrderGenerator(currentMongoose, req.params.orderGeneratorID, req.body);
    res.json(resp);
  } catch (err) {
    res.status(404).json(err);
  }
});

module.exports = router;
