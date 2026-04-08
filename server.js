const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const { Project, connectDB, useDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Auth config ──────────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'adminsmcs';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'smcs@9491';
const JWT_SECRET     = process.env.JWT_SECRET     || 'smcs-secret-key-change-in-production';

// ─── Cloudinary config ────────────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function useCloudinary() {
    return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// ─── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(__dirname));

// ─── Ensure DB is connected on every request (critical for Vercel serverless) ──
app.use(async (req, res, next) => {
    try {
        await connectDB();
    } catch (err) {
        console.error('DB connection middleware error:', err.message);
    }
    next();
});

// ─── Auth middleware ──────────────────────────────────────────────
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized — please login as admin' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token — please login again' });
    }
}

// ─── File-based helpers (local dev fallback) ──────────────────────
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const IMG_DIR       = path.join(__dirname, 'img');
const IMAGE_EXTS    = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function readProjectsFile() {
    try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); }
    catch { return { projects: [] }; }
}
function writeProjectsFile(data) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

function enrichWithDiskImages(project) {
    const folderPath = path.join(IMG_DIR, project.folder);
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath)
            .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
        project.images = files.map(f => ({
            url: `img/${project.folder}/${f}`,
            publicId: '',
            filename: f,
            isMain: f.toLowerCase().startsWith('main.')
        }));
        const mainFile = files.find(f => f.toLowerCase().startsWith('main.'));
        project.mainImage = mainFile
            ? `img/${project.folder}/${mainFile}`
            : (files.length > 0 ? `img/${project.folder}/${files[0]}` : '');
    }
    return project;
}

// ─── Multer — always memory storage (buffers go to Cloudinary or disk) ──
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4.5 * 1024 * 1024 }, // 4.5MB per file — Vercel serverless request limit
    fileFilter: (req, file, cb) => {
        const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
        cb(ok ? null : new Error('Only image files allowed!'), ok);
    }
});

// ─── Cloudinary upload helper ─────────────────────────────────────
function uploadToCloudinary(buffer, folder, filename) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `smcs/${folder}`,
                public_id: path.parse(filename).name,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
}

// ─── Save buffer to disk (local dev fallback) ────────────────────
function saveToDisk(buffer, folder, filename) {
    const dir = path.join(IMG_DIR, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    return `img/${folder}/${filename}`;
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ success: true, token, message: 'Login successful! Welcome Admin.' });
    }
    res.status(401).json({ success: false, error: 'Invalid username or password!' });
});

app.get('/api/auth/verify', requireAuth, (req, res) => {
    res.json({ success: true, message: 'Token is valid' });
});

// ═══════════════════════════════════════════════════════════════════
//  PROJECT ROUTES
// ═══════════════════════════════════════════════════════════════════

// ─── GET all projects ─────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        let projects;
        if (useDB()) {
            const docs = await Project.find().lean();
            projects = docs.map(p => {
                p.id = p._id.toString();
                // Derive mainImage from the images array
                const main = p.images.find(i => i.isMain);
                p.mainImage = main ? main.url : (p.images.length > 0 ? p.images[0].url : '');
                delete p._id; delete p.__v;
                return p;
            });
        } else {
            const data = readProjectsFile();
            projects = data.projects.map(enrichWithDiskImages);
        }
        res.json({ projects });
    } catch (error) {
        console.error('GET /api/projects error:', error);
        res.status(500).json({ error: 'Failed to read projects' });
    }
});

// ─── POST new project ─────────────────────────────────────────────
app.post('/api/projects', requireAuth, upload.array('projectImages', 20), async (req, res) => {
    try {
        const {
            projectName, projectDescription, projectCategory, projectFolder,
            projectLocation, projectStatus, projectClient,
            projectDuration, projectArea, projectType
        } = req.body;

        if (!projectName || !projectCategory || !projectFolder) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        // Upload images
        const imageEntries = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const isMain = i === 0;
            const fname = isMain ? 'main' + path.extname(file.originalname) : file.originalname;

            if (useCloudinary()) {
                const result = await uploadToCloudinary(file.buffer, projectFolder, fname);
                imageEntries.push({
                    url: result.secure_url,
                    publicId: result.public_id,
                    filename: fname,
                    isMain
                });
            } else {
                const diskPath = saveToDisk(file.buffer, projectFolder, fname);
                imageEntries.push({ url: diskPath, publicId: '', filename: fname, isMain });
            }
        }

        const mainImg = imageEntries.find(i => i.isMain);
        const projectData = {
            name: projectName,
            description: projectDescription || '',
            category: projectCategory,
            folder: projectFolder,
            location: projectLocation || '',
            status: projectStatus || '',
            client: projectClient || '',
            duration: projectDuration || '',
            area: projectArea || '',
            type: projectType || '',
            mainImage: mainImg ? mainImg.url : imageEntries[0]?.url || '',
            images: imageEntries
        };

        let savedProject;
        if (useDB()) {
            const doc = await new Project(projectData).save();
            savedProject = doc.toObject();
            savedProject.id = savedProject._id.toString();
            delete savedProject._id; delete savedProject.__v;
        } else {
            savedProject = { id: Date.now().toString(), ...projectData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const data = readProjectsFile();
            data.projects.push(savedProject);
            writeProjectsFile(data);
        }

        res.json({ success: true, message: 'Project added successfully', project: savedProject });
    } catch (error) {
        console.error('POST /api/projects error:', error);
        res.status(500).json({ error: error.message || 'Failed to add project' });
    }
});

