const mongoose = require('mongoose');

// ─── Project Schema ───────────────────────────────────────────────
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
    // Images stored as Cloudinary URLs
    mainImage:   { type: String, default: '' },
    images: [{
        url:       { type: String, required: true },   // Cloudinary URL
        publicId:  { type: String, required: true },   // Cloudinary public_id (for deletion)
        filename:  { type: String, default: '' },
        isMain:    { type: Boolean, default: false }
    }]
}, {
    timestamps: true
});

const Project = mongoose.model('Project', projectSchema);

// ─── Connect to MongoDB (with Vercel serverless caching) ──────────
let isConnected = false;

async function connectDB() {
    // If already connected (warm serverless invocation), skip
    if (isConnected && mongoose.connection.readyState === 1) return;

    // If mongoose already has a connection from a previous invocation, reuse it
    if (mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log('⚠️  MONGODB_URI not set — falling back to file-based storage');
        return;
    }

    try {
        await mongoose.connect(uri, {
            maxPoolSize: 5,           // Keep pool small for serverless
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 30000,
        });
        isConnected = true;
        console.log('✅ Connected to MongoDB Atlas');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        isConnected = false;
    }
}

function useDB() {
    return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { Project, connectDB, useDB };
