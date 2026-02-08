const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { Project, connectDB, useDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Enrich a project with live images from disk
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

// ─── Multer setup ─────────────────────────────────────────────────
const storage = multer.diskStorage({
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

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase());
        cb(ok ? null : new Error('Only image files allowed!'), ok);
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
            projects = await Project.find().lean();
            projects = projects.map(p => {
                p.id = p._id.toString();
                delete p._id;
                delete p.__v;
                return enrichWithDiskImages(p);
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
app.post('/api/projects', upload.array('projectImages', 10), async (req, res) => {
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

        let savedProject;

        if (useDB()) {
            const doc = new Project(projectData);
            savedProject = (await doc.save()).toObject();
            savedProject.id = savedProject._id.toString();
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
        let folder;

        if (useDB()) {
            const doc = await Project.findByIdAndDelete(req.params.id).lean();
            if (!doc) return res.status(404).json({ error: 'Project not found' });
            folder = doc.folder;
        } else {
            const data = readProjectsFile();
            const idx = data.projects.findIndex(p => p.id === req.params.id);
            if (idx === -1) return res.status(404).json({ error: 'Project not found' });
            folder = data.projects[idx].folder;
            data.projects.splice(idx, 1);
            writeProjectsFile(data);
        }

        const folderPath = path.join(IMG_DIR, folder);
        if (fs.existsSync(folderPath)) {
            fs.readdirSync(folderPath).forEach(f => fs.unlinkSync(path.join(folderPath, f)));
            fs.rmdirSync(folderPath);
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
            await Project.deleteOne({ folder: folderName });
        } else {
            const data = readProjectsFile();
            data.projects = data.projects.filter(p => p.folder !== folderName);
            writeProjectsFile(data);
        }

        const folderPath = path.join(IMG_DIR, folderName);
        if (fs.existsSync(folderPath)) {
            fs.readdirSync(folderPath).forEach(f => fs.unlinkSync(path.join(folderPath, f)));
            fs.rmdirSync(folderPath);
        }

        res.json({ success: true, message: 'Project folder deleted successfully' });
    } catch (error) {
        console.error('DELETE /api/projects/folder error:', error);
        res.status(500).json({ error: 'Failed to delete project folder' });
    }
});

// ─── POST scan existing image folders ─────────────────────────────
app.post('/api/projects/scan', async (req, res) => {
    try {
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

// ─── GET images from a project folder ─────────────────────────────
app.get('/api/projects/:folderName/images', (req, res) => {
    try {
        const folderName = req.params.folderName;
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
app.post('/api/projects/:folderName/images', upload.array('images', 20), (req, res) => {
    try {
        const folderName = req.params.folderName;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }
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
app.delete('/api/projects/:folderName/images/:filename', (req, res) => {
    try {
        const { folderName, filename } = req.params;
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
app.put('/api/projects/:folderName/images/:filename/set-main', (req, res) => {
    try {
        const { folderName, filename } = req.params;
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
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running', database: useDB() ? 'mongodb' : 'file' });
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
            await Project.create({
                name: p.name, description: p.description || '', category: p.category || 'first',
                folder: p.folder, location: p.location || '', status: p.status || '',
                client: p.client || '', duration: p.duration || '', area: p.area || '',
                type: p.type || '', mainImage: p.mainImage || '', images: p.images || []
            });
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
        console.log(`📦 Storage: ${useDB() ? 'MongoDB Atlas' : 'Local file (projects.json)'}`);
        console.log(`🚀 Open http://localhost:${PORT}/portfolio.html\n`);
    });
}

start();

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});
