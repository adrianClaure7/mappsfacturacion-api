var express = require("express");
var router = express.Router();
var Counter = require("./counters.model");

router.get("/paginate/", async (req, res) => {
  try {
    // Parse query parameters with default values
    const limit = req.query?.limit ? parseInt(req.query.limit, 10) || 20 : 20;
    const page = req.query?.page ? parseInt(req.query.page, 10) || 0 : 0;
    const skip = page * limit;
    const select = req.query?.select && req.query.select !== "0" ? req.query.select : null;
    const filter = req.query?.filter ? JSON.parse(req.query.filter) : {};

    // Ensure a valid Mongoose connection
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(500).json({ error: "Mongoose connection not found" });
    }

    // Fetch total document count
    const count = await Counter(currentMongoose).countDocuments(filter);

    // Fetch paginated data
    const data = await Counter(currentMongoose)
      .find(filter)
      .skip(skip)
      .limit(limit)
      .select(select)
      .sort({ createdOn: -1 });

    // Calculate total pages (ensure no division by zero)
    const pages = limit > 0 ? Math.ceil(count / limit) : 0;

    // Return paginated results
    res.json({ authUsers: data, pages, total: count });

  } catch (err) {
    console.error("Error in /paginate route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});


router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Counter(currentMongoose)
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

router.get("/:counterID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Counter(currentMongoose)
      .findById(req.params.counterID)
      .then(counter => {
        if (!counter) res.status(404).send("not found Counter");

        res.send(counter);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Counter(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(counter => {
        res.send(counter || { counter: 0 });
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Counter(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(counter => {
        if (!counter) res.status(404).send({ err: "No Encontrados" });

        res.send(counter);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:counterID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    Counter(currentMongoose).findByIdAndDelete(
      req.params.counterID,
      (err, counterDeleted) => {
        if (err) res.status(403).send(err);

        res.send(counterDeleted);
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

    const counter = new Counter(currentMongoose)(req.body);
    counter.createdBy = req.auth ? req.auth.username : "";

    const savedCounter = await counter.save();
    res.json(savedCounter);
  } catch (error) {
    console.error("❌ Error saving counter:", error);
    res.status(403).json({ error: "Failed to save counter", details: error.message });
  }
});

router.put("/:counterID", async (req, res) => {
  try {
    req.body.updatedBy = req.auth ? req.auth.username : "";

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedCounter = await Counter(currentMongoose).findByIdAndUpdate(
      req.params.counterID,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedCounter) {
      return res.status(404).json({ error: "Counter not found" });
    }

    res.json(updatedCounter);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

module.exports = router;
