const nodemailer = require("nodemailer");
const MerchantConfig = require("./merchantConfigs/merchantConfig.model");
const MongooseConnectionHandler = require("./../middlewares/mongooseConnectionHandler");
const ConnectionHandler = new MongooseConnectionHandler();
const MailerConfig = require("./mailerConfigs/mailerConfig.model");
const logger = require("../commons/logger");

class Mailer {
  constructor() { }

  async sendEmitedInvoice(currentMongoose, emitedInvoice, merchantConfigData = undefined) {
    try {
      const merchantConfig = merchantConfigData || await MerchantConfig(currentMongoose)
        .findOne()
        .select("email businessName imgUrl phone iso2");

      const mailOptions = {
        from: "mappsbo2@gmail.com", // sender address
        to: emitedInvoice.emailToSend, // list of receivers
        subject: `${merchantConfig.businessName}: Notificación de emisión de factura`, // Subject line
        html: `
              <div style="font-family:'Open Sans',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#757575;line-height:150%;letter-spacing:normal">
                  <div padding:50px 10px">
                      <div style="max-width:600px;margin:auto">
                          <div style="background:#fff;padding:15px 30px 25px 30px;border-radius:5px">
                              <div style="margin:20px 0 30px">
                                <h3>Nueva Factura Emitida</h3>
                                <p>
                                Estimad@(s) ${emitedInvoice.nombreRazonSocial}, gracias por usar los servicios que <b>${merchantConfig.businessName}</b> pone a tu disposición, adjuntamos la factura correspondiente a tu transacción financiera.
                                
                                Si tienes alguna consulta respecto a tus facturas, por favor envía un correo a ${merchantConfig.email}.
                                
                                </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              `,
        attachments: [],
      };

      if (emitedInvoice.pdfBase64 || emitedInvoice.FacturaPDF) {
        mailOptions.attachments.push({
          filename: `${emitedInvoice.id || emitedInvoice._id}.pdf`,
          content: emitedInvoice.pdfBase64 || emitedInvoice.FacturaPDF,
          encoding: "base64",
        });
      }

      if (emitedInvoice.xmlData || emitedInvoice.FacturaXML) {
        mailOptions.attachments.push({
          filename: `${emitedInvoice.id || emitedInvoice._id}.xml`,
          content: emitedInvoice.xmlData || emitedInvoice.FacturaXML,
        });
      }

      const info = await this.transporterSendMail(mailOptions);
      return info;
    } catch (err) {
      logger.warn('[sendEmitedInvoice] Error: ', err);
      console.log('[sendEmitedInvoice] Error: ', err);
      // throw new Error(err.message);
    }
  }

  async transporterSendMail(mailOptions) {
    try {
      const superMongoose = await ConnectionHandler.getSuperAdminConnection();
      const mailerConfig = await MailerConfig(superMongoose).findOne();

      if (!mailerConfig) {
        // throw new Error("No existe la configuración de email");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: "mappsbo2@gmail.com",
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        }
      });

      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (err) {
      logger.warn('[transporterSendMail] Error: ', err);
      console.log('[transporterSendMail] Error: ', err);
      // throw new Error(err.message);
    }
  }

  async sendCancelEmitedInvoice(currentMongoose, emitedInvoice) {
    try {
      const merchantConfig = await MerchantConfig(currentMongoose)
        .findOne()
        .select("email businessName imgUrl phone iso2");

      const mailOptions = {
        from: "facturatelocompro@gmail.com", // sender address
        to: emitedInvoice.emailToSend, // list of receivers
        subject: `${merchantConfig.businessName}: Notificación de factura anulada`, // Subject line
        html: `
              <div style="font-family:'Open Sans',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#757575;line-height:150%;letter-spacing:normal">
                  <div padding:50px 10px">
                      <div style="max-width:600px;margin:auto">
                          <div style="background:#fff;padding:15px 30px 25px 30px;border-radius:5px">
                              <div style="margin:20px 0 30px">
                                <h3>Factura Anulada</h3>
                                <p>
                                Estimad@(s) ${emitedInvoice.nombreRazonSocial}, la factura Nro ${emitedInvoice.numeroFactura} fue anulada correctamente.
                                </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              `,
        attachments: [
          {
            filename: `${emitedInvoice.id || emitedInvoice._id}.pdf`,
            content: emitedInvoice.pdfBase64,
            encoding: "base64",
          },
        ],
      };

      const info = await this.transporterSendMail(mailOptions);
      return info;
    } catch (err) {
      logger.warn('[sendCancelEmitedInvoice] Error: ', err);
      console.log('[sendCancelEmitedInvoice] Error: ', err);
      // throw new Error(err.message);
    }
  }
}

module.exports = Mailer;
