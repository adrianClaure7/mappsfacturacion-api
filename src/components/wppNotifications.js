
const countryCodes = require('country-codes-list');
var moment = require("moment");
var LOCALIZATIONS = require('../commons/localizedNotifications');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);
const RecoverPassword = require('./recoverPasswords/recoverPassword.model');
const COMMON_STATUS = require("../commons/commonStatus");
const config = require('../../config/config');
const { reject } = require('q');
const WppMessage = require('./wppMessages/wppMessage.model');
const MerchantConfig = require('./merchantConfigs/merchantConfig.model');
const REMINDER_TYPES = require("./../commons/reminderTypes");

class WppNotifications {
    constructor(currentMongoose = undefined, createdBy = '') {
        this.currentMongoose = currentMongoose;
        this.createdBy = createdBy;
    }

    sendReminderTypeMessage(data) {
        var text = '';
        switch (data.reminderType) {
            case REMINDER_TYPES.PAYMENT_DAY.code:
                text = LOCALIZATIONS[REMINDER_TYPES.PAYMENT_DAY.localizedCode][LOCALIZATIONS.localeES]
                    .replace('{{1}}', data.name)
                    .replace('{{2}}', data.details)
                    .replace('{{3}}', data.amount)
                    .replace('{{4}}', moment(data.time).format('DD-MM HH:MM'))

                text += `${config.APP_URL}/customer/payments/upsert;orderId=${data.orderId}`;
                this.sendWppByUser({ phone: data.phone, iso2: data.iso2 }, text);
                break;

            case REMINDER_TYPES.BEFORE_PAYMENT.code:
                text = LOCALIZATIONS[REMINDER_TYPES.BEFORE_PAYMENT.localizedCode][LOCALIZATIONS.localeES]
                    .replace('{{1}}', data.name)
                    .replace('{{2}}', data.details)
                    .replace('{{3}}', data.amount)
                    .replace('{{4}}', moment(data.time).format('DD-MM HH:MM'));

                text += `${config.APP_URL}/customer/payments/upsert;orderId=${data.orderId}}`;
                this.sendWppByUser({ phone: data.phone, iso2: data.iso2 }, text);
                break;

            case REMINDER_TYPES.AFTER_PAYMENT.code:
                text = LOCALIZATIONS[REMINDER_TYPES.AFTER_PAYMENT.localizedCode][LOCALIZATIONS.localeES]
                    .replace('{{1}}', data.name)
                    .replace('{{2}}', data.details)
                    .replace('{{3}}', data.amount)
                    .replace('{{4}}', moment(data.time).format('DD-MM HH:MM'))
                    .replace('{{5}}', moment(data.limitTime).format('DD-MM HH:MM'));

                text += `${config.APP_URL}/customer/payments/upsert;orderId=${data.orderId}}`;
                this.sendWppByUser({ phone: data.phone, iso2: data.iso2 }, text);
                break;

            case REMINDER_TYPES.LIMIT_PAYMENT.code:
                text = LOCALIZATIONS[REMINDER_TYPES.LIMIT_PAYMENT.localizedCode][LOCALIZATIONS.localeES]
                    .replace('{{1}}', data.name)
                    .replace('{{2}}', data.clientCode)
                    .replace('{{3}}', data.details)
                    .replace('{{4}}', data.amount)
                    .replace('{{5}}', moment(data.time).format('DD-MM HH:MM'))
                    .replace('{{6}}', moment(data.limitTime).format('DD-MM HH:MM'));

                text += `${config.APP_URL}/admin/orders;clientCode=${data.clientCode}`;
                data.users.forEach(user => {
                    this.sendWppByUser({ phone: user.phone, iso2: user.iso2 }, text);
                });
                break;

            default:
                break;
        }
    }

