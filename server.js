const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the project root
app.use(express.static(__dirname));

// Projects data file
const PROJECTS_FILE = path.join(__dirname, 'projects.json');

// Initialize projects file if it doesn't exist
if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects: [] }, null, 2));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const folderName = req.body.projectFolder;
        const uploadPath = path.join(__dirname, 'img', folderName);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // First image is main.jpg, others keep original names
        const files = req.files || [];
        const isFirstImage = files.indexOf(file) === 0;
        
        if (isFirstImage) {
            const ext = path.extname(file.originalname);
            cb(null, 'main' + ext);
        } else {
            cb(null, file.originalname);
        }
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// API Routes

// Get all projects (with live image list from disk)
app.get('/api/projects', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

        // Enrich each project with its actual images from disk
        data.projects = data.projects.map(project => {
            const folderPath = path.join(__dirname, 'img', project.folder);
            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath)
                    .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));
                project.images = files.map(f => `img/${project.folder}/${f}`);

                // Ensure mainImage points to a file that actually exists
                const mainFile = files.find(f => f.toLowerCase().startsWith('main.'));
                if (mainFile) {
                    project.mainImage = `img/${project.folder}/${mainFile}`;
                } else if (files.length > 0) {
                    project.mainImage = `img/${project.folder}/${files[0]}`;
                }
            }
            return project;
        });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read projects' });
    }
});

// Scan existing image folders and add any that are missing from projects.json
app.post('/api/projects/scan', (req, res) => {
    try {
        const imgDir = path.join(__dirname, 'img');
        const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        const existingFolders = new Set(data.projects.map(p => p.folder));
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const added = [];

        // Skip these known non-project folders
        const skipFolders = new Set(['myPics', 'Sai Manikanta Construction']);

        fs.readdirSync(imgDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && !skipFolders.has(d.name) && !existingFolders.has(d.name))
            .forEach(dir => {
                const folderPath = path.join(imgDir, dir.name);
                const images = fs.readdirSync(folderPath)
                    .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()));
                if (images.length === 0) return; // skip empty folders

                const mainFile = images.find(f => f.toLowerCase().startsWith('main.'));
                const newProject = {
                    id: 'scan-' + Date.now() + '-' + dir.name,
                    name: dir.name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    description: '',
                    category: 'first',
                    folder: dir.name,
                    location: '',
                    status: '',
                    client: '',
                    duration: '',
                    area: '',
                    type: '',
                    mainImage: mainFile ? `img/${dir.name}/${mainFile}` : `img/${dir.name}/${images[0]}`,
                    images: images.map(f => `img/${dir.name}/${f}`),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                data.projects.push(newProject);
                added.push(dir.name);
            });

        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true, message: `Scanned and added ${added.length} folder(s)`, added });
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: 'Failed to scan folders' });
    }
});

// Add new project
app.post('/api/projects', upload.array('projectImages', 10), (req, res) => {
    try {
        const { 
            projectName, 
            projectDescription, 
            projectCategory, 
            projectFolder,
            projectLocation,
            projectStatus,
            projectClient,
            projectDuration,
            projectArea,
            projectType
        } = req.body;
        
        // Validate required fields
        if (!projectName || !projectCategory || !projectFolder) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }
        
        // Read existing projects
        const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        
        // Create new project object
        const newProject = {
            id: Date.now().toString(),
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
            images: req.files.map(file => `img/${projectFolder}/${file.filename}`),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Add to projects array
        data.projects.push(newProject);
        
        // Save to file
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Project added successfully',
            project: newProject
        });
        
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ error: error.message || 'Failed to add project' });
    }
});

// Delete project folder by folderName (for static/hardcoded projects)
app.delete('/api/projects/folder/:folderName', (req, res) => {
    try {
        const folderName = req.params.folderName;
        const folderPath = path.join(__dirname, 'img', folderName);

        // Also remove from projects.json if present
        const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        const beforeLen = data.projects.length;
        data.projects = data.projects.filter(p => p.folder !== folderName);
        if (data.projects.length !== beforeLen) {
            fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
        }

        // Delete image folder
        if (fs.existsSync(folderPath)) {
            const files = fs.readdirSync(folderPath);
            files.forEach(file => {
                fs.unlinkSync(path.join(folderPath, file));
            });
            fs.rmdirSync(folderPath);
            console.log('✅ Deleted folder:', folderPath);
        }

        res.json({ success: true, message: 'Project folder deleted successfully' });
    } catch (error) {
        console.error('Error deleting project folder:', error);
        res.status(500).json({ error: 'Failed to delete project folder' });
    }
});

