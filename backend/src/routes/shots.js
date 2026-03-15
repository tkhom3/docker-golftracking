const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/shots?session_id=&club=
router.get('/', (req, res) => {
  const { session_id, club } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  let query = 'SELECT * FROM shots WHERE session_id = ?';
  const params = [session_id];

  if (club) {
    const clubs = club.split(',').map(c => c.trim()).filter(Boolean);
    if (clubs.length === 1) {
      query += ' AND club = ?';
      params.push(clubs[0]);
    } else if (clubs.length > 1) {
      query += ` AND club IN (${clubs.map(() => '?').join(',')})`;
      params.push(...clubs);
    }
  }

  query += ' ORDER BY shot_number';
  res.json(db.prepare(query).all(...params));
});

module.exports = router;
