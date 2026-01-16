const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'customer' },
    // අලුතින් එකතු කළ Cart කොටස (Items Array එකක්)
    cart: [{ 
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1 }
    }]
});

module.exports = mongoose.model('User', userSchema);