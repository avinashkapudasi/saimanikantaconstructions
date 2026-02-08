const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { Project, Image, connectDB, useDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the project root
app.use(express.static(__dirname));

// ─── File-based helpers (local dev fallback) ──────────────────────
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const IMG_DIR = path.join(__dirname, 'img');
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function readProjectsFile() {
    try {
        return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    } catch { return { projects: [] }; }
}

function writeProjectsFile(data) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

// Enrich a project with live images from disk (local dev only)
function enrichWithDiskImages(project) {
    const folderPath = path.join(IMG_DIR, project.folder);
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath)
            .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
        project.images = files.map(f => `img/${project.folder}/${f}`);
        const mainFile = files.find(f => f.toLowerCase().startsWith('main.'));
        if (mainFile) {
            project.mainImage = `img/${project.folder}/${mainFile}`;
        } else if (files.length > 0) {
            project.mainImage = `img/${project.folder}/${files[0]}`;
        }
    }
    return project;
}

// ─── Enrich project with MongoDB images ───────────────────────────
async function enrichWithDBImages(project) {
    const projectId = project._id || project.id;
    const images = await Image.find({ projectId }).sort({ isMain: -1, createdAt: 1 }).lean();

    project.images = images.map(img => `/api/images/${img._id}`);
    const mainImg = images.find(img => img.isMain);
    if (mainImg) {
        project.mainImage = `/api/images/${mainImg._id}`;
    } else if (images.length > 0) {
        project.mainImage = `/api/images/${images[0]._id}`;
    } else {
        project.mainImage = '';
    }
    return project;
}

// ─── Multer setup — memory storage for DB, disk for local ─────────
const diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const folderName = req.body.projectFolder || req.params.folderName;
        const uploadPath = path.join(IMG_DIR, folderName);
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const files = req.files || [];
        const isFirstImage = files.indexOf(file) === 0;
        if (isFirstImage) {
            cb(null, 'main' + path.extname(file.originalname));
        } else {
            cb(null, file.originalname);
        }
    }
});

const memoryStorage = multer.memoryStorage();

function getMulterUpload() {
    const storage = useDB() ? memoryStorage : diskStorage;
    return multer({
        storage,
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
            cb(ok ? null : new Error('Only image files allowed!'), ok);
        }
    });
}

// Dynamic multer middleware — picks storage based on DB connection
function dynamicUpload(fieldName, maxCount) {
    return function (req, res, next) {
        const upload = getMulterUpload();
        upload.array(fieldName, maxCount)(req, res, next);
    };
}

// ═══════════════════════════════════════════════════════════════════
//  SERVE IMAGES FROM MONGODB
// ═══════════════════════════════════════════════════════════════════
app.get('/api/images/:imageId', async (req, res) => {
    try {
        const img = await Image.findById(req.params.imageId).lean();
        if (!img) return res.status(404).send('Image not found');

        res.set('Content-Type', img.contentType);
        res.set('Cache-Control', 'public, max-age=86400'); // cache 1 day
        res.send(img.data);
    } catch (error) {
        console.error('GET /api/images/:id error:', error);
        res.status(500).send('Failed to load image');
    }
});

// ═══════════════════════════════════════════════════════════════════
//  API ROUTES
// ═══════════════════════════════════════════════════════════════════

