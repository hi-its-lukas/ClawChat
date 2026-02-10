import { Request, Response, NextFunction } from 'express';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = purify.sanitize(req.body[key]);
      }
    }
  }
  next();
}

export function validateRequired(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const field of fields) {
      if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
        return res.status(400).json({ error: `Field "${field}" is required` });
      }
    }
    next();
  };
}
