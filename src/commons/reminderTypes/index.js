module.exports = Object.freeze({
  PAYMENT_DAY: {
    code: 'paymentDay',
    text: 'Dia de pago',
    localizedCode: 'pay_reminder_0'
  },
  BEFORE_PAYMENT: {
    code: 'beforePaymentDay',
    text: 'Dias antes del Pago',
    localizedCode: 'pay_reminder_1'
  },
  AFTER_PAYMENT: {
    code: 'afterPaymentDay',
    text: 'Dias despues del Pago',
    localizedCode: 'pay_reminder_2'
  },
  LIMIT_PAYMENT: {
    code: 'limitPaymentDay',
    text: 'Alerta limite de Pago Superado',
    toAdmin: true,
    localizedCode: 'pay_reminder_3'
  }
});