// ─── GET all projects ─────────────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        let projects;

        if (useDB()) {
            const docs = await Project.find().lean();
            projects = [];
            for (const p of docs) {
                p.id = p._id.toString();
                const enriched = await enrichWithDBImages(p);
                delete enriched._id;
                delete enriched.__v;
                projects.push(enriched);
            }
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
app.post('/api/projects', dynamicUpload('projectImages', 10), async (req, res) => {
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

        if (useDB()) {
            // Create project first
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
                mainImage: '',
                images: []
            };
            const doc = await new Project(projectData).save();

            // Save images to MongoDB
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                await Image.create({
                    projectId: doc._id,
                    filename: file.originalname,
                    contentType: file.mimetype,
                    data: file.buffer,
                    isMain: i === 0,  // first image is main
                    size: file.size
                });
            }

            // Enrich with image URLs and return
            const savedProject = await enrichWithDBImages(doc.toObject());
            savedProject.id = savedProject._id.toString();
            delete savedProject._id;
            delete savedProject.__v;

            res.json({ success: true, message: 'Project added successfully', project: savedProject });
        } else {
            // File-based (local dev)
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
                mainImage: `img/${projectFolder}/main${path.extname(req.files[0].originalname)}`,
                images: req.files.map(file => `img/${projectFolder}/${file.filename}`)
            };

            const savedProject = { id: Date.now().toString(), ...projectData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const data = readProjectsFile();
            data.projects.push(savedProject);
            writeProjectsFile(data);

            res.json({ success: true, message: 'Project added successfully', project: savedProject });
        }
    } catch (error) {
        console.error('POST /api/projects error:', error);
        res.status(500).json({ error: error.message || 'Failed to add project' });
    }
});

