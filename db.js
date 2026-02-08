const mongoose = require('mongoose');

// ─── Image Schema — stores image binary data in MongoDB ───────────
const imageSchema = new mongoose.Schema({
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    filename:    { type: String, required: true },
    contentType: { type: String, required: true },
    data:        { type: Buffer, required: true },      // raw binary
    isMain:      { type: Boolean, default: false },
    size:        { type: Number, default: 0 }
}, {
    timestamps: true
});

// Index for fast lookups
imageSchema.index({ projectId: 1 });

const Image = mongoose.model('Image', imageSchema);

// ─── Project Schema — mirrors the fields from your "Add New Project" form ──
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

module.exports = { Project, Image, connectDB, useDB };
