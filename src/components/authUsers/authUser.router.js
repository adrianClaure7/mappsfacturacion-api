const express = require("./node_modules/express");
var AuthUser = require("./authAuthUsers.model");

let router = express.Router();

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
    const count = await AuthUser(currentMongoose).countDocuments(filter);

    // Fetch paginated data
    const data = await AuthUser(currentMongoose)
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


/* GET authUsers listing. */
router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    AuthUser(currentMongoose)
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

router.get("/active", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    AuthUser(currentMongoose)
      .find({ active: true })
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

router.get("/:authUserID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    AuthUser(currentMongoose)
      .findById(req.params.authUserID)
      .then(authUser => {
        if (!authUser) res.status(404).send("authUser Not found");

        res.json(authUser);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.get("/getUsernameById/:authUserID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    AuthUser(currentMongoose)
      .findById(req.params.authUserID)
      .then(authUser => {
        if (!authUser) res.status(404).send("authUser Not found");

        res.send(authUser.username);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    AuthUser(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(authUsers => {
        if (!authUsers) res.status(404).send("no encontrados");

        res.send(authUsers);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:authUserID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    AuthUser(currentMongoose).findByIdAndDelete(
      req.params.authUserID,
      (err, resp) => {
        if (err) res.status(404).send(err);

        res.send(resp);
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

    const authUser = new AuthUser(currentMongoose)(req.body);
    authUser.createdBy = req.authUser ? req.authUser.username : "";

    const savedUser = await authUser.save();
    res.json(savedUser);
  } catch (error) {
    console.error("Error saving authUser:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

router.put("/:authUserID", async (req, res) => {
  try {
    req.body.updatedBy = req.authUser ? req.authUser.username : "";
    req.body.updatedOn = new Date();

    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const updatedAuthUser = await AuthUser(currentMongoose).findByIdAndUpdate(
      req.params.authUserID,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedAuthUser) {
      return res.status(404).json({ error: "AuthUser not found" });
    }

    res.json(updatedAuthUser);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

router.post("/newPass", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json({ error: "Connection mongoose not found" });
    }

    const { searchCriteria, currentPass, newPass } = req.body;
    if (!searchCriteria || !currentPass || !newPass) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const authUser = await AuthUser(currentMongoose).findOne(searchCriteria);
    if (!authUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isSame = await authUser.comparePassword(currentPass);
    if (!isSame) {
      return res.status(403).json({ error: "Current password not valid" });
    }

    authUser.password = newPass;
    const updatedUser = await authUser.save();

    console.log("✅ Password Changed");
    res.json(updatedUser);
  } catch (error) {
    console.error("❌ Error updating password:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

module.exports = router;
