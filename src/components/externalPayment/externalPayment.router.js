var express = require("express");
var router = express.Router();
var Utilities = require("./../../commons/utilities");
const MerchantConfig = require("../merchantConfigs/merchantConfig.model");

const Order = require("../orders/order.model");

router.post("/getMerchantInfoByExternalToken", function (req, res) {
  var currentMongoose = req.currentMongoose;
  if (currentMongoose) {
    MerchantConfig(currentMongoose).findOne().select('businessName imgUrl imgRouteName facturacion paymentInfo').then(merchantConfig => {
      const data = {
        merchantConfig
      }
      Order(currentMongoose).findById(req.body.orderId).then(order => {
        data.order = order
        res.send(data);
      }).catch(err => {
        res.send(data);
      });

    })
  } else {
    res.status(404).json("Connection mongoose not found");
  }
});

module.exports = router;