# docker-golftracking — AI Assistant Guide

## Architecture

Single Docker container running one process under supervisord:

| Process | Language | Entry point | Role |
|---------|----------|-------------|------|
| `app` | Node.js / Express 5 | `backend/src/index.js` | REST API + serves React SPA |

Shared SQLite database at `/app/data/golftracking.db` (persisted volume).

Frontend is a React 19 / Vite SPA built at image build time and served as static files by the Express backend. There is no separate frontend server in production.

---

## Project Structure

```
backend/src/
  index.js          # Express entry point, mounts routes, starts backup scheduler
  db.js             # better-sqlite3 instance, migrations
  backup.js         # Weekly scheduled hot-backup logic
  routes/
    sessions.js     # CRUD for sessions
    shots.js        # Read shots (filter by session)
    upload.js       # CSV parse + insert (multer)
    stats.js        # Aggregation queries (clubs, progress)

frontend/src/
  App.jsx           # Tab routing (hash-based), session selector
  utils.js          # getClubColor, sortByClub, getShotShape, CLUB_ORDER
  components/
    Sessions.jsx    # Upload form, session list, delete
    ClubStats.jsx   # Per-club averages + charts
    SwingStats.jsx  # Swing metric charts + shot shape distribution
    Dispersion.jsx  # Scatter chart, ellipses, box plot, metrics scatter
    Progress.jsx    # Cross-session trend lines + table

supervisord.conf    # Runs `app` as user `golf`, logs to stdout/stderr
entrypoint.sh       # PUID/PGID remapping → exec supervisord
Dockerfile          # 3-stage: frontend build → backend build → final
```

---

## Database Migrations

`db.js` owns the schema entirely. Migrations are versioned via `PRAGMA user_version`.

### To add a new migration

Open `backend/src/db.js` and increment the version check:

```js
if (version < 2) {
  db.exec('ALTER TABLE shots ADD COLUMN new_col REAL');
  db.pragma('user_version = 2');
}
```

Rules:
1. **Never modify an existing migration block** — only add new `if (version < N)` blocks
2. **Always update `user_version`** at the end of each block
3. **Wrap multi-statement migrations** in `db.transaction(...)()` if atomicity matters
4. **`smash_factor` is derived** — computed in `upload.js` as `ballSpeed / clubSpeed`, never stored raw from CSV

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | All sessions with shot count |
| POST | `/api/sessions` | Create session (`name`, `date`) |
| DELETE | `/api/sessions/:id` | Delete session + cascade shots |
| GET | `/api/shots` | Shots for a session (`?session_id=`) |
| POST | `/api/upload` | Upload CSV — creates or appends to session |
| GET | `/api/stats/clubs` | Per-club averages for a session (`?session_id=`) |
| GET | `/api/stats/progress` | Per-club per-session averages across all sessions |

Rate limiting: 200 requests / 60s on all `/api/` routes.

---

## Frontend Routing

Tab navigation uses **hash-based routing** (no router library). `App.jsx` maps tab names to URL hashes:

| Tab | Hash |
|-----|------|
| Sessions | `#sessions` |
| Club Stats | `#club-stats` |
| Swing Stats | `#swing-stats` |
| Dispersion | `#dispersion` |
| Progress | `#progress` |

`window.location.hash` is read on load and updated on navigation. A `hashchange` listener handles browser back/forward.

---

## Club Ordering & Colours

`frontend/src/utils.js` is the single source of truth for club display.

- `CLUB_ORDER` — canonical sort order from wedges to driver (LW → DR)
- `getClubColor(club)` — returns a consistent hex colour per club
- `sortByClub(items, key)` — sorts any array by the canonical club order

**Always use these utilities** when displaying clubs. Do not hardcode colours or sort order elsewhere.

---

## Shot Shape Logic

`getShotShape(face_to_target, face_to_path)` in `utils.js` implements the D-Plane model:

- **`face_to_target`** — starting direction: `> +2°` = push (right), `< −2°` = pull (left)
- **`face_to_path`** — curve: `> +2°` = fade/slice, `< −2°` = draw/hook, `> +7°` = slice, `< −7°` = hook

Returns a string like `"Straight"`, `"Draw"`, `"Push-Fade"`, `"Pull-Hook"`, etc., or `null` if either input is null.

Used in:
- `Dispersion.jsx` — per-shot Shape column in the shot table
- `SwingStats.jsx` — Shape column in the averages table + Shot Shape Distribution pie chart

---

## Dispersion Chart — Ellipses

`ClubEllipses` in `Dispersion.jsx` draws a 95%-confidence ellipse for each club using a 2×2 covariance matrix in **pixel space** (so x/y scale differences are handled automatically).

It uses **Recharts v3 hooks** — `useXAxisScale()` and `useYAxisScale()` — which must be called inside a component rendered as a direct child of a Recharts chart. Do **not** wrap it in `<Customized>` (deprecated in v3 and no longer injects axis maps).

The ellipse size is controlled by `k = 1.5` (≈1.5 standard deviations). Changing `k` makes ellipses larger or smaller.

---

## Automatic Backups

`backend/src/backup.js` schedules a weekly hot-backup using `db.backup(dest)` from better-sqlite3 (safe while the app is running — no locking).

Configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DAY` | `sunday` | Day name or number (0=Sunday) |
| `BACKUP_TIME` | `00:00` | 24-hour `HH:MM` |
| `BACKUP_KEEP` | `4` | Files to retain; oldest pruned automatically |

Backup files: `/app/data/backups/golftracking_YYYY-MM-DD_HH-MM-SS.db`

`scheduleNext()` uses `setTimeout` (not `setInterval`) so it self-corrects after each run. On first start it runs immediately if no backup file exists yet.

---

## Recharts Version

The project uses **Recharts 3.x**. Key differences from v2:

- `Customized` is deprecated — render custom SVG components directly as children of chart components instead
- Use `useXAxisScale()` / `useYAxisScale()` hooks to access axis scale functions inside chart children
- `Legend` `onClick` receives `data.dataKey` for line/bar series and `data.value` for scatter series

---

## CSV Upload

`upload.js` handles multipart form data via multer (10 MB limit, memory storage).

- Smash factor is **calculated** (`ballSpeed / clubSpeed`), not read from CSV
- All numeric fields use `parseFloat` — invalid/missing values become `null`
- Upload can **create a new session** (requires `name` + `date` fields) or **append to an existing session** (requires `session_id` field)
- All shots for a session are inserted in a single transaction

---

## Environment Variables

| Variable | Where used | Purpose |
|----------|-----------|---------|
| `DATA_DIR` | backend | Path to data directory (default `/app/data`) |
| `PORT` | backend | Express port (default `3000`) |
| `PUID` / `PGID` | entrypoint.sh | Map container user to host UID/GID |
| `BACKUP_DAY` | backup.js | Day of week for scheduled backup |
| `BACKUP_TIME` | backup.js | Time of day for scheduled backup |
| `BACKUP_KEEP` | backup.js | Number of backups to retain |
