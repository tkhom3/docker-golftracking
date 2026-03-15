const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim(); });
      return row;
    });
}

function rowToShot(row) {
  const ballSpeed = parseNum(row.BallSpeed);
  const clubSpeed = parseNum(row.ClubSpeed);
  const smashFactor = (ballSpeed && clubSpeed && clubSpeed > 0)
    ? Math.round((ballSpeed / clubSpeed) * 1000) / 1000
    : null;

  return {
    shot_number: parseInt(row.Shot) || null,
    club: row.Club || 'Unknown',
    carry: parseNum(row.Carry),
    total_distance: parseNum(row.TotalDistance),
    ball_speed: ballSpeed,
    club_speed: clubSpeed,
    smash_factor: smashFactor,
    back_spin: parseNum(row.BackSpin),
    side_spin: parseNum(row.SideSpin),
    hla: parseNum(row.HLA),
    vla: parseNum(row.VLA),
    offline: parseNum(row.Offline),
    peak_height: parseNum(row.PeakHeight),
    path: parseNum(row.Path),
    aoa: parseNum(row.AoA),
    face_to_target: parseNum(row.FaceToTarget),
    face_to_path: parseNum(row.FaceToPath),
  };
}

// POST /api/upload
// Body: multipart/form-data with fields: file (CSV), name, date
// Optional: session_id to add shots to an existing session instead of creating a new one
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { name, date, session_id } = req.body;

  let rows;
  try {
    rows = parseCSV(req.file.buffer.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Failed to parse CSV' });
  }

  if (rows.length === 0) return res.status(400).json({ error: 'CSV contains no shot data' });

  const insertShot = db.prepare(`
    INSERT INTO shots
      (session_id, shot_number, club, carry, total_distance, ball_speed, club_speed,
       smash_factor, back_spin, side_spin, hla, vla, offline, peak_height,
       path, aoa, face_to_target, face_to_path)
    VALUES
      (@session_id, @shot_number, @club, @carry, @total_distance, @ball_speed, @club_speed,
       @smash_factor, @back_spin, @side_spin, @hla, @vla, @offline, @peak_height,
       @path, @aoa, @face_to_target, @face_to_path)
  `);

  const doInsert = db.transaction((sid) => {
    for (const row of rows) {
      const shot = rowToShot(row);
      insertShot.run({ session_id: sid, ...shot });
    }
  });

  try {
    let sid = session_id ? parseInt(session_id) : null;

    if (!sid) {
      if (!name || !date) return res.status(400).json({ error: 'name and date required when creating a new session' });
      const result = db.prepare('INSERT INTO sessions (name, date) VALUES (?, ?)').run(name, date);
      sid = result.lastInsertRowid;
    } else {
      const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(sid);
      if (!session) return res.status(404).json({ error: 'Session not found' });
    }

    doInsert(sid);

    const session = db.prepare(`
      SELECT s.*, COUNT(sh.id) as shot_count
      FROM sessions s LEFT JOIN shots sh ON sh.session_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `).get(sid);

    res.json(session);
  } catch (e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: 'Failed to save shots' });
  }
});

module.exports = router;
