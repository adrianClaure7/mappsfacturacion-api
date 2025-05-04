const express = require("express");
const router = express.Router();
const GeneratedProduct = require("./generatedProduct.model");
const Utilities = require("../../commons/utilities");

// Helper function for pagination
const calculatePagination = (req) => {
  const limit = req.query ? parseInt(req.query.limit) || 20 : 20;
  const page = req.query ? parseInt(req.query.page) || 0 : 0;
  const skip = page * limit;
  const select = req.query ? (req.query.select !== "0" ? req.query.select : 0) : 0;
  return { limit, skip, select };
};

// Helper function for filters
const getFilterFromRequest = (req) => {
  if (req.body && req.body.commonFilters) {
    const filterString = `{${Utilities.prepareFilter(
      req.body.commonFilters.dateFilter,
      req.body.commonFilters.stringFilters,
      req.body.commonFilters.staticFilters
    )}}`;
    return JSON.parse(filterString);
  }
  return {};
};

router.post("/paginate", async (req, res) => {
  const { limit, skip, select } = calculatePagination(req);
  const filter = getFilterFromRequest(req);
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const count = await GeneratedProduct(currentMongoose).countDocuments(filter);
    const data = await GeneratedProduct(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ generatedProducts: data, pages: pages === 1 ? 0 : pages, total: count });
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/paginate", async (req, res) => {
  const { limit, skip, select } = calculatePagination(req);
  const filter = req.query && req.query.filter ? JSON.parse(req.query.filter) : {};
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const count = await GeneratedProduct(currentMongoose).countDocuments(filter);
    const data = await GeneratedProduct(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ generatedProducts: data, pages, total: count });
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const data = await GeneratedProduct(currentMongoose).find();
    res.json(data);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/:generatedProductID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const generatedProduct = await GeneratedProduct(currentMongoose).findById(req.params.generatedProductID);
    if (!generatedProduct) return res.status(404).send("Not found GeneratedProduct");
    res.json(generatedProduct);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getFirst", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const generatedProduct = await GeneratedProduct(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select);
    if (!generatedProduct) return res.status(404).send("Not found GeneratedProduct");
    res.json(generatedProduct);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getByCriteria", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const generatedProducts = await GeneratedProduct(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select);
    res.json(generatedProducts);
  } catch (err) {
    res.status(404).json({ err: "No Encontrados" });
  }
});

router.delete("/:generatedProductID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const generatedProductDeleted = await GeneratedProduct(currentMongoose).findByIdAndDelete(req.params.generatedProductID);
    res.json(generatedProductDeleted);
  } catch (err) {
    res.status(403).json(err);
  }
});

router.post("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  const generatedProduct = new GeneratedProduct(currentMongoose)(req.body);
  generatedProduct.createdBy = req.user ? req.user.username : "";

  try {
    const resp = await generatedProduct.save();
    res.json(resp);
  } catch (err) {
    res.status(403).json(err.errmsg);
  }
});

router.put("/:generatedProductID", async (req, res) => {
  req.body.updatedBy = req.user ? req.user.username : "";
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const updatedGeneratedProduct = await GeneratedProduct(currentMongoose).findByIdAndUpdate(
      req.params.generatedProductID,
      req.body,
      { new: true }
    );
    res.json(updatedGeneratedProduct);
  } catch (err) {
    res.status(404).json(err);
  }
});

module.exports = router;
