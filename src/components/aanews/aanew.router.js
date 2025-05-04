const express = require("express");
const router = express.Router();
const Aanew = require("./aanew.model");
const Utilities = require("./../../commons/utilities");

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
    const count = await Aanew(currentMongoose).countDocuments(filter);
    const data = await Aanew(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ aanews: data, pages: pages === 1 ? 0 : pages, total: count });
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
    const count = await Aanew(currentMongoose).countDocuments(filter);
    const data = await Aanew(currentMongoose)
      .find(filter)
      .skip(limit === -1 ? 0 : skip)
      .limit(limit === -1 ? 0 : limit)
      .select(select)
      .sort({ createdOn: -1 });
    const pages = Math.ceil(count / limit);
    res.json({ aanews: data, pages, total: count });
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const data = await Aanew(currentMongoose).find();
    res.json(data);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.get("/:aanewID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const aanew = await Aanew(currentMongoose).findById(req.params.aanewID);
    if (!aanew) return res.status(404).send("Not found Aanew");
    res.json(aanew);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getFirst", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const aanew = await Aanew(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select);
    if (!aanew) return res.status(404).send("Not found Aanew");
    res.json(aanew);
  } catch (err) {
    res.status(404).json(err);
  }
});

router.post("/getByCriteria", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const aanews = await Aanew(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select);
    res.json(aanews);
  } catch (err) {
    res.status(404).json({ err: "No Encontrados" });
  }
});

router.delete("/:aanewID", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  try {
    const aanewDeleted = await Aanew(currentMongoose).findByIdAndDelete(req.params.aanewID);
    res.json(aanewDeleted);
  } catch (err) {
    res.status(403).json(err);
  }
});

router.post("/", async (req, res) => {
  const currentMongoose = req.currentMongoose;

  if (!currentMongoose) return res.status(404).json("Connection mongoose not found");

  const aanew = new Aanew(currentMongoose)(req.body);
  aanew.createdBy = req.auth ? req.auth.username : "";

  try {
    const resp = await aanew.save();
    res.json(resp);
  } catch (err) {
    res.status(403).json(err.errmsg);
  }
});

router.put("/:aanewID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedAanew = await Aanew(currentMongoose).findByIdAndUpdate(
      req.params.aanewID,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedAanew) {
      return res.status(404).json({ error: "Aanew not found" });
    }

    res.json(updatedAanew);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

module.exports = router;