// Delete project by id
app.delete('/api/projects/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        
        // Read existing projects
        const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        
        // Find project
        const projectIndex = data.projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const project = data.projects[projectIndex];
        const folderPath = path.join(__dirname, 'img', project.folder);
        
        // Delete project folder and all images
        if (fs.existsSync(folderPath)) {
            try {
                // Delete all files in the folder first
                const files = fs.readdirSync(folderPath);
                files.forEach(file => {
                    fs.unlinkSync(path.join(folderPath, file));
                });
                // Delete the folder
                fs.rmdirSync(folderPath);
                console.log(`✅ Deleted folder: ${folderPath}`);
            } catch (error) {
                console.error('Error deleting folder:', error);
            }
        }
        
        // Remove from array
        data.projects.splice(projectIndex, 1);
        
        // Save to file
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Project and folder deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Update project
app.put('/api/projects/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        const updates = req.body;
        
        // Read existing projects
        const data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
        
        // Find project
        const projectIndex = data.projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Update project fields
        const project = data.projects[projectIndex];
        project.name = updates.name || project.name;
        project.description = updates.description || project.description;
        project.category = updates.category || project.category;
        project.location = updates.location || '';
        project.status = updates.status || '';
        project.client = updates.client || '';
        project.duration = updates.duration || '';
        project.area = updates.area || '';
        project.type = updates.type || '';
        project.updatedAt = new Date().toISOString();
        
        data.projects[projectIndex] = project;
        
        // Save to file
        fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
        
        res.json({
            success: true,
            message: 'Project updated successfully',
            project: project
        });
        
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Upload images to an existing project folder
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
        console.error('Error uploading images:', error);
        res.status(500).json({ error: 'Failed to upload images' });
    }
});

// Delete a single image from a project folder
app.delete('/api/projects/:folderName/images/:filename', (req, res) => {
    try {
        const { folderName, filename } = req.params;
        const filePath = path.join(__dirname, 'img', folderName, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Set an image as main image for a project folder
app.put('/api/projects/:folderName/images/:filename/set-main', (req, res) => {
    try {
        const { folderName, filename } = req.params;
        const folderPath = path.join(__dirname, 'img', folderName);
        const srcPath = path.join(folderPath, filename);
        const ext = path.extname(filename);
        const mainPath = path.join(folderPath, 'main' + ext);

        if (!fs.existsSync(srcPath)) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Remove existing main image(s)
        const files = fs.readdirSync(folderPath);
        files.forEach(f => {
            if (f.toLowerCase().startsWith('main.')) {
                fs.unlinkSync(path.join(folderPath, f));
            }
        });

        // Copy selected image as main
        fs.copyFileSync(srcPath, mainPath);

        res.json({ success: true, message: 'Main image updated', mainImage: `img/${folderName}/main${ext}` });
    } catch (error) {
        console.error('Error setting main image:', error);
        res.status(500).json({ error: 'Failed to set main image' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Get images from a project folder
app.get('/api/projects/:folderName/images', (req, res) => {
    try {
        const folderName = req.params.folderName;
        const folderPath = path.join(__dirname, 'img', folderName);
        
        // Check if folder exists
        if (!fs.existsSync(folderPath)) {
            return res.json({ images: [] });
        }
        
        // Read all files in the folder
        const files = fs.readdirSync(folderPath);
        
        // Filter only image files
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const images = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
        }).map(file => ({
            filename: file,
            path: `img/${folderName}/${file}`,
            isMain: file.toLowerCase().includes('main')
        }));
        
        // Sort images - main images first
        images.sort((a, b) => {
            if (a.isMain && !b.isMain) return -1;
            if (!a.isMain && b.isMain) return 1;
            return a.filename.localeCompare(b.filename);
        });
        
        res.json({ images: images });
    } catch (error) {
        console.error('Error reading folder:', error);
        res.status(500).json({ error: 'Failed to read images' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n✅ Server is running on http://localhost:${PORT}`);
    console.log(`📁 Projects file: ${PROJECTS_FILE}`);
    console.log(`🖼️  Images folder: ${path.join(__dirname, 'img')}`);
    console.log(`\n🚀 Open http://localhost:${PORT}/portfolio.html to access the website\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...');
    process.exit(0);
});
