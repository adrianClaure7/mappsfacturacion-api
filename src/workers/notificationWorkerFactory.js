const Codigos = require("../components/onlineInvoices/soap/codigos");
const OrderGenerator = require("../components/orderGenerators/orderGenerator.model");
const OrderGeneratorService = require("../components/orderGenerators/orderGeneratorService");
const ORDER_GENERATOR_STATUS = require("../commons/orderGeneratorStatus");
const ToGenerateInvoice = require("../components/toGenerateInvoices/toGenerateInvoice.model");
const MerchantConfig = require("../components/merchantConfigs/merchantConfig.model");
const InvoiceGenerator = require("../components/invoiceActions/invoiceGenerator");
const moment = require('moment-timezone');

const notificationWorkerFactory = function () {
  return {
    runCUFDGenerate: function (currentMongoose) {
      var codigos = new Codigos({});
      codigos.autoGenerateCufds(currentMongoose).then()
    },
    validateOrderGenerators: async function (currentMongoose) {
      try {
        // Fetch all OrderGenerators with the status STARTED
        const activeOrderGenerators = await OrderGenerator(currentMongoose).find({
          status: ORDER_GENERATOR_STATUS.STARTED.code,
        });

        // Process each OrderGenerator
        for (orderGen of activeOrderGenerators) {
          const orderGeneratorService = new OrderGeneratorService(currentMongoose, orderGen);
          await orderGeneratorService.handleOrderGeneration();
        }
      } catch (error) {
        console.error('Error processing order generators:', error);
      }
    },
    validateToGenerateInvoices: async function (currentMongoose) {
      try {
        // Fetch all ToGenerateInvoices with the status STARTED
        const toGenerateInvoicesCount = await ToGenerateInvoice(currentMongoose).countDocuments();
        if (toGenerateInvoicesCount) {
          try {
            const toGenerateInvoice = await ToGenerateInvoice(currentMongoose).findOne().lean();
            if (toGenerateInvoice) {
              const currentDate = moment().tz("America/La_Paz");
              toGenerateInvoice.fechaEnvio = currentDate.format('YYYY-MM-DD');
              toGenerateInvoice.horaEnvio = currentDate.format('HH:mm:ss.SSS');

              // Process each ToGenerateInvoice
              const merchantConfig = await MerchantConfig(currentMongoose)
                .findOne()
                .select('facturacion email businessName imgUrl phone iso2');

              // Create an instance of the InvoiceGenerator
              const invoiceGenerator = new InvoiceGenerator(currentMongoose, merchantConfig);

              // Handle subsidiary update and CUF generation
              const { subsidiary, emitedInvoiceData } = await invoiceGenerator.handleSubsidiaryUpdateAndCUF(toGenerateInvoice);

              // Handle emitedInvoice processing
              const result = await invoiceGenerator.handleEmitedInvoice(emitedInvoiceData, subsidiary, false);
              console.log('Emited Invoice from [validateToGenerateInvoices]: ', result.toJSON());
              try {
                const deletedInvoice = await ToGenerateInvoice(currentMongoose).findByIdAndDelete(toGenerateInvoice._id);

                if (!deletedInvoice) {
                  throw new Error("Invoice not found or already deleted");
                }

                console.log("✅ Invoice deleted successfully");
              } catch (error) {
                console.error("❌ Error deleting ToGenerateInvoice:", error.message);
              }
            }
          } catch (error) {
            console.error('Error processing invoice generators:', error);
          }
        }
      } catch (error) {
        console.error('Error processing invoice generators:', error);
      }
    }
  };
};

module.exports = notificationWorkerFactory();