// ─── PUT update project ───────────────────────────────────────────
app.put('/api/projects/:id', requireAuth, async (req, res) => {
    try {
        const updates = req.body;
        if (useDB()) {
            const doc = await Project.findByIdAndUpdate(
                req.params.id,
                {
                    name: updates.name, description: updates.description,
                    category: updates.category, location: updates.location || '',
                    status: updates.status || '', client: updates.client || '',
                    duration: updates.duration || '', area: updates.area || '',
                    type: updates.type || ''
                },
                { new: true, lean: true }
            );
            if (!doc) return res.status(404).json({ error: 'Project not found' });
            doc.id = doc._id.toString();
            res.json({ success: true, message: 'Project updated successfully', project: doc });
        } else {
            const data = readProjectsFile();
            const idx = data.projects.findIndex(p => p.id === req.params.id);
            if (idx === -1) return res.status(404).json({ error: 'Project not found' });
            const project = data.projects[idx];
            Object.assign(project, {
                name: updates.name || project.name,
                description: updates.description ?? project.description,
                category: updates.category || project.category,
                location: updates.location || '', status: updates.status || '',
                client: updates.client || '', duration: updates.duration || '',
                area: updates.area || '', type: updates.type || '',
                updatedAt: new Date().toISOString()
            });
            data.projects[idx] = project;
            writeProjectsFile(data);
            res.json({ success: true, message: 'Project updated successfully', project });
        }
    } catch (error) {
        console.error('PUT /api/projects/:id error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// ─── DELETE project by id ─────────────────────────────────────────
app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
        if (useDB()) {
            const doc = await Project.findByIdAndDelete(req.params.id).lean();
            if (!doc) return res.status(404).json({ error: 'Project not found' });
            // Delete all images from Cloudinary
            if (useCloudinary() && doc.images) {
                for (const img of doc.images) {
                    if (img.publicId) {
                        try { await cloudinary.uploader.destroy(img.publicId); } catch {}
                    }
                }
            }
        } else {
            const data = readProjectsFile();
            const idx = data.projects.findIndex(p => p.id === req.params.id);
            if (idx === -1) return res.status(404).json({ error: 'Project not found' });
            const folder = data.projects[idx].folder;
            data.projects.splice(idx, 1);
            writeProjectsFile(data);
            const folderPath = path.join(IMG_DIR, folder);
            if (fs.existsSync(folderPath)) {
                fs.readdirSync(folderPath).forEach(f => fs.unlinkSync(path.join(folderPath, f)));
                fs.rmdirSync(folderPath);
            }
        }
        res.json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('DELETE /api/projects/:id error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ─── DELETE project by folder name ────────────────────────────────
app.delete('/api/projects/folder/:folderName', requireAuth, async (req, res) => {
    try {
        const folderName = req.params.folderName;
        if (useDB()) {
            const doc = await Project.findOneAndDelete({ folder: folderName }).lean();
            if (doc && useCloudinary() && doc.images) {
                for (const img of doc.images) {
                    if (img.publicId) {
                        try { await cloudinary.uploader.destroy(img.publicId); } catch {}
                    }
                }
            }
        } else {
            const data = readProjectsFile();
            data.projects = data.projects.filter(p => p.folder !== folderName);
            writeProjectsFile(data);
            const folderPath = path.join(IMG_DIR, folderName);
            if (fs.existsSync(folderPath)) {
                fs.readdirSync(folderPath).forEach(f => fs.unlinkSync(path.join(folderPath, f)));
                fs.rmdirSync(folderPath);
            }
        }
        res.json({ success: true, message: 'Project folder deleted successfully' });
    } catch (error) {
        console.error('DELETE /api/projects/folder error:', error);
        res.status(500).json({ error: 'Failed to delete project folder' });
    }
});

// ─── GET images for a project ─────────────────────────────────────
app.get('/api/projects/:folderName/images', async (req, res) => {
    try {
        const folderName = req.params.folderName;
        if (useDB()) {
            const project = await Project.findOne({ folder: folderName }).lean();
            if (!project) return res.json({ images: [] });
            const images = (project.images || [])
                .sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0))
                .map(img => ({
                    filename: img.filename || img.publicId || '',
                    path: img.url,
                    isMain: img.isMain,
                    publicId: img.publicId
                }));
            return res.json({ images });
        }
        // File-based fallback
        const folderPath = path.join(IMG_DIR, folderName);
        if (!fs.existsSync(folderPath)) return res.json({ images: [] });
        const files = fs.readdirSync(folderPath);
        const images = files
            .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
            .map(f => ({ filename: f, path: `img/${folderName}/${f}`, isMain: f.toLowerCase().startsWith('main.'), publicId: '' }))
            .sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));
        res.json({ images });
    } catch (error) {
        console.error('GET images error:', error);
        res.status(500).json({ error: 'Failed to read images' });
    }
});

// ─── POST upload images to a project ──────────────────────────────
app.post('/api/projects/:folderName/images', requireAuth, upload.array('images', 20), async (req, res) => {
    try {
        const folderName = req.params.folderName;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        if (useDB()) {
            const project = await Project.findOne({ folder: folderName });
            if (!project) return res.status(404).json({ error: 'Project not found' });

            const uploaded = [];
            for (const file of req.files) {
                if (useCloudinary()) {
                    const result = await uploadToCloudinary(file.buffer, folderName, file.originalname);
                    const entry = { url: result.secure_url, publicId: result.public_id, filename: file.originalname, isMain: false };
                    project.images.push(entry);
                    uploaded.push({ filename: file.originalname, path: result.secure_url, isMain: false });
                } else {
                    const diskPath = saveToDisk(file.buffer, folderName, file.originalname);
                    const entry = { url: diskPath, publicId: '', filename: file.originalname, isMain: false };
                    project.images.push(entry);
                    uploaded.push({ filename: file.originalname, path: diskPath, isMain: false });
                }
            }
            await project.save();
            return res.json({ success: true, images: uploaded });
        }

        // File-based fallback
        const uploaded = req.files.map(file => {
            const diskPath = saveToDisk(file.buffer, folderName, file.originalname);
            return { filename: file.originalname, path: diskPath, isMain: false };
        });
        res.json({ success: true, images: uploaded });
    } catch (error) {
        console.error('Upload images error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// ─── DELETE a single image ────────────────────────────────────────
app.delete('/api/projects/:folderName/images/:filename', requireAuth, async (req, res) => {
    try {
        const { folderName, filename } = req.params;

        if (useDB()) {
            const project = await Project.findOne({ folder: folderName });
            if (!project) return res.status(404).json({ error: 'Project not found' });

            const imgIdx = project.images.findIndex(
                img => img.filename === filename || img.publicId === filename ||
                       (img._id && img._id.toString() === filename)
            );
            if (imgIdx === -1) return res.status(404).json({ error: 'Image not found' });

            const img = project.images[imgIdx];
            // Delete from Cloudinary
            if (useCloudinary() && img.publicId) {
                try { await cloudinary.uploader.destroy(img.publicId); } catch {}
            }
            project.images.splice(imgIdx, 1);

            // Update mainImage if we deleted the main
            if (img.isMain && project.images.length > 0) {
                project.images[0].isMain = true;
                project.mainImage = project.images[0].url;
            } else if (project.images.length === 0) {
                project.mainImage = '';
            }
            await project.save();
            return res.json({ success: true, message: 'Image deleted successfully' });
        }

        // File-based fallback
        const filePath = path.join(IMG_DIR, folderName, filename);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Image not found' });
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// ─── PUT set main image ──────────────────────────────────────────
app.put('/api/projects/:folderName/images/:filename/set-main', requireAuth, async (req, res) => {
    try {
        const { folderName, filename } = req.params;

        if (useDB()) {
            const project = await Project.findOne({ folder: folderName });
            if (!project) return res.status(404).json({ error: 'Project not found' });

            let found = false;
            project.images.forEach(img => {
                const isTarget = img.filename === filename || img.publicId === filename ||
                                 (img._id && img._id.toString() === filename);
                if (isTarget) { img.isMain = true; found = true; }
                else { img.isMain = false; }
            });

            if (!found) return res.status(404).json({ error: 'Image not found' });

            const mainImg = project.images.find(i => i.isMain);
            project.mainImage = mainImg ? mainImg.url : '';
            await project.save();

            return res.json({ success: true, message: 'Main image updated', mainImage: project.mainImage });
        }

        // File-based fallback
        const folderPath = path.join(IMG_DIR, folderName);
        const srcPath = path.join(folderPath, filename);
        const ext = path.extname(filename);
        const mainPath = path.join(folderPath, 'main' + ext);
        if (!fs.existsSync(srcPath)) return res.status(404).json({ error: 'Image not found' });
        fs.readdirSync(folderPath).forEach(f => {
            if (f.toLowerCase().startsWith('main.')) fs.unlinkSync(path.join(folderPath, f));
        });
        fs.copyFileSync(srcPath, mainPath);
        res.json({ success: true, message: 'Main image updated', mainImage: `img/${folderName}/main${ext}` });
    } catch (error) {
        console.error('Set main image error:', error);
        res.status(500).json({ error: 'Failed to set main image' });
    }
});

// ─── POST scan existing image folders (local dev) ─────────────────
app.post('/api/projects/scan', requireAuth, async (req, res) => {
    try {
        if (!fs.existsSync(IMG_DIR)) return res.json({ success: true, message: 'No img/ folder found', added: [] });

        const skipFolders = new Set(['myPics', 'Sai Manikanta Construction']);
        const added = [];

        let existingFolders;
        if (useDB()) {
            const docs = await Project.find({}, 'folder').lean();
            existingFolders = new Set(docs.map(d => d.folder));
        } else {
            const data = readProjectsFile();
            existingFolders = new Set(data.projects.map(p => p.folder));
        }

        const dirs = fs.readdirSync(IMG_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory() && !skipFolders.has(d.name) && !existingFolders.has(d.name));

        for (const dir of dirs) {
            const folderPath = path.join(IMG_DIR, dir.name);
            const imgFiles = fs.readdirSync(folderPath)
                .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
            if (imgFiles.length === 0) continue;

            const mainFile = imgFiles.find(f => f.toLowerCase().startsWith('main.'));
            const imageEntries = [];

            for (let i = 0; i < imgFiles.length; i++) {
                const fname = imgFiles[i];
                const isMain = fname === mainFile || (i === 0 && !mainFile);

                if (useCloudinary()) {
                    const buffer = fs.readFileSync(path.join(folderPath, fname));
                    const result = await uploadToCloudinary(buffer, dir.name, fname);
                    imageEntries.push({ url: result.secure_url, publicId: result.public_id, filename: fname, isMain });
                } else {
                    imageEntries.push({ url: `img/${dir.name}/${fname}`, publicId: '', filename: fname, isMain });
                }
            }

            const main = imageEntries.find(i => i.isMain);
            const projectData = {
                name: dir.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                description: '', category: 'first', folder: dir.name,
                location: '', status: '', client: '', duration: '', area: '', type: '',
                mainImage: main ? main.url : imageEntries[0]?.url || '',
                images: imageEntries
            };

            if (useDB()) {
                await Project.create(projectData);
            } else {
                const data = readProjectsFile();
                data.projects.push({ id: 'scan-' + Date.now() + '-' + dir.name, ...projectData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
                writeProjectsFile(data);
            }
            added.push(dir.name);
        }

        res.json({ success: true, message: `Scanned and added ${added.length} folder(s)`, added });
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: 'Failed to scan folders' });
    }
});

// ─── Health check ─────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    let projectCount = 0;
    if (useDB()) {
        try { projectCount = await Project.countDocuments(); } catch {}
    }
    res.json({
        status: 'ok',
        database: useDB() ? 'mongodb' : 'file',
        imageStorage: useCloudinary() ? 'cloudinary' : 'disk',
        projectCount
    });
});

// ─── Seed DB from projects.json ───────────────────────────────────
async function seedDBFromFile() {
    if (!useDB()) return;
    const count = await Project.countDocuments();
    if (count > 0) return;

    const data = readProjectsFile();
    if (data.projects.length === 0) return;

    console.log('🌱 Seeding MongoDB from projects.json...');
    for (const p of data.projects) {
        try {
            const imageEntries = [];
            const folderPath = path.join(IMG_DIR, p.folder);

            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath)
                    .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
                const mainFile = files.find(f => f.toLowerCase().startsWith('main.'));

                for (let i = 0; i < files.length; i++) {
                    const fname = files[i];
                    const isMain = fname === mainFile || (i === 0 && !mainFile);

                    if (useCloudinary()) {
                        const buffer = fs.readFileSync(path.join(folderPath, fname));
                        const result = await uploadToCloudinary(buffer, p.folder, fname);
                        imageEntries.push({ url: result.secure_url, publicId: result.public_id, filename: fname, isMain });
                        console.log(`  📸 Uploaded ${fname} → Cloudinary`);
                    } else {
                        imageEntries.push({ url: `img/${p.folder}/${fname}`, publicId: '', filename: fname, isMain });
                    }
                }
            }

            const main = imageEntries.find(i => i.isMain);
            await Project.create({
                name: p.name, description: p.description || '', category: p.category || 'first',
                folder: p.folder, location: p.location || '', status: p.status || '',
                client: p.client || '', duration: p.duration || '', area: p.area || '',
                type: p.type || '',
                mainImage: main ? main.url : (imageEntries.length > 0 ? imageEntries[0].url : ''),
                images: imageEntries
            });
        } catch (err) {
            console.warn('  Seed skip:', p.folder, err.message);
        }
    }
    console.log('✅ Seeded', data.projects.length, 'projects');
}

// ─── Start (for local dev / Render) ──────────────────────────────
async function start() {
    await connectDB();
    await seedDBFromFile();
    app.listen(PORT, () => {
        console.log(`\n✅ Server running on http://localhost:${PORT}`);
        console.log(`📦 DB: ${useDB() ? 'MongoDB Atlas' : 'Local file'}`);
        console.log(`🖼️  Images: ${useCloudinary() ? 'Cloudinary CDN' : 'Local disk'}`);
        console.log(`🚀 Open http://localhost:${PORT}/portfolio.html\n`);
    });
}

// Only start listening if NOT running on Vercel (Vercel uses the exported app)
if (!process.env.VERCEL) {
    start();
}

// Export for Vercel serverless
module.exports = app;

// Graceful shutdown (local dev only)
if (!process.env.VERCEL) {
    process.on('SIGINT', () => { console.log('\n👋 Shutting down...'); process.exit(0); });
}
