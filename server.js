const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Product = require('./models/Product');
const Order = require('./models/Order');
const User = require('./models/User');
const Group = require('./models/Group');

const app = express();
// Server එක දෙන Port එක ගන්නවා, නැත්නම් 5000 ගන්නවා
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ✅ ඔයාගේ Cloud Database Link එක
const mongoDB_URL = 'mongodb://adminekathu:gamini12345@ac-bqtjisa-shard-00-00.x9vtloe.mongodb.net:27017,ac-bqtjisa-shard-00-01.x9vtloe.mongodb.net:27017,ac-bqtjisa-shard-00-02.x9vtloe.mongodb.net:27017/ekathu_db?replicaSet=atlas-64mb3h-shard-0&ssl=true&authSource=admin';

mongoose.connect(mongoDB_URL)
    .then(() => console.log("✅ MongoDB Cloud Connected Successfully!"))
    .catch(err => console.error("❌ Connection Error:", err));

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => res.send("Ekathu API Running"));

// --- PRODUCTS ---
app.get('/api/products', async (req, res) => {
    try {
        let query = {};
        if (req.query.search) query.name = { $regex: req.query.search, $options: 'i' };
        if (req.query.category && req.query.category !== 'All') query.category = req.query.category;
        const products = await Product.find(query).sort({ _id: -1 });
        res.json(products);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
    try {
        // ✅ Deployment Fix: localhost වෙනුවට ඇත්ත Domain එක ගන්නවා
        const host = req.get('host');
        const protocol = req.protocol;
        const imgUrl = req.file ? `${protocol}://${host}/uploads/${req.file.filename}` : "https://via.placeholder.com/400";
        
        const newProduct = new Product({
            name: req.body.name, price: req.body.price, retail: req.body.retail,
            category: req.body.category, img: imgUrl, userAd: req.body.userAd === 'true'
        });
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
    try { await Product.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CART ---
app.post('/api/cart/add', async (req, res) => {
    try {
        const { email, productId } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });
        const itemIndex = user.cart.findIndex(item => item.product == productId);
        if (itemIndex > -1) user.cart[itemIndex].quantity += 1;
        else user.cart.push({ product: productId, quantity: 1 });
        await user.save();
        res.json({ message: "Added", cartCount: user.cart.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/cart', async (req, res) => {
    try {
        const email = req.query.email;
        const user = await User.findOne({ email }).populate('cart.product');
        if (!user) return res.json([]);
        res.json(user.cart);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cart/checkout', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email }).populate('cart.product');
        if (!user || user.cart.length === 0) return res.status(400).json({ error: "Cart empty" });
        for (let item of user.cart) {
            if (item.product) {
                const newOrder = new Order({
                    customerName: user.name, email: user.email, productName: item.product.name,
                    price: item.product.price * item.quantity, status: 'Pending'
                });
                await newOrder.save();
            }
        }
        user.cart = []; await user.save();
        res.json({ success: true, message: "Checkout Successful!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/cart/remove', async (req, res) => {
    try {
        const { email, productId } = req.body;
        const user = await User.findOne({ email });
        user.cart = user.cart.filter(item => item.product != productId);
        await user.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GROUPS ---
app.post('/api/groups', async (req, res) => {
    try {
        const { email, productId } = req.body;
        const newGroup = new Group({ product: productId, members: [email] });
        await newGroup.save();
        res.json({ success: true, groupId: newGroup._id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/groups/:id', async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).populate('product');
        if (!group) return res.status(404).json({ error: "Group not found" });
        res.json(group);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/groups/:id/join', async (req, res) => {
    try {
        const { email } = req.body;
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ error: "Group not found" });
        if (group.members.includes(email)) return res.status(400).json({ error: "Already joined" });
        if (group.members.length >= group.maxMembers) return res.status(400).json({ error: "Group full" });

        group.members.push(email);
        if (group.members.length === group.maxMembers) group.status = 'Completed';
        
        await group.save();
        res.json({ success: true, members: group.members });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ORDERS & STATS & AUTH ---
app.get('/api/orders', async (req, res) => {
    try {
        const email = req.query.email;
        let query = {}; if (email) query = { email: email };
        const orders = await Order.find(query).sort({ date: -1 });
        res.json(orders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/orders', async (req, res) => {
    try { const newOrder = new Order(req.body); await newOrder.save(); res.status(201).json(newOrder); } catch (err) { res.status(400).json({ error: err.message }); }
});
app.put('/api/orders/:id', async (req, res) => {
    try { const updated = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }); res.json(updated); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/stats', async (req, res) => {
    try {
        const productCount = await Product.countDocuments(); const orderCount = await Order.countDocuments(); const userCount = await User.countDocuments();
        const salesData = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$price" } } }]);
        const totalSales = salesData.length > 0 ? salesData[0].total : 0;
        res.json({ productCount, orderCount, totalSales, userCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "Email exists" });
        const newUser = new User({ name, email, password }); await newUser.save();
        res.json({ success: true, message: "Registered!" });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (email.toLowerCase() === 'admin@ekathu.lk' && password === 'tharusha') return res.json({ success: true, role: 'admin', name: 'Super Admin' });
    try {
        const user = await User.findOne({ email });
        if (!user || user.password !== password) return res.status(401).json({ success: false, message: "Invalid" });
        res.json({ success: true, role: user.role, name: user.name });
    } catch (err) { res.status(500).json({ success: false, message: "Error" }); }
});

app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`); });