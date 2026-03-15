const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/sessions
router.get('/', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.*, COUNT(sh.id) as shot_count
    FROM sessions s
    LEFT JOIN shots sh ON sh.session_id = s.id
    GROUP BY s.id
    ORDER BY s.date DESC, s.created_at DESC
  `).all();
  res.json(sessions);
});

// POST /api/sessions
router.post('/', (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'name and date required' });
  const result = db.prepare('INSERT INTO sessions (name, date) VALUES (?, ?)').run(name, date);
  res.json({ id: result.lastInsertRowid, name, date, shot_count: 0 });
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
