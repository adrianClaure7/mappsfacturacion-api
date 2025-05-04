// grab the things we need
var mongoose = require("mongoose");

var Schema = mongoose.Schema;
var COMMON_STATUS = require('../../commons/commonStatus');
const moment = require('moment-timezone');
const Order = require("../orders/order.model");
var COMMON_CURRENCY_TYPES = require('../../commons/commonCurrencyTypes');
const REMINDER_TYPES = require("./../../commons/reminderTypes");
const WppNotifications = require("../wppNotifications");
const Utilities = require("../../commons/utilities");
const User = require("../users/user.model");

// create a schema
var ReminderSchema = new Schema({
  reminderId: String,
  orderId: String,
  name: { type: String, required: true },
  description: String,
  sendWpp: {
    type: Boolean,
    default: true
  },
  sendEmail: {
    type: Boolean,
    default: false
  },
  iso2: { type: String, required: true },
  phone: { type: Number, required: true },
  email: String,
  notification: Number,
  timeZone: String,
  time: { type: Date, index: true, required: true },
  reminders: [
    {
      name: { type: String },
      time: { type: Date, index: true },
      reminderType: { type: String },
      active: { type: Boolean }
    }
  ],
  status: {
    type: String,
    default: COMMON_STATUS.PENDING
  },
  createdBy: { type: String },
  updatedBy: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now }
});

ReminderSchema.pre("save", function (next) {
  var reminder = this;

  if (!reminder.isNew) reminder.updatedOn = new Date();

  next();
});


ReminderSchema.methods.requiresNotification = function (date, timeZone = '240') {
  var time = Math.round(moment.duration(moment(this.time).tz(this.timeZone || timeZone).utc()
    .diff(moment(date).utc())
  ).asMinutes())
  return time === this.notification;
};

ReminderSchema.statics.requiresNotification = function (reminder, date) {
  var time = Math.round(moment.duration(moment(reminder.time).tz(reminder.timeZone || reminder.reminder.timeZone).utc()
    .diff(moment(date).utc())
  ).asMinutes())
  return time === reminder.reminder.notification;
};

ReminderSchema.statics.sendNotifications = function (currentMongoose) {
  var that = this;

  return new Promise((resolve, reject) => {
    const searchDate = moment().toDate();
    var date10ago = moment().add(-10, 'minutes').toDate();
    var date10next = moment().add(10, 'minutes').toDate();

    that
      .find({ $or: [{ time: { $gte: date10ago, $lte: date10next } }, { 'reminders.time': { $gte: date10ago, $lte: date10next } }], status: COMMON_STATUS.PENDING })
      .then(function (foundReminders) {
        var reminders = foundReminders.filter(function (reminder) {
          return reminder.requiresNotification(searchDate);
        });
        if (reminders.length > 0) {
          that.toDoReminder(reminders, currentMongoose);
        } else {
          var remindersInReminders = [];
          foundReminders.forEach(reminder => {
            var preparedReminders = [];
            reminder.reminders.forEach(reminderChild => {
              reminderChild.reminder = reminder;
              preparedReminders.push(reminderChild);
            })
            if (preparedReminders.length > 0) {
              remindersInReminders.push(...preparedReminders)
            }
          });
          reminders = remindersInReminders.filter(function (reminder) {
            return that.requiresNotification(reminder, searchDate);
          });
          if (reminders.length > 0) {
            that.toDoReminderReminders(reminders, currentMongoose);
          }
        }
        resolve()
      }).catch(err => {
        reject(err)
      })
  });
};

ReminderSchema.statics.toDoReminder = function (reminders, currentMongoose) {
  var that = this;

  if (reminders) {
    reminders.forEach(reminder => {
      if (reminder.sendWpp) {
        // TODO
        that.prepareReminderWppNotification(reminder, currentMongoose).then((data) => {
          var wppNotification = new WppNotifications(currentMongoose, 'admin');
          wppNotification.sendReminderTypeMessage(data);
        }).catch(err => {
        })
      }
    })
  }
}

