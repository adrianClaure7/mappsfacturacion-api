const express = require("express");
const router = express.Router();
const ToGenerateInvoice = require("./toGenerateInvoice.model");
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
    const count = await ToGenerateInvoice(currentMongoose).countDocuments(filter);
    const data = await ToGenerateInvoice(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ toGenerateInvoices: data, pages: pages === 1 ? 0 : pages, total: count });
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
    const count = await ToGenerateInvoice(currentMongoose).countDocuments(filter);
    const data = await ToGenerateInvoice(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ toGenerateInvoices: data, pages, total: count });
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const data = await ToGenerateInvoice(currentMongoose).find();
    res.json(data);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/:toGenerateInvoiceID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const toGenerateInvoice = await ToGenerateInvoice(currentMongoose).findById(req.params.toGenerateInvoiceID);
    if (!toGenerateInvoice) return res.status(404).send("Not found ToGenerateInvoice");
    res.json(toGenerateInvoice);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getFirst", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const toGenerateInvoice = await ToGenerateInvoice(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select);
    if (!toGenerateInvoice) return res.status(404).send("Not found ToGenerateInvoice");
    res.json(toGenerateInvoice);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getByCriteria", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const toGenerateInvoices = await ToGenerateInvoice(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select);
    res.json(toGenerateInvoices);
  } catch (err) {
    res.status(404).json({ err: "No Encontrados" });
  }
});

router.delete("/:toGenerateInvoiceID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const toGenerateInvoiceDeleted = await ToGenerateInvoice(currentMongoose).findByIdAndDelete(req.params.toGenerateInvoiceID);
    res.json(toGenerateInvoiceDeleted);
  } catch (err) {
    res.status(403).json(err);
  }
});

router.post("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  const toGenerateInvoice = new ToGenerateInvoice(currentMongoose)(req.body);
  toGenerateInvoice.createdBy = req.auth ? req.auth.username : "";

  try {
    const resp = await toGenerateInvoice.save();
    res.json(resp);
  } catch (err) {
    res.status(403).json(err.errmsg);
  }
});

router.put("/:toGenerateInvoiceID", async (req, res) => {
  req.body.updatedBy = req.auth ? req.auth.username : "";
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const updatedToGenerateInvoice = await ToGenerateInvoice(currentMongoose).findByIdAndUpdate(
      req.params.toGenerateInvoiceID,
      req.body,
      { new: true }
    );
    res.json(updatedToGenerateInvoice);
  } catch (err) {
    res.status(404).json(err);
  }
});

module.exports = router;