    sendCreatedUserMessage(mongoseeConnections, config, user) {
        if (this.isValidPhone(user.phone)) {
            const url = `${config.MONGODB_URL}${config.AUTHUSER_DB}?authSource=admin`;
            mongoseeConnections(url, config.AUTHUSER_DB)
                .getConnection()
                .then(authMongoose => {
                    RecoverPassword(authMongoose).findOne({ username: user.username }).select('_id').then(async (foundRecoverPassword) => {
                        if (!foundRecoverPassword) {
                            var recoverPassword = new RecoverPassword(authMongoose)({ username: user.username, phone: user.phone, iso2: user.iso2 });

                            try {
                                const recoverPass = await recoverPassword.save();

                                const text = LOCALIZATIONS['createdUser'][LOCALIZATIONS.localeES]
                                    .replace('{0}', user.username) +
                                    ` ${config.APP_URL}/login/recover-password/${recoverPass._id}`;

                                await this.sendWppByUser(user, text);
                            } catch (error) {
                                console.error("Error saving recoverPassword:", error);
                            }
                        } else {
                            var text = LOCALIZATIONS['createdUser'][LOCALIZATIONS.localeES].replace('{0}', user.username) + ` ${config.APP_URL}/login/recover-password/${foundRecoverPassword._id}`;
                            this.sendWppByUser(user, text);
                        }
                    }).catch(err => {
                        reject(err);
                    })
                });
        }
    }

    sendConfirmPayNotifications(notification, user) {
        // TODO: Improve message of reccurent pays
        var text = LOCALIZATIONS['confirm_pay'][LOCALIZATIONS.localeES].replace('{{1}}', `Pago realizado(${notification.appointmentName})`).replace('{{2}}', `${notification.totalAmount}${notification.currency}`).replace('{{3}}', 'Recurrente');
        text += `${config.APP_URL}/customer/payments`;
        this.sendWppByUser(user, text);
    }

    sendNotifications(notification, users) {
        users.forEach(user => {
            var text = LOCALIZATIONS['notification'][LOCALIZATIONS.localeES].replace('{0}', notification.code).replace('{1}', notification.description).replace('{2}', notification.notificationType);
            if (notification.houseCode) {
                text += LOCALIZATIONS['notification2'][LOCALIZATIONS.localeES].replace('{0}', notification.houseCode);
            }
            text += ` \n${config.APP_URL}/house/notifications`;
            this.sendWppByUser(user, text);
        });
    }

    isValidPhone(phone, val = 6) {
        return phone.toString().length > val;
    }

    getMessageWppBySid(wppSid) {
        return new Promise((resolve, reject) => {
            client
                .messages(wppSid)
                .fetch()
                .then(message => {
                    resolve(message)
                })
                .catch(e => {
                    reject({ error: `Tengo un error: ${e.code} -> ${e.message}` });
                });
        });
    }

    sendWppByUser(user, text) {
        if (this.isValidPhone(user.phone) && user.iso2) {
            var countryCodeList = countryCodes.customList('countryCode', '+{countryCallingCode}');
            var toPhone = `${countryCodeList[user.iso2.toUpperCase()]}${user.phone}`;

            this.sendWpp(text, process.env.TWILIO_PHONE_NUMBER, `whatsapp:${toPhone}`);
        } else if (this.isValidPhone(user.phone)) {
            this.sendWpp(text, process.env.TWILIO_PHONE_NUMBER, `whatsapp:+591${user.phone}`);
        }
    }

    sendWpp(text, from, to) {
        var that = this;

        if (this.currentMongoose) {
            MerchantConfig(this.currentMongoose).findOne().select('allowWppNotifications').then(merchantConfig => {
                if (merchantConfig.allowWppNotifications) {
                    client.messages
                        .create({
                            body: text,
                            from: from,
                            to: to
                        })
                        .then(message => {
                            if (that.currentMongoose && message.sid) {
                                var wppMessage = new WppMessage(that.currentMongoose)({ sid: message.sid, createdBy: that.createdBy });
                                wppMessage.save()
                            } else {
                                console.log(message.sid)
                            }
                        })
                        .done();
                    console.log('ENVIADO')
                }
            }).catch(err => {
                console.log(err);
            })
        } else {
            client.messages
                .create({
                    body: text,
                    from: from,
                    to: to
                })
                .then(message => {
                })
                .done();
            console.log('ENVIADO')
        }
    }
}

module.exports = WppNotifications;
