const mongoose = require('mongoose');

// Project Schema — mirrors the fields from your "Add New Project" form
const projectSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    category:    { type: String, required: true, enum: ['first', 'second'] },
    folder:      { type: String, required: true, unique: true },
    location:    { type: String, default: '' },
    status:      { type: String, default: '' },
    client:      { type: String, default: '' },
    duration:    { type: String, default: '' },
    area:        { type: String, default: '' },
    type:        { type: String, default: '' },
    mainImage:   { type: String, default: '' },
    images:      { type: [String], default: [] }
}, {
    timestamps: true  // auto createdAt & updatedAt
});

const Project = mongoose.model('Project', projectSchema);

// ─── Connect to MongoDB ───────────────────────────────────────────
let isConnected = false;

async function connectDB() {
    if (isConnected) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log('⚠️  MONGODB_URI not set — falling back to file-based storage');
        return;
    }

    try {
        await mongoose.connect(uri);
        isConnected = true;
        console.log('✅ Connected to MongoDB Atlas');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
    }
}

function useDB() {
    return isConnected;
}

module.exports = { Project, connectDB, useDB };
