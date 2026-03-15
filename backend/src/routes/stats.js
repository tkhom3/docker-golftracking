const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/stats/clubs?session_id=
// Per-club averages for a specific session
router.get('/clubs', (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const stats = db.prepare(`
    SELECT
      club,
      COUNT(*) as shot_count,
      ROUND(AVG(carry), 1) as avg_carry,
      ROUND(AVG(total_distance), 1) as avg_total,
      ROUND(MIN(carry), 1) as min_carry,
      ROUND(MAX(carry), 1) as max_carry,
      ROUND(AVG(ball_speed), 1) as avg_ball_speed,
      ROUND(AVG(club_speed), 1) as avg_club_speed,
      ROUND(AVG(smash_factor), 3) as avg_smash_factor,
      ROUND(AVG(offline), 1) as avg_offline,
      ROUND(SQRT(MAX(0, AVG(offline * offline) - AVG(offline) * AVG(offline))), 1) as std_offline,
      ROUND(AVG(back_spin), 0) as avg_back_spin,
      ROUND(AVG(side_spin), 0) as avg_side_spin,
      ROUND(AVG(hla), 1) as avg_hla,
      ROUND(AVG(vla), 1) as avg_vla,
      ROUND(AVG(peak_height), 1) as avg_peak_height,
      ROUND(AVG(path), 1) as avg_path,
      ROUND(AVG(aoa), 1) as avg_aoa,
      ROUND(AVG(face_to_target), 1) as avg_face_to_target,
      ROUND(AVG(face_to_path), 1) as avg_face_to_path
    FROM shots
    WHERE session_id = ?
    GROUP BY club
    ORDER BY avg_carry DESC
  `).all(session_id);

  res.json(stats);
});

// GET /api/stats/progress
// Per-club, per-session averages across all sessions (for trend charts)
router.get('/progress', (req, res) => {
  const stats = db.prepare(`
    SELECT
      s.id as session_id,
      s.name as session_name,
      s.date as session_date,
      sh.club,
      COUNT(*) as shot_count,
      ROUND(AVG(sh.carry), 1) as avg_carry,
      ROUND(AVG(sh.total_distance), 1) as avg_total,
      ROUND(SQRT(MAX(0, AVG(sh.offline * sh.offline) - AVG(sh.offline) * AVG(sh.offline))), 1) as std_offline
    FROM shots sh
    JOIN sessions s ON s.id = sh.session_id
    GROUP BY s.id, sh.club
    ORDER BY s.date, s.id, sh.club
  `).all();

  res.json(stats);
});

module.exports = router;
