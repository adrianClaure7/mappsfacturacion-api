const GeneratedProduct = require("../generatedProducts/generatedProduct.model");
const Order = require("../orders/order.model");
const ORDER_GENERATOR_STATUS = require("../../commons/orderGeneratorStatus");
const COMMON_STATUS = require("../../commons/commonStatus");
const COMMON_CURRENCY_TYPES = require('../../commons/commonCurrencyTypes');
const InvoiceGenerator = require("../invoiceActions/invoiceGenerator");
const MerchantConfig = require("../merchantConfigs/merchantConfig.model");
const moment = require('moment-timezone');

class OrderGeneratorService {
    constructor(currentMongoose, orderGen) {
        this.orderGen = orderGen;
        this.currentMongoose = currentMongoose;
    }

    // Initialize necessary variables such as remaining days, amounts, and order schedule
    async initialize() {
        this.remainingDays = this.calculateRemainingDays(
            this.orderGen.executionStartDate || this.orderGen.createdOn,
            this.orderGen.executionEndDate
        );

        this.currentAccumulated = this.calculateCurrentAmountAccumulated();
        this.remainingAmount = this.orderGen.totalAmountOfOrders - this.currentAccumulated;

        this.ordersTodayCount = this.calculateOrdersForToday();
        this.orderTimes = this.calculateOrderTimes(this.ordersTodayCount); // Updated to use dynamic time window
    }

