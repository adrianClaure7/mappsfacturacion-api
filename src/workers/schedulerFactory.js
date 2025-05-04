const CronJob = require('cron').CronJob;
const Utilities = require('../commons/utilities');
const notificationsWorker = require("./notificationWorkerFactory");
const moment = require('moment-timezone');

const timeZone = 'America/La_Paz';

const calculateCronExpression = (hour, minute, timeZone) => {
    // Get the current moment in the specified time zone
    const currentTime = moment().tz(timeZone);

    // Extract the current hour and minute
    const currentHour = currentTime.hour();
    const currentMinute = currentTime.minute();

    // Calculate the difference in minutes between the desired time and the current time
    const minuteDifference = minute - currentMinute;

    // Calculate the difference in hours, considering any overflow from minutes
    let hourDifference = hour - currentHour + Math.ceil(minuteDifference / 60);

    // Ensure the calculated hour is within the valid range (0-23)
    hourDifference = (hourDifference + 24) % 24;

    // Calculate the cron expression
    const cronHour = (currentHour + hourDifference) % 24;

    // Calculate the cron expression for minute
    const cronMinute = (currentMinute + minuteDifference + 60) % 60;

    const cronExpression = `${cronMinute} ${cronHour} * * *`;

    return cronExpression;
};

const cronExpression = '0 0 * * *';

const schedulerFactory = function () {
    return {
        startCUFD: function (currentMongoose) {
            // PRODUCTION
            new CronJob(cronExpression, function () {
                console.log('Running Generate CUFD to subsidiaries ' +
                    moment().format());
                notificationsWorker.runCUFDGenerate(currentMongoose);
            }, null, true, '');
        },
        validateOrderGenerators: function (currentMongoose) {
            console.log('Running validateOrderGenerators and validateToGenerateInvoices Jobs');
            // PRODUCTION
            new CronJob('* * * * *', function () {
                try {
                    notificationsWorker.validateOrderGenerators(currentMongoose);
                } catch (err) {
                    console.error("[validateOrderGenerators] Error: ", err);
                }
                setTimeout(() => {
                    try {
                        notificationsWorker.validateToGenerateInvoices(currentMongoose);
                    } catch (err) {
                        console.error("[validateOrderGenerators] Error: ", err);
                    }
                }, Utilities.getRandomNumber(0, 15000))

                setTimeout(() => {
                    try {
                        notificationsWorker.validateToGenerateInvoices(currentMongoose);
                    } catch (err) {
                        console.error("[validateOrderGenerators] Error: ", err);
                    }
                }, Utilities.getRandomNumber(20000, 35000))

                setTimeout(() => {
                    try {
                        notificationsWorker.validateToGenerateInvoices(currentMongoose);
                    } catch (err) {
                        console.error("[validateOrderGenerators] Error: ", err);
                    }
                }, Utilities.getRandomNumber(40000, 55000))
            }, null, true, '');
        },
    };
};

module.exports = schedulerFactory();