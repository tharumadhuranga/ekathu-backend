const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    members: [{ type: String }], // සාමාජිකයින්ගේ ඊමේල්
    maxMembers: { type: Number, default: 5 }, // උපරිම 5 දෙනයි
    status: { type: String, default: 'Open' }, // Open හෝ Completed
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);