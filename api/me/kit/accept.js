import custodyHandler from './custody.js';

export default function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : { ...(req.body || {}) };
      req.body = { ...body, action: 'accept' };
    } catch { return res.status(400).json({ error: 'Request body must be valid JSON.', code: 'invalid_json' }); }
  }
  return custodyHandler(req, res);
}