// ─── PUT update project by id ─────────────────────────────────────
app.put('/api/projects/:id', async (req, res) => {
    try {
        const updates = req.body;

        if (useDB()) {
            const doc = await Project.findByIdAndUpdate(
                req.params.id,
                {
                    name: updates.name,
                    description: updates.description,
                    category: updates.category,
                    location: updates.location || '',
                    status: updates.status || '',
                    client: updates.client || '',
                    duration: updates.duration || '',
                    area: updates.area || '',
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
            project.name = updates.name || project.name;
            project.description = updates.description ?? project.description;
            project.category = updates.category || project.category;
            project.location = updates.location || '';
            project.status = updates.status || '';
            project.client = updates.client || '';
            project.duration = updates.duration || '';
            project.area = updates.area || '';
            project.type = updates.type || '';
            project.updatedAt = new Date().toISOString();
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
app.delete('/api/projects/:id', async (req, res) => {
    try {
        if (useDB()) {
            const doc = await Project.findByIdAndDelete(req.params.id).lean();
            if (!doc) return res.status(404).json({ error: 'Project not found' });
            // Delete all images for this project from MongoDB
            await Image.deleteMany({ projectId: doc._id });
        } else {
            const data = readProjectsFile();
            const idx = data.projects.findIndex(p => p.id === req.params.id);
            if (idx === -1) return res.status(404).json({ error: 'Project not found' });
            const folder = data.projects[idx].folder;
            data.projects.splice(idx, 1);
            writeProjectsFile(data);

            // Delete folder from disk
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
app.delete('/api/projects/folder/:folderName', async (req, res) => {
    try {
        const folderName = req.params.folderName;

        if (useDB()) {
            const doc = await Project.findOneAndDelete({ folder: folderName }).lean();
            if (doc) {
                await Image.deleteMany({ projectId: doc._id });
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

// ─── POST scan existing image folders (local dev only) ────────────
app.post('/api/projects/scan', async (req, res) => {
    try {
        if (useDB() && !fs.existsSync(IMG_DIR)) {
            return res.json({ success: true, message: 'Scan is for local dev only (no img/ folder on server)', added: [] });
        }

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

        if (!fs.existsSync(IMG_DIR)) return res.json({ success: true, message: 'No img/ folder found', added: [] });

        const dirs = fs.readdirSync(IMG_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory() && !skipFolders.has(d.name) && !existingFolders.has(d.name));

        for (const dir of dirs) {
            const folderPath = path.join(IMG_DIR, dir.name);
            const images = fs.readdirSync(folderPath)
                .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
            if (images.length === 0) continue;

            const mainFile = images.find(f => f.toLowerCase().startsWith('main.'));
            const projectData = {
                name: dir.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                description: '',
                category: 'first',
                folder: dir.name,
                location: '', status: '', client: '', duration: '', area: '', type: '',
                mainImage: mainFile ? `img/${dir.name}/${mainFile}` : `img/${dir.name}/${images[0]}`,
                images: images.map(f => `img/${dir.name}/${f}`)
            };

            if (useDB()) {
                const doc = await Project.create(projectData);
                // Also upload the disk images into MongoDB
                for (let i = 0; i < images.length; i++) {
                    const imgPath = path.join(folderPath, images[i]);
                    const imgBuffer = fs.readFileSync(imgPath);
                    const ext = path.extname(images[i]).toLowerCase();
                    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
                    await Image.create({
                        projectId: doc._id,
                        filename: images[i],
                        contentType: mimeMap[ext] || 'image/jpeg',
                        data: imgBuffer,
                        isMain: images[i] === mainFile || (i === 0 && !mainFile),
                        size: imgBuffer.length
                    });
                }
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

// ─── GET images from a project folder ─────────────────────────────
app.get('/api/projects/:folderName/images', async (req, res) => {
    try {
        const folderName = req.params.folderName;

        if (useDB()) {
            // Find project by folder name, then get its images
            const project = await Project.findOne({ folder: folderName }).lean();
            if (!project) return res.json({ images: [] });

            const dbImages = await Image.find({ projectId: project._id })
                .sort({ isMain: -1, createdAt: 1 })
                .select('_id filename isMain')
                .lean();

            const images = dbImages.map(img => ({
                filename: img.filename,
                path: `/api/images/${img._id}`,
                isMain: img.isMain
            }));

            return res.json({ images });
        }

        // File-based fallback
        const folderPath = path.join(IMG_DIR, folderName);
        if (!fs.existsSync(folderPath)) return res.json({ images: [] });

        const files = fs.readdirSync(folderPath);
        const images = files
            .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()))
            .map(f => ({
                filename: f,
                path: `img/${folderName}/${f}`,
                isMain: f.toLowerCase().startsWith('main.')
            }))
            .sort((a, b) => {
                if (a.isMain && !b.isMain) return -1;
                if (!a.isMain && b.isMain) return 1;
                return a.filename.localeCompare(b.filename);
            });

        res.json({ images });
    } catch (error) {
        console.error('GET images error:', error);
        res.status(500).json({ error: 'Failed to read images' });
    }
});

// ─── POST upload images to a project folder ───────────────────────
app.post('/api/projects/:folderName/images', dynamicUpload('images', 20), async (req, res) => {
    try {
        const folderName = req.params.folderName;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        if (useDB()) {
            // Find project
            const project = await Project.findOne({ folder: folderName }).lean();
            if (!project) return res.status(404).json({ error: 'Project not found' });

            const uploaded = [];
            for (const file of req.files) {
                const imgDoc = await Image.create({
                    projectId: project._id,
                    filename: file.originalname,
                    contentType: file.mimetype,
                    data: file.buffer,
                    isMain: false,
                    size: file.size
                });
                uploaded.push({
                    filename: file.originalname,
                    path: `/api/images/${imgDoc._id}`,
                    isMain: false
                });
            }

            return res.json({ success: true, images: uploaded });
        }

        // File-based fallback
        const uploaded = req.files.map(file => ({
            filename: file.filename,
            path: `img/${folderName}/${file.filename}`,
            isMain: file.filename.toLowerCase().includes('main')
        }));
        res.json({ success: true, images: uploaded });
    } catch (error) {
        console.error('Upload images error:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// ─── DELETE a single image ────────────────────────────────────────
app.delete('/api/projects/:folderName/images/:filename', async (req, res) => {
    try {
        const { folderName, filename } = req.params;

        if (useDB()) {
            // filename could be a MongoDB image _id or an actual filename
            const project = await Project.findOne({ folder: folderName }).lean();
            if (!project) return res.status(404).json({ error: 'Project not found' });

            // Try to find by _id first, then by filename
            let deleted;
            if (filename.match(/^[0-9a-fA-F]{24}$/)) {
                deleted = await Image.findOneAndDelete({ _id: filename, projectId: project._id });
            }
            if (!deleted) {
                deleted = await Image.findOneAndDelete({ filename: filename, projectId: project._id });
            }
            if (!deleted) return res.status(404).json({ error: 'Image not found' });

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

// ─── PUT set main image ───────────────────────────────────────────
app.put('/api/projects/:folderName/images/:filename/set-main', async (req, res) => {
    try {
        const { folderName, filename } = req.params;

        if (useDB()) {
            const project = await Project.findOne({ folder: folderName }).lean();
            if (!project) return res.status(404).json({ error: 'Project not found' });

            // Unset all isMain flags for this project
            await Image.updateMany({ projectId: project._id }, { isMain: false });

            // Set the selected image as main (try by _id first, then filename)
            let updated;
            if (filename.match(/^[0-9a-fA-F]{24}$/)) {
                updated = await Image.findOneAndUpdate(
                    { _id: filename, projectId: project._id },
                    { isMain: true },
                    { new: true }
                );
            }
            if (!updated) {
                updated = await Image.findOneAndUpdate(
                    { filename: filename, projectId: project._id },
                    { isMain: true },
                    { new: true }
                );
            }
            if (!updated) return res.status(404).json({ error: 'Image not found' });

            return res.json({
                success: true,
                message: 'Main image updated',
                mainImage: `/api/images/${updated._id}`
            });
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

// ─── Health check ─────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
    let imageCount = 0;
    if (useDB()) {
        try { imageCount = await Image.countDocuments(); } catch {}
    }
    res.json({
        status: 'ok',
        message: 'Server is running',
        database: useDB() ? 'mongodb' : 'file',
        imageStorage: useDB() ? 'mongodb' : 'disk',
        imageCount
    });
});

// ─── Seed DB from projects.json on first run ──────────────────────
async function seedDBFromFile() {
    if (!useDB()) return;
    const count = await Project.countDocuments();
    if (count > 0) return; // already seeded

    const data = readProjectsFile();
    if (data.projects.length === 0) return;

    console.log('🌱 Seeding MongoDB from projects.json...');
    for (const p of data.projects) {
        try {
            const doc = await Project.create({
                name: p.name, description: p.description || '', category: p.category || 'first',
                folder: p.folder, location: p.location || '', status: p.status || '',
                client: p.client || '', duration: p.duration || '', area: p.area || '',
                type: p.type || '', mainImage: p.mainImage || '', images: p.images || []
            });

            // Also seed images from disk into MongoDB if they exist
            const folderPath = path.join(IMG_DIR, p.folder);
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath)
                    .filter(f => IMAGE_EXTS.includes(path.extname(f).toLowerCase()));
                for (let i = 0; i < files.length; i++) {
                    const imgPath = path.join(folderPath, files[i]);
                    const imgBuffer = fs.readFileSync(imgPath);
                    const ext = path.extname(files[i]).toLowerCase();
                    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
                    const isMain = files[i].toLowerCase().startsWith('main.');
                    await Image.create({
                        projectId: doc._id,
                        filename: files[i],
                        contentType: mimeMap[ext] || 'image/jpeg',
                        data: imgBuffer,
                        isMain: isMain || (i === 0),
                        size: imgBuffer.length
                    });
                }
                console.log(`  📸 Uploaded ${files.length} images for "${p.folder}"`);
            }
        } catch (err) {
            console.warn('  Seed skip (duplicate?):', p.folder, err.message);
        }
    }
    console.log('✅ Seeded', data.projects.length, 'projects into MongoDB');
}

// ─── Start server ─────────────────────────────────────────────────
async function start() {
    await connectDB();
    await seedDBFromFile();

    app.listen(PORT, () => {
        console.log(`\n✅ Server running on http://localhost:${PORT}`);
        console.log(`📦 Storage: ${useDB() ? 'MongoDB Atlas (data + images)' : 'Local file (projects.json + disk images)'}`);
        console.log(`🚀 Open http://localhost:${PORT}/portfolio.html\n`);
    });
}

start();

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});