ReminderSchema.statics.toDoReminderReminders = function (reminders, currentMongoose) {
  var that = this;

  if (reminders) {
    reminders.forEach(reminder => {
      if (reminder.reminder.sendWpp) {
        // TODO
        that.prepareReminderRemindersWppNotification(reminder, currentMongoose).then((data) => {
          var wppNotification = new WppNotifications(currentMongoose, 'admin');
          wppNotification.sendReminderTypeMessage(data);
        }).catch(err => {

        })
      }
    })
  }
}

ReminderSchema.statics.prepareReminderWppNotification = function (reminder, currentMongoose) {
  var that = this;

  return new Promise((resolve, reject) => {
    if (reminder && reminder.orderId) {
      var data = {
        time: reminder.time,
        name: reminder.name,
        phone: reminder.phone,
        iso2: reminder.iso2,
        reminderType: REMINDER_TYPES.PAYMENT_DAY.code,
        details: 'Hoy cumple el Plazo de pago',
        time: reminder.time,
      }
      Order(currentMongoose).findById(reminder.orderId).then((order) => {
        if (order) {
          var currencyTypes = [COMMON_CURRENCY_TYPES.BOB, COMMON_CURRENCY_TYPES.US];
          var currentCurrency = currencyTypes.find(x => x.code == order.currency);
          var currentSymbol = currentCurrency ? currentCurrency.symbol : COMMON_CURRENCY_TYPES.BOB.symbol
          data.amount = `${Utilities.convertToFloat2(order.amount)} ${currentSymbol}`;
          data.clientCode = order.clientCode;
          data.orderId = reminder.orderId;
        }
        resolve(data);
      }).catch(err => {
        reject(err)
      })
    } else {
      reject({ error: 'Invalid orderId' })
    }
  })
}


ReminderSchema.statics.prepareReminderRemindersWppNotification = function (reminder, currentMongoose) {
  var that = this;

  return new Promise((resolve, reject) => {
    if (reminder && reminder.reminder && reminder.reminder.orderId) {
      var data = {
        time: reminder.reminder.time,
        name: reminder.name,
        phone: reminder.reminder.phone,
        iso2: reminder.reminder.iso2,
        reminderType: reminder.reminderType
      }
      switch (reminder.reminderType) {
        case REMINDER_TYPES.BEFORE_PAYMENT.code:
          data.details = 'Pago Proximo';
          break;

        case REMINDER_TYPES.AFTER_PAYMENT.code:
          data.details = 'Ultimo recordatorio de pago';
          data.time = reminder.reminder.time;
          data.limitTime = reminder.time;
          break;

        case REMINDER_TYPES.LIMIT_PAYMENT.code:
          data.details = 'No realizo el pago';
          data.limitTime = reminder.time;
          break;

        default:
          break;
      }
      User(currentMongoose).getUsersToSendAdminReminderByReminderType(reminder.reminderType).then(users => {
        if (users && users.length > 0) {
          data.users = users
        }
        Order(currentMongoose).findById(reminder.reminder.orderId).then((order) => {
          if (order) {
            var currencyTypes = [COMMON_CURRENCY_TYPES.BOB, COMMON_CURRENCY_TYPES.US];
            var currentCurrency = currencyTypes.find(x => x.code == order.currency);
            var currentSymbol = currentCurrency ? currentCurrency.symbol : COMMON_CURRENCY_TYPES.BOB.symbol
            data.amount = `${Utilities.convertToFloat2(order.amount)} ${currentSymbol}`;
            data.clientCode = order.clientCode;
            data.orderId = reminder.reminder.orderId;
          }
          resolve(data);
        }).catch(err => {
          reject(err)
        })
      })
    } else {
      reject({ error: 'Invalid orderId' })
    }
  })
}

// the schema is useless so far
// we need to create a model using it
var Reminder = function (mongooseCon) {
  return mongooseCon.model("Reminder", ReminderSchema);
};
// make this available to our users in our Node applications
module.exports = Reminder;
