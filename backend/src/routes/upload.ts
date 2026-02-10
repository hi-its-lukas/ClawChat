import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { query } from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.md', '.zip'];

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  },
});

const router = Router();

// POST /api/upload - Upload file attached to a message
router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { message_id } = req.body;
    if (!message_id) {
      return res.status(400).json({ error: 'message_id is required' });
    }

    const result = await query(
      `INSERT INTO attachments (message_id, filename, file_path, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [message_id, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype]
    );

    // Mark message as having attachments
    await query('UPDATE messages SET has_attachments = true WHERE id = $1', [message_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/upload/:id - Download file
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM attachments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const attachment = result.rows[0];
    const filePath = path.join(UPLOAD_DIR, attachment.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

export default router;
