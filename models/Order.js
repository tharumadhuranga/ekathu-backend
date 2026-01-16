const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    customerName: String,
    email: String,
    productName: String,
    price: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' }
});

module.exports = mongoose.model('Order', orderSchema);