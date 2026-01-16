const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer'); // අපි අලුතින් දාපු එක
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // ෆොටෝ පෙන්වන්න

// MongoDB Connection (ඔයාගේ පාස්වර්ඩ් එක හරිද බලන්න)
mongoose.connect('mongodb+srv://tharusha:tharusha123@cluster0.1kbrb.mongodb.net/ekathuDB?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Cloud Connected Successfully!"))
.catch(err => console.error(err));

// --- SCHEMAS (දත්ත ව්‍යුහයන්) ---
const ProductSchema = new mongoose.Schema({
    name: String,
    price: Number,
    retail: Number,
    category: String,
    img: String,
    userAd: { type: Boolean, default: false },
    contact: String
});
const Product = mongoose.model('Product', ProductSchema);

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, default: 'user' }
});
const User = mongoose.model('User', UserSchema);

const CartSchema = new mongoose.Schema({
    email: String,
    productId: String,
    quantity: { type: Number, default: 1 }
});
const Cart = mongoose.model('Cart', CartSchema);

const OrderSchema = new mongoose.Schema({
    email: String,
    items: Array,
    total: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' } // Pending, Shipped, Delivered
});
const Order = mongoose.model('Order', OrderSchema);

// --- ROUTES (මංපෙත්) ---

// 1. Image Upload Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// 2. Products APIs
app.post('/api/products', upload.single('image'), async (req, res) => {
    const imageUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : '';
    const product = new Product({
        name: req.body.name,
        price: req.body.price,
        retail: req.body.retail,
        category: req.body.category,
        img: imageUrl,
        userAd: req.body.userAd === 'true'
    });
    await product.save();
    res.json(product);
});

app.get('/api/products', async (req, res) => {
    const { category, search } = req.query;
    let query = {};
    if (category && category !== 'All') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    const products = await Product.find(query);
    res.json(products);
});

app.delete('/api/products/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// 3. Auth APIs
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.json({ success: false, message: "Email already exists" });
        
        const newUser = new User({ name, email, password, role: 'user' });
        await newUser.save();
        res.json({ success: true, message: "Registered" });
    } catch (err) { res.status(500).json({ success: false, message: "Error" }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        res.json({ success: true, name: user.name, role: user.role });
    } else {
        res.json({ success: false, message: "Invalid Credentials" });
    }
});

// 4. Cart APIs
app.post('/api/cart/add', async (req, res) => {
    const { email, productId } = req.body;
    let item = await Cart.findOne({ email, productId });
    if (item) {
        item.quantity += 1;
        await item.save();
    } else {
        await new Cart({ email, productId }).save();
    }
    res.json({ message: "Added" });
});

app.get('/api/cart', async (req, res) => {
    const cartItems = await Cart.find({ email: req.query.email });
    const fullCart = await Promise.all(cartItems.map(async (item) => {
        const product = await Product.findById(item.productId);
        return { product, quantity: item.quantity };
    }));
    res.json(fullCart);
});

app.post('/api/cart/remove', async (req, res) => {
    await Cart.deleteOne({ email: req.body.email, productId: req.body.productId });
    res.json({ message: "Removed" });
});

app.post('/api/cart/checkout', async (req, res) => {
    const { email } = req.body;
    const cartItems = await Cart.find({ email });
    
    let total = 0;
    let items = [];
    for (let item of cartItems) {
        const product = await Product.findById(item.productId);
        if(product) {
            total += product.price * item.quantity;
            items.push({ name: product.name, qty: item.quantity, price: product.price });
        }
    }

    if (items.length > 0) {
        const order = new Order({ email, items, total, status: 'Pending' });
        await order.save();
        await Cart.deleteMany({ email });
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// --- ADMIN ROUTES (මේවා තමයි අලුත් ඒව) ---

// Orders බලාගැනීම
app.get('/api/admin/orders', async (req, res) => {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
});

// Order Status වෙනස් කිරීම (Shipment)
app.put('/api/admin/orders/:id', async (req, res) => {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true });
});

// Order Delete කිරීම
app.delete('/api/admin/orders/:id', async (req, res) => {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Users බලාගැනීම
app.get('/api/admin/users', async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
});

// Users Delete කිරීම
app.delete('/api/admin/users/:id', async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
