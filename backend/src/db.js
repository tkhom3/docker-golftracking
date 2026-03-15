const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'golftracking.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  const version = db.pragma('user_version', { simple: true });

  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        shot_number INTEGER,
        club TEXT NOT NULL,
        carry REAL,
        total_distance REAL,
        ball_speed REAL,
        club_speed REAL,
        smash_factor REAL,
        back_spin REAL,
        side_spin REAL,
        hla REAL,
        vla REAL,
        offline REAL,
        peak_height REAL,
        path REAL,
        aoa REAL,
        face_to_target REAL,
        face_to_path REAL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      PRAGMA user_version = 1;
    `);
  }
}

migrate();

module.exports = db;
