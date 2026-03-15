# docker-golftracking

Self-hosted web dashboard for tracking and analysing launch monitor data exported from GSPro (or any compatible CSV format). Upload sessions, visualise shot dispersion, compare club stats, analyse swing metrics, and track progress over time.

## Features

### 📋 Sessions

- **Upload GSPro CSV exports** to create a new session or append shots to an existing one
- **Organise sessions** by name and date
- **Delete sessions** with cascading shot removal

### 📊 Club Stats

- Per-club averages: carry, total distance, ball speed, club speed, smash factor
- Offline accuracy: average deviation and standard deviation
- Min / max carry range per club
- Visual bar charts for carry distance and speed comparison

### 🌀 Swing Stats

- Per-club averages for VLA, HLA, Attack Angle, Club Path, Face→Target, Face→Path, Back Spin, Side Spin, Peak Height
- **Shot Shape** column derived from D-Plane model (Face→Target + Face→Path)
- Charts: Launch Angles, Attack Angle, Club Path & Face Angles, Spin Rates, Peak Height
- **Shot Shape Distribution** pie chart showing counts across all shapes (Straight, Draw, Fade, Hook, Slice, Push, Pull, and compounds)

### 🎯 Dispersion

- **Top-down scatter chart** of every shot with per-club colour coding
- **95%-confidence ellipses** per club showing grouping at a glance
- **Carry Distribution** box-and-whisker plot (Q1, median, Q3, min, max)
- **Shot Metrics by Club** scatter chart — compare any metric (Ball Speed, Club Speed, Smash Factor, Back Spin, VLA, HLA, etc.) across clubs
- Club filter with Select All / Deselect All toggle
- Full shot detail table with Shot Shape column

### 📈 Progress

- **Average Carry over time** — line chart per club across sessions
- **Offline Consistency over time** — standard deviation trend per club
- Session breakdown table with carry and ±offline per club
- Club selector (default: first 6 clubs)

## Quick Start

### Local Development (Linux, macOS, Windows)

**Prerequisites:** Docker and Docker Compose

1. Start the app:

   ```bash
   docker compose up --build
   ```

2. Open [http://localhost:3000](http://localhost:3000)

### Running on Unraid

1. **Create a data directory** on a share:

   ```bash
   mkdir -p /mnt/user/golftracking-data
   chmod 755 /mnt/user/golftracking-data
   ```

2. **Create a `.env` file**:

   ```bash
   cat > .env << 'EOF'
   GOLF_DATA_PATH=/mnt/user/golftracking-data
   PUID=99
   PGID=100
   EOF
   ```

3. **Start with Docker Compose**:

   ```bash
   docker compose up --build -d
   ```

4. **Access the dashboard**: `http://your-unraid-ip:3000`

5. **Data persistence**: The SQLite database and backups are stored in `GOLF_DATA_PATH` and survive container restarts and updates.

   > Containers run as non-root user (UID/GID configurable via `PUID`/`PGID`) for security.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GOLF_DATA_PATH` | `./data` | Host path for persistent data (database + backups) |
| `PUID` | `10001` | User ID the app process runs as |
| `PGID` | `10001` | Group ID the app process runs as |
| `BACKUP_DAY` | `sunday` | Day of week for automatic DB backup (`sunday`–`saturday` or `0`–`6`) |
| `BACKUP_TIME` | `00:00` | Time of day for backup in `HH:MM` (24-hour) |
| `BACKUP_KEEP` | `4` | Number of weekly backups to retain |

## CSV Format

The uploader expects a CSV with the following columns (GSPro export format):

| Column | Description |
|---|---|
| `Shot` | Shot number |
| `Club` | Club name (`DR`, `W3`, `I7`, `PW`, etc.) |
| `Carry` | Carry distance (yards) |
| `TotalDistance` | Total distance (yards) |
| `BallSpeed` | Ball speed (mph) |
| `ClubSpeed` | Club head speed (mph) |
| `BackSpin` | Back spin (rpm) |
| `SideSpin` | Side spin (rpm) |
| `HLA` | Horizontal launch angle (°) |
| `VLA` | Vertical launch angle (°) |
| `Offline` | Lateral deviation (yards, negative = left) |
| `PeakHeight` | Peak height (yards) |
| `Path` | Club path (°) |
| `AoA` | Attack angle (°) |
| `FaceToTarget` | Face-to-target angle (°) |
| `FaceToPath` | Face-to-path angle (°) |

All numeric columns are optional — missing values are stored as `null`. Smash factor is calculated automatically from `BallSpeed / ClubSpeed`.

## Architecture

Single Docker container running one process under supervisord:

- **Frontend**: React 19 + Vite (SPA, built at image build time, served as static files)
- **Backend**: Node.js + Express 5 REST API (port 3000)
- **Database**: SQLite via better-sqlite3 (persisted to host filesystem)
- **Process manager**: supervisord (consistent with other containers, stdout/stderr logging)

## Persistent Data

All data is stored in the directory specified by `GOLF_DATA_PATH`:

| Path | Contents |
|---|---|
| `golftracking.db` | SQLite database (sessions + shots) |
| `backups/` | Automatic weekly database backups |

Container path: `/app/data`

## Automatic Backups

The app runs a scheduled backup of the SQLite database using `better-sqlite3`'s hot-backup API (no locking, safe while the app is running). Configure via environment variables:

```yaml
environment:
  - BACKUP_DAY=sunday
  - BACKUP_TIME=00:00
  - BACKUP_KEEP=4
```

Backups are stored as timestamped `.db` files in `./data/backups/` and the oldest files are pruned automatically when the limit is exceeded.

## Stopping the Application

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f app
```

## Development

Install dependencies (single root `package.json` covers both frontend and backend):

```bash
npm install
```

Start backend and frontend in separate terminals:

```bash
# Terminal 1 — Express API on :3000
npm run dev:backend

# Terminal 2 — Vite dev server on :5173 (proxies /api to :3000)
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173).

### Frontend Stack

- React 19
- Recharts 3 for all charts
- Vite

### Backend Stack

- Node.js + Express 5
- better-sqlite3
- multer (CSV upload)
- express-rate-limit

### Database Schema

- `sessions` — name, date, created_at
- `shots` — all launch monitor fields, foreign key to sessions (CASCADE delete)

## Releases & Deployment

Releases are created automatically based on commit messages using [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Version | Example |
|---|---|---|
| `feat:` | Minor | `feat: add swing stats tab` |
| `fix:` | Patch | `fix: correct smash factor rounding` |
| `perf:` | Patch | `perf: optimise progress query` |
| `refactor:` | Patch | `refactor: extract club colour util` |
| `docs:` | No release | `docs: update CSV format table` |
| `BREAKING CHANGE:` | Major | `feat!: new CSV format` |

When a release is created, Docker images are automatically built and pushed to Docker Hub with `latest` and version tags (e.g., `v1.2.3`).
