import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router  = express.Router();
const GALLERY = path.resolve(__dirname, '../../../public/gallery');

// ── Safety: resolve & validate path stays inside GALLERY ─────
function safePath(rel = '') {
  const resolved = path.resolve(GALLERY, rel.replace(/^\/+/, ''));
  if (!resolved.startsWith(GALLERY)) throw Object.assign(new Error('Forbidden path'), { status: 403 });
  return resolved;
}

// ── Multer: upload to arbitrary gallery folder ───────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dest = safePath(req.query.path || '');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const ok = [
      'image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml',
      'video/mp4','video/webm','video/quicktime',
    ];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported type: ${file.mimetype}`));
  },
});

// ── GET /api/gallery?path=subfolder/nested ───────────────────
// Returns { path, breadcrumbs, folders, files }
router.get('/', (req, res, next) => {
  try {
    const rel  = (req.query.path || '').replace(/^\/+|\/+$/g, '');
    const dir  = safePath(rel);

    fs.mkdirSync(dir, { recursive: true });

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        name:     e.name,
        path:     rel ? `${rel}/${e.name}` : e.name,
        type:     'folder',
        modified: fs.statSync(path.join(dir, e.name)).mtime,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const files = entries
      .filter(e => e.isFile())
      .map(e => {
        const stat = fs.statSync(path.join(dir, e.name));
        const ext  = path.extname(e.name).toLowerCase().slice(1);
        const isVideo = ['mp4','webm','mov'].includes(ext);
        const filePath = rel ? `${rel}/${e.name}` : e.name;
        return {
          name:     e.name,
          path:     filePath,
          url:      `/gallery/${filePath}`,
          type:     isVideo ? 'video' : 'image',
          size:     stat.size,
          modified: stat.mtime,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Breadcrumbs
    const parts  = rel ? rel.split('/') : [];
    const breadcrumbs = [{ name: 'Gallery', path: '' }];
    parts.reduce((acc, part) => {
      const p = acc ? `${acc}/${part}` : part;
      breadcrumbs.push({ name: part, path: p });
      return p;
    }, '');

    res.json({ path: rel, breadcrumbs, folders, files });
  } catch (err) { next(err); }
});

// ── POST /api/gallery/folder ─────────────────────────────────
// Body: { path: 'parent/folder', name: 'new-folder' }
router.post('/folder', (req, res, next) => {
  try {
    const { path: parent = '', name } = req.body;
    if (!name || /[/\\<>:"|?*]/.test(name)) return res.status(400).json({ error: 'Invalid folder name' });
    const dir = safePath(parent ? `${parent}/${name}` : name);
    if (fs.existsSync(dir)) return res.status(409).json({ error: 'Folder already exists' });
    fs.mkdirSync(dir, { recursive: true });
    res.status(201).json({ message: 'Folder created', path: parent ? `${parent}/${name}` : name });
  } catch (err) { next(err); }
});

// ── DELETE /api/gallery/folder ───────────────────────────────
// Body: { path: 'folder/to/delete' }
router.delete('/folder', (req, res, next) => {
  try {
    const dir = safePath(req.body.path);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Folder not found' });
    fs.rmSync(dir, { recursive: true, force: true });
    res.json({ message: 'Folder deleted' });
  } catch (err) { next(err); }
});

// ── DELETE /api/gallery/file ─────────────────────────────────
// Body: { path: 'folder/image.jpg' }
router.delete('/file', (req, res, next) => {
  try {
    const file = safePath(req.body.path);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
    fs.unlinkSync(file);
    res.json({ message: 'File deleted' });
  } catch (err) { next(err); }
});

// ── PATCH /api/gallery/rename ────────────────────────────────
// Body: { path: 'folder/old.jpg', name: 'new.jpg' }
router.patch('/rename', (req, res, next) => {
  try {
    const { path: relPath, name } = req.body
    if (!name || /[/\\<>:"|?*]/.test(name)) return res.status(400).json({ error: 'Invalid name' })
    const oldAbs = safePath(relPath)
    if (!fs.existsSync(oldAbs)) return res.status(404).json({ error: 'Not found' })

    // Preserve original extension for files (prevent type change)
    const isDir   = fs.statSync(oldAbs).isDirectory()
    const origExt = isDir ? '' : path.extname(oldAbs)          // e.g. '.jpg'
    const newBase = path.basename(name, path.extname(name))     // strip any ext user supplied
    const finalName = isDir ? name : newBase + origExt

    const newAbs = path.join(path.dirname(oldAbs), finalName)
    if (fs.existsSync(newAbs)) return res.status(409).json({ error: 'Name already taken' })
    fs.renameSync(oldAbs, newAbs)
    const newRel = path.join(path.dirname(relPath), finalName).replace(/\\/g, '/')
    res.json({ message: 'Renamed', path: newRel })
  } catch (err) { next(err) }
});

// ── PATCH /api/gallery/move ──────────────────────────────────
// Body: { path: 'old/location/item', dest: 'new/parent/folder' }
router.patch('/move', (req, res, next) => {
  try {
    const { path: relPath, dest } = req.body;
    const srcAbs  = safePath(relPath);
    if (!fs.existsSync(srcAbs)) return res.status(404).json({ error: 'Source not found' });
    const destDir = safePath(dest || '');
    fs.mkdirSync(destDir, { recursive: true });
    const destAbs = path.join(destDir, path.basename(srcAbs));
    if (fs.existsSync(destAbs)) return res.status(409).json({ error: 'Destination already has an item with that name' });
    fs.renameSync(srcAbs, destAbs);
    const newRel = (dest ? `${dest}/` : '') + path.basename(srcAbs);
    res.json({ message: 'Moved', path: newRel });
  } catch (err) { next(err); }
});

// ── POST /api/gallery/upload?path=subfolder ──────────────────
router.post('/upload', upload.array('files', 50), (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
    const rel = (req.query.path || '').replace(/^\/+|\/+$/g, '');
    const uploaded = req.files.map(f => ({
      name: f.filename,
      path: rel ? `${rel}/${f.filename}` : f.filename,
      url:  `/gallery/${rel ? rel + '/' : ''}${f.filename}`,
      size: f.size,
    }));
    res.status(201).json({ data: uploaded });
  } catch (err) { next(err); }
});

export default router;
