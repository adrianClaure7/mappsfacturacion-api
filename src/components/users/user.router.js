const express = require("express");
var User = require("./user.model");
var Utilities = require('../../commons/utilities');

let router = express.Router();
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
      User(currentMongoose).countDocuments(filter),
      User(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ users: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

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
      User(currentMongoose).countDocuments(filter),
      User(currentMongoose)
        .find(filter)
        .skip(limit > 0 ? skip : 0)
        .limit(limit > 0 ? limit : 0)
        .select(select)
        .sort({ createdOn: -1 })
    ]);

    res.json({ users: data, pages: limit > 0 ? Math.ceil(count / limit) : 0, total: count });

  } catch (err) {
    console.error("Error in /paginate/ GET route:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

router.post("/getFirst", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    User(currentMongoose)
      .findOne(req.body.searchCriteria)
      .select(req.body.select)
      .then(user => {
        if (!user) res.status(404).send("not found User");
        else {
          res.send(user);
        }
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});


/* GET users listing. */
router.get("/", function (req, res, next) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    User(currentMongoose)
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
    User(currentMongoose)
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

router.get("/:userID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    User(currentMongoose)
      .findById(req.params.userID)
      .then(user => {
        if (!user) res.status(404).send("user Not found");

        res.json(user);
      })
      .catch(err => {
        res.status(404).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.get("/getUsernameById/:userID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    User(currentMongoose)
      .findById(req.params.userID)
      .then(user => {
        if (!user) res.status(404).send("user Not found");

        res.send(user.username);
      })
      .catch(err => {
        res.status(404).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.post("/getByCriteria", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    User(currentMongoose)
      .find(req.body.searchCriteria)
      .select(req.body.select)
      .then(users => {
        if (!users) res.status(404).send("no encontrados");

        res.send(users);
      })
      .catch(err => {
        res.status(404).json(err);
      });
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.delete("/:userID", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose && req.auth) {
    User(currentMongoose)
      .deleteUser(
        req.params.userID,
        currentMongoose
      )
      .then(user => {
        res.send(user);
      })
      .catch(err => {
        res.status(404).send(err);
      });
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

    const user = new User(currentMongoose)(req.body);
    user.createdBy = req.auth?.username || "";

    const resp = await user.save();
    res.send(resp);
  } catch (err) {
    res.status(404).send(err);
  }
});

router.post("/register", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose && req.auth) {
    var user = new User(currentMongoose)(req.body);
    user.createdBy = req.auth.username;
    user.database = req.auth.database;
    user.expirationDate = req.auth.expirationDate;

    user.register(currentMongoose).then(newuser => {
      res.json(newuser);
    }).catch(err => {
      res.status(403).json(err)
    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

router.put("/:userID", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose || !req.auth) {
      return res.status(404).json({ error: "Connection mongoose not found or unauthorized request" });
    }

    const updatedUser = await User(currentMongoose).updateUser(
      req.body,
      req.auth.username,
      req.params.userID,
      currentMongoose
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found or update failed" });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

router.post("/newPass", async (req, res) => {
  try {
    const currentMongoose = req.currentMongoose;
    if (!currentMongoose) {
      return res.status(404).json("Connection mongoose not found");
    }

    const users = await User(currentMongoose).find(req.body.searchCriteria);
    if (!users.length) {
      return res.status(404).json("User not found");
    }

    const currentUser = new User(currentMongoose)(users[0]);
    const isSame = await currentUser.comparePassword(req.body.currentPass);

    if (!isSame) {
      return res.status(400).json("Current password not valid");
    }

    currentUser.password = req.body.newPass;
    const resp = await currentUser.save();

    console.log("Password Changed");
    res.send(resp);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  }
});

module.exports = router;
