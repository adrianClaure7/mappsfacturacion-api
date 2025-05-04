var express = require("express");
var router = express.Router();
var MailerConfig = require("./mailerConfig.model");
var Utilities = require("../../commons/utilities");

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
        const { dateFilter, stringFilters, staticFilters } = req.body.commonFilters;
        const stringJSONFilter = `{${Utilities.prepareFilter(dateFilter, stringFilters, staticFilters)}}`;
        filter = JSON.parse(stringJSONFilter);
      } catch (err) {
        return res.status(400).json({ error: "Invalid filter format", details: err.message });
      }
    }

    const [count, data] = await Promise.all([
      MailerConfig(currentMongoose).countDocuments(filter),
      MailerConfig(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ customerNITs: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      MailerConfig(currentMongoose).countDocuments(filter),
      MailerConfig(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ customerNITs: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.get("/first", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    var select = req.query ? (req.query.select != "0" ? req.query.select : 0) : 0;
    MailerConfig(currentMongoose)
      .findOne()
      .select(select)
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        res.status(404).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
})

router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MailerConfig(currentMongoose)
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

router.get("/:mailerConfigID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MailerConfig(currentMongoose)
      .findById(req.params.mailerConfigID)
      .then(mailerConfig => {
        if (!mailerConfig) res.status(404).send("not found MailerConfig");

        res.send(mailerConfig);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MailerConfig(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(mailerConfig => {
        if (!mailerConfig) res.status(404).send("not found MailerConfig");
        else {
          res.send(mailerConfig);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MailerConfig(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(mailerConfig => {
        if (!mailerConfig) res.status(404).send({ err: "No Encontrados" });

        res.send(mailerConfig);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:mailerConfigID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MailerConfig(currentMongoose).findByIdAndDelete(
      req.params.mailerConfigID,
      (err, mailerConfigDeleted) => {
        if (err) res.status(403).send(err);

        res.send(mailerConfigDeleted);
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

    const mailerConfig = new MailerConfig(currentMongoose)(req.body);
    mailerConfig.createdBy = req.auth ? req.auth.username : "";

    const savedMailerConfig = await mailerConfig.save();
    res.json(savedMailerConfig);
  } catch (error) {
    res.status(403).json({ error: "Failed to save MailerConfig", details: error.message });
  }
});

router.post("/update", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    req.body.data.updatedBy = req.auth ? req.auth.username : "";

    if (req.body.id) {
      try {
        const updatedMailerConfig = await MailerConfig(currentMongoose).findByIdAndUpdate(
          req.body.id,
          req.body.data,
          { new: true, upsert: true }
        );

        if (!updatedMailerConfig) {
          return res.status(404).json({ error: "MailerConfig not found" });
        }

        return res.json(updatedMailerConfig);
      } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
      }
    }

    const mailerConfig = new MailerConfig(currentMongoose)(req.body.data);
    mailerConfig.createdBy = req.auth ? req.auth.username : "";

    const savedMailerConfig = await mailerConfig.save();
    res.json(savedMailerConfig);

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

module.exports = router;