    // Calculate the number of days between the start and end dates
    calculateRemainingDays(executionStartDate, executionEndDate) {
        const startDate = new Date(executionStartDate);
        const endDate = new Date(executionEndDate);
        return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)); // In days
    }

    // Sum up the amount of orders that have already been created (from the accumulatedOrderList)
    calculateCurrentAmountAccumulated() {
        return this.orderGen.accumulatedOrderList.reduce(
            (total, order) => total + order.amount,
            0
        );
    }

    // Calculate today's accumulated amount of orders from the accumulatedOrderList
    calculateTodayAccumulatedAmount() {
        const today = new Date(moment.tz("America/La_Paz").format('YYYY-MM-DD HH:mm:ss')).toDateString(); // Get today's date in comparable format
        return this.orderGen.accumulatedOrderList
            .filter(order => new Date(order.date).toDateString() === today) // Filter orders created today
            .reduce((total, order) => total + order.amount, 0); // Sum today's order amounts
    }

    // Calculate how many orders are needed for today, ensuring we don't exceed the daily target
    calculateOrdersForToday() {
        const dailyOrderAmount = this.remainingAmount / this.remainingDays;

        const todayAccumulatedAmount = this.calculateTodayAccumulatedAmount();
        if (todayAccumulatedAmount >= dailyOrderAmount) {
            console.log("Today's target met, no more orders needed today.");
            return 0; // No more orders needed today
        }

        const remainingForToday = dailyOrderAmount - todayAccumulatedAmount;

        const maxPossibleOrders = Math.floor(remainingForToday / this.orderGen.minAmountPerOrder);
        const minPossibleOrders = Math.ceil(remainingForToday / this.orderGen.maxAmountPerOrder);

        return Math.max(
            Math.floor(Math.random() * (maxPossibleOrders - minPossibleOrders + 1)) + minPossibleOrders,
            1
        );
    }

    // Updated method: Calculate order creation times using startDayHour and endDayHour
    calculateOrderTimes(ordersCount) {
        const startHour = this.orderGen.startDayHour;  // e.g., 08:00
        const endHour = this.orderGen.endDayHour;      // e.g., 18:00

        const startOfWindow = new Date(moment.tz("America/La_Paz").format('YYYY-MM-DD HH:mm:ss')).setHours(startHour, 0, 0, 0);  // startDayHour:00:00
        const endOfWindow = new Date(moment.tz("America/La_Paz").format('YYYY-MM-DD HH:mm:ss')).setHours(endHour, 0, 0, 0);      // endDayHour:00:00

        const totalTimeWindow = endOfWindow - startOfWindow;

        const interval = totalTimeWindow / ordersCount;

        let times = [];
        for (let i = 0; i < ordersCount; i++) {
            const orderTime = new Date(startOfWindow + (i * interval));
            times.push(orderTime);
        }

        return times;
    }

    // Check if the current time matches one of the scheduled order creation times
    isTimeToCreateOrder(now) {
        return this.orderTimes.some(time => (
            now.getHours() === time.getHours() && now.getMinutes() === time.getMinutes()
        ));
    }

    // Main function to handle the order generation process
    async handleOrderGeneration() {
        if (this.orderGen.status === ORDER_GENERATOR_STATUS.STOPED.code) {
            console.log("Order generation is stopped.");
            return;
        }

        await this.initialize();
        const now = new Date(moment.tz("America/La_Paz").format('YYYY-MM-DD HH:mm:ss'));

        const startHour = this.orderGen.startDayHour;
        const endHour = this.orderGen.endDayHour;
        const currentHour = now.getHours();

        if (currentHour < startHour || currentHour >= endHour) {
            console.log("Outside the order generation time window. Skipping order creation.");
            return;
        }

        const ordersToday = this.getTodayOrdersCount(now);

        const todayAccumulatedAmount = this.calculateTodayAccumulatedAmount();
        if (todayAccumulatedAmount >= (this.remainingAmount / this.remainingDays)) {
            console.log("Today's order amount has been met. No more orders needed today.");
            return;
        }

        if (this.isTimeToCreateOrder(now) && ordersToday < this.ordersTodayCount) {
            await this.createOrder();
        } else {
            console.log(`Orders created today: ${ordersToday}. Waiting for the next interval or no more orders needed today.`);
        }
    }

    // Get the count of orders already created today
    getTodayOrdersCount(now) {
        return this.orderGen.accumulatedOrderList.filter(order => (
            new Date(order.date).toDateString() === now.toDateString()
        )).length;
    }

    // Create a new order and assign products to it
    async createOrder() {
        if (this.remainingAmount <= 0 || this.remainingDays <= 0) {
            console.log('No more orders to generate');
            await this.finalizeOrderGeneration();
            return;
        }

        try {
            const products = await this.getGeneratedProducts();
            const orderAmount = this.calculateOrderAmount();

            const dailyOrderAmount = this.remainingAmount / this.remainingDays;
            const todayAccumulatedAmount = this.calculateTodayAccumulatedAmount();

            if (orderAmount < this.orderGen.minAmountPerOrder) {
                console.log(`Order amount ${orderAmount} is smaller than minAmountPerOrder (${this.orderGen.minAmountPerOrder}). Adjusting...`);
                return;
            }

            if (todayAccumulatedAmount + orderAmount > dailyOrderAmount) {
                console.log("Order exceeds today's limit, skipping.");
                return;
            }

            // Assign products to the order, ensuring their total matches the orderAmount
            const assignedProducts = await this.assignProductsToOrder(products, orderAmount);

            if (assignedProducts.length === 0) {
                console.log("No products could be assigned to the order. Skipping order creation.");
                return;
            }

            const actualOrderAmount = this.calculateTotalAmount(assignedProducts);

            const { newOrder, newOrderModel } = await this.createNewOrder(assignedProducts, actualOrderAmount);

            let emitedInvoice = InvoiceGenerator.createEmitedInvoiceFromOrder(newOrder);

            const merchantConfig = await MerchantConfig(this.currentMongoose)
                .findOne()
                .select('facturacion email businessName imgUrl phone iso2');

            const invoiceGenerator = new InvoiceGenerator(this.currentMongoose, merchantConfig);
            const { subsidiary, emitedInvoiceData } = await invoiceGenerator.handleSubsidiaryUpdateAndCUF(emitedInvoice, newOrder);

            if (this.orderGen.generateInvoices) {
                emitedInvoiceData.orderGeneratorId = this.orderGen._id;
                await invoiceGenerator.handleEmitedInvoice(emitedInvoiceData, subsidiary);
            } else {
                    await invoiceGenerator.registerInMakroSai(emitedInvoiceData, newOrderModel, true);
            }

            await this.updateOrderGeneration(newOrderModel, actualOrderAmount, this.orderGen.generateInvoices);

        } catch (error) {
            console.error(`Generator CreateOrder Error: ${error.message || error}`);
        }
    }

    // Finalize the order generation process by updating the status to 'FINISH'
    async finalizeOrderGeneration() {
        this.orderGen.status = ORDER_GENERATOR_STATUS.FINISH.code;
        await this.orderGen.save();
    }

    // Fetch the products that can be assigned to the orders
    async getGeneratedProducts() {
        return await GeneratedProduct(this.currentMongoose).find({
            orderGeneratorId: this.orderGen._id,
            $expr: { $gt: [{ $subtract: ["$maxQuantity", "$currentQuantity"] }, 1] }
        });
    }

    // Calculate the amount to be assigned to this specific order
    calculateOrderAmount() {
        const dailyRemainingAmount = this.remainingAmount / this.remainingDays;
        return Math.min(
            Math.max(
                Math.floor(Math.random() * (this.orderGen.maxAmountPerOrder - this.orderGen.minAmountPerOrder + 1)) + this.orderGen.minAmountPerOrder,
                this.orderGen.minAmountPerOrder // Ensure at least minAmountPerOrder
            ),
            dailyRemainingAmount // Limit by the remaining daily amount
        );
    }

    // Assign products to the order, ensuring that the total amount matches the calculated order amount
    async assignProductsToOrder(products, totalAmount) {
        let remainingAmount = totalAmount;
        let assignedProducts = [];

        for (let product of products) {
            // Skip the product if its currentQuantity is greater than or equal to its maxQuantity
            if (product.currentQuantity >= product.maxQuantity) {
                console.log(`Product ${product.code} has reached its maxQuantity. Skipping...`);
                continue;
            }

            // Calculate the maximum quantity that can be assigned based on remainingAmount and product's available quantity
            const maxQuantity = Math.floor(remainingAmount / product.unitAmount);
            const availableQuantity = product.maxQuantity - product.currentQuantity;

            // Ensure the quantity doesn't exceed the availableQuantity
            const assignableQuantity = Math.min(maxQuantity, availableQuantity);

            if (assignableQuantity > 0) {
                // Determine the quantity to be assigned, ensuring it doesn't exceed assignableQuantity
                let quantity = Math.min(Math.ceil(Math.random() * assignableQuantity), assignableQuantity);

                // Validate that the new currentQuantity after assigning this quantity does not exceed maxQuantity
                if (product.currentQuantity + quantity > product.maxQuantity) {
                    console.log(`Assigning ${quantity} would exceed maxQuantity for product ${product.code}. Skipping...`);
                    continue; // Skip this product if it would exceed maxQuantity
                }

                // If validation passes, add the product to assignedProducts
                assignedProducts.push({
                    code: product.code,
                    SINCode: product.SINCode,
                    economicActivity: product.economicActivity,
                    description: product.description,
                    quantity: quantity,
                    unitAmount: product.unitAmount,
                    currency: product.currency,
                });

                remainingAmount -= product.unitAmount * quantity;

                // Update the product's currentQuantity
                product.currentQuantity += quantity;

                await product.save(); // Save the updated product in the database
            }

            // Stop assigning products once the remainingAmount is depleted
            if (remainingAmount <= 0) {
                break;
            }
        }

        return assignedProducts;
    }


    // Calculate the total amount of the assigned products
    calculateTotalAmount(products) {
        return products.reduce((total, product) => total + (product.unitAmount * product.quantity), 0);
    }

    // Create a new order model and save it to the database
    async createNewOrder(assignedProducts, actualOrderAmount) {
        const orderDetails = assignedProducts.map(product => ({
            code: product.code,
            SINCode: product.SINCode,
            economicActivity: product.economicActivity,
            description: product.description,
            quantity: product.quantity,
            unitAmount: product.unitAmount,
            currency: product.currency,
        }));

        const order = {
            clientCode: 'Gen Orde',
            amount: actualOrderAmount,
            currency: COMMON_CURRENCY_TYPES.BOB.code,
            orderDetails: orderDetails,
            status: COMMON_STATUS.COMPLETED,
            codigoSucursal: this.orderGen.codigoSucursal || 0,
            codigoPuntoVenta: this.orderGen.codigoPuntoVenta || 0,
            payments: [{
                currency: COMMON_CURRENCY_TYPES.BOB.code,
                totalAmount: actualOrderAmount
            }],
            orderGeneratorId: this.orderGen._id
        };

        const newOrderModel = new Order(this.currentMongoose)(order);
        const newOrder = await newOrderModel.createOrder()

        return { newOrder, newOrderModel };
    }

    // Update the order generator's list of accumulated orders and check if the generation process is complete
    async updateOrderGeneration(newOrder, actualOrderAmount) {
        this.orderGen.accumulatedOrderList.push({
            orderId: newOrder._id,
            amount: actualOrderAmount,
            date: new Date(moment.tz("America/La_Paz").format('YYYY-MM-DD HH:mm:ss')),
        });
        await this.orderGen.save();

        if (this.remainingAmount <= 0 && this.remainingDays <= 0) {
            this.finalizeOrderGeneration();
            console.log("All orders generated, order generator finalized.");
        }

        console.log(`Order with amount ${actualOrderAmount} generated successfully. Order Generated Nro: ${this.orderGen.accumulatedOrderList.length}`);
    }
}

module.exports = OrderGeneratorService;
