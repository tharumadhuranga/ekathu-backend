const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    retail: Number,
    category: String, // අලුතින් එකතු කළා
    img: String,
    userAd: { type: Boolean, default: false }
});

module.exports = mongoose.model('Product', productSchema);