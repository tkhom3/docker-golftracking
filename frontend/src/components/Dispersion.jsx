import { useState, useEffect } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
  ComposedChart, Bar,
  useXAxisScale, useYAxisScale,
} from 'recharts';
import { getClubColor, sortByClub, getShotShape, CLUB_ORDER } from '../utils';

// Compute a 95%-confidence ellipse for a set of shots, working entirely in
// pixel space so the x/y scale difference is handled automatically.
function computeEllipse(shots, xScale, yScale) {
  const valid = shots.filter(s => s.offline != null && s.carry != null);
  if (valid.length < 2) return null;

  const xs = valid.map(s => xScale(s.offline));
  const ys = valid.map(s => yScale(s.carry));
  const n  = xs.length;

  const mx   = xs.reduce((a, b) => a + b, 0) / n;
  const my   = ys.reduce((a, b) => a + b, 0) / n;
  const varX = xs.reduce((s, x) => s + (x - mx) ** 2, 0) / n;
  const varY = ys.reduce((s, y) => s + (y - my) ** 2, 0) / n;
  const cov  = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / n;

  // Eigenvalues of the 2×2 covariance matrix
  const trace = varX + varY;
  const disc  = Math.sqrt(Math.max(0, (trace / 2) ** 2 - (varX * varY - cov * cov)));
  const l1    = trace / 2 + disc;
  const l2    = Math.max(0, trace / 2 - disc);

  // k controls the ellipse size; 1.0 ≈ 1-sigma (~39%), 1.5 gives a tighter grouping visual
  const k = 1.5;
  return {
    cx: mx,
    cy: my,
    rx: k * Math.sqrt(l1),
    ry: k * Math.sqrt(l2),
    angle: 0.5 * Math.atan2(2 * cov, varX - varY) * (180 / Math.PI),
  };
}

const ClubEllipses = ({ shotsByClub, visibleClubs }) => {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (!xScale || !yScale) return null;

  return (
    <g>
      {visibleClubs.map(club => {
        const shots = shotsByClub[club];
        if (!shots?.length) return null;
        const e = computeEllipse(shots, xScale, yScale);
        if (!e) return null;
        const color = getClubColor(club);
        return (
          <ellipse
            key={club}
            cx={e.cx}
            cy={e.cy}
            rx={e.rx}
            ry={e.ry}
            transform={`rotate(${e.angle}, ${e.cx}, ${e.cy})`}
            fill={color}
            fillOpacity={0.08}
            stroke={color}
            strokeWidth={1.5}
            strokeOpacity={0.7}
          />
        );
      })}
    </g>
  );
};

// ─── Box plot helpers ─────────────────────────────────────────────────────────
function quantile(sorted, p) {
  if (!sorted.length) return 0;
  const pos = p * (sorted.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

function computeBoxStats(shots) {
  const carries = shots.filter(s => s.carry != null).map(s => s.carry).sort((a, b) => a - b);
  if (!carries.length) return null;
  return {
    min: carries[0],
    q1: quantile(carries, 0.25),
    median: quantile(carries, 0.5),
    q3: quantile(carries, 0.75),
    max: carries[carries.length - 1],
    count: carries.length,
  };
}

// Custom bar shape draws the full box-and-whisker from stacked bar coords:
// y = Q3 pixel position, y+height = Q1 pixel position
const BoxPlotShape = ({ x, y, width, height, payload }) => {
  if (!payload || height <= 0) return null;
  const { q1, q3, median, min, max, color = '#3b82f6' } = payload;
  const range = q3 - q1;
  if (range <= 0) return null;
  const k  = height / range;
  const cx = x + width / 2;
  const ww = Math.max(width * 0.35, 5);
  const boxTop    = y;
  const boxBottom = y + height;
  const medY      = boxTop  + k * (q3 - median);
  const maxY      = boxTop  - k * (max - q3);
  const minY      = boxBottom + k * (q1 - min);
  return (
    <g>
      <rect x={x} y={boxTop} width={width} height={height} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} />
      <line x1={x} y1={medY} x2={x + width} y2={medY} stroke={color} strokeWidth={2.5} />
      <line x1={cx} y1={boxTop}    x2={cx} y2={maxY}  stroke={color} strokeWidth={1.5} />
      <line x1={cx - ww} y1={maxY} x2={cx + ww} y2={maxY} stroke={color} strokeWidth={1.5} />
      <line x1={cx} y1={boxBottom} x2={cx} y2={minY}  stroke={color} strokeWidth={1.5} />
      <line x1={cx - ww} y1={minY} x2={cx + ww} y2={minY} stroke={color} strokeWidth={1.5} />
    </g>
  );
};

const BoxTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d || d.min == null) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.9rem', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: d.color, marginBottom: 4 }}>{d.club} ({d.count} shots)</div>
      <div>Max: <strong>{d.max?.toFixed(1)} yds</strong></div>
      <div>Q3: <strong>{d.q3?.toFixed(1)} yds</strong></div>
      <div>Median: <strong>{d.median?.toFixed(1)} yds</strong></div>
      <div>Q1: <strong>{d.q1?.toFixed(1)} yds</strong></div>
      <div>Min: <strong>{d.min?.toFixed(1)} yds</strong></div>
    </div>
  );
};

// ─── Shot Metrics helpers ─────────────────────────────────────────────────────
const METRICS = [
  { key: 'ball_speed',     label: 'Ball Speed',      unit: 'mph' },
  { key: 'club_speed',     label: 'Club Speed',      unit: 'mph' },
  { key: 'smash_factor',   label: 'Smash Factor',    unit: ''    },
  { key: 'back_spin',      label: 'Back Spin',       unit: 'rpm' },
  { key: 'side_spin',      label: 'Side Spin',       unit: 'rpm' },
  { key: 'vla',            label: 'VLA',             unit: '°'   },
  { key: 'hla',            label: 'HLA',             unit: '°'   },
  { key: 'peak_height',    label: 'Peak Height',     unit: 'yds' },
  { key: 'path',           label: 'Club Path',       unit: '°'   },
  { key: 'aoa',            label: 'Attack Angle',    unit: '°'   },
  { key: 'face_to_target', label: 'Face to Target',  unit: '°'   },
  { key: 'face_to_path',   label: 'Face to Path',    unit: '°'   },
];

const ShotMetricTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const m = METRICS.find(m => m.key === d.metricKey);
  const decimals = d.metricKey === 'smash_factor' ? 2 : 1;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.9rem', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: getClubColor(d.club), marginBottom: 4 }}>Shot #{d.shot_number} — {d.club}</div>
      <div>{m?.label}: <strong>{d.y?.toFixed(decimals)}{m?.unit ? ' ' + m.unit : ''}</strong></div>
      <div>Carry: <strong>{d.carry?.toFixed(1)} yds</strong></div>
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.9rem', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: getClubColor(d.club), marginBottom: 4 }}>Shot #{d.shot_number} — {d.club}</div>
      <div>Carry: <strong>{d.carry?.toFixed(1)} yds</strong></div>
      <div>Total: <strong>{d.total_distance?.toFixed(1)} yds</strong></div>
      <div>Offline: <strong>{d.offline > 0 ? '+' : ''}{d.offline?.toFixed(1)} yds {d.offline > 0 ? '(R)' : d.offline < 0 ? '(L)' : ''}</strong></div>
      <div>Ball Speed: <strong>{d.ball_speed?.toFixed(1)} mph</strong></div>
      <div>Club Speed: <strong>{d.club_speed?.toFixed(1)} mph</strong></div>
      {d.smash_factor && <div>Smash: <strong>{d.smash_factor?.toFixed(2)}</strong></div>}
    </div>
  );
};

const DistanceLabel = ({ viewBox, value }) => {
  const { x, y } = viewBox;
  return (
    <text x={x + 4} y={y - 4} fill="var(--text-muted)" fontSize={10}>{value} yds</text>
  );
};

export default function Dispersion({ sessionId }) {
  const [shots, setShots] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState('ball_speed');
  const [top5Only, setTop5Only] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/shots?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        setShots(data);
        const uniqueClubs = [...new Set(data.map(s => s.club))];
        const sorted = sortByClub(uniqueClubs.map(c => ({ club: c })), 'club').map(c => c.club);
        setClubs(sorted);
        setSelectedClubs(new Set(sorted));
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!sessionId) return <div className="empty">Select a session from the header.</div>;
  if (loading) return <div className="empty">Loading…</div>;
  if (!shots.length) return <div className="empty">No shots found for this session.</div>;

  function toggleClub(club) {
    setSelectedClubs(prev => {
      const next = new Set(prev);
      next.has(club) ? next.delete(club) : next.add(club);
      return next;
    });
  }

  function toggleAll() {
    setSelectedClubs(prev => prev.size === clubs.length ? new Set() : new Set(clubs));
  }

  // Group shots by club for Scatter components
  const shotsByClub = {};
  for (const shot of shots) {
    if (!selectedClubs.has(shot.club)) continue;
    if (!shotsByClub[shot.club]) shotsByClub[shot.club] = [];
    shotsByClub[shot.club].push(shot);
  }

  const visibleClubs = clubs.filter(c => selectedClubs.has(c));

  // Determine axis domain
  const visibleShots = shots.filter(s => selectedClubs.has(s.club));
  const maxCarry = visibleShots.length ? Math.ceil(Math.max(...visibleShots.map(s => s.carry ?? 0)) / 25) * 25 + 25 : 300;
  const maxOffline = visibleShots.length ? Math.ceil(Math.max(...visibleShots.map(s => Math.abs(s.offline ?? 0))) / 10) * 10 + 10 : 40;

  const distanceMarkers = [];
  for (let d = 50; d <= maxCarry; d += 50) distanceMarkers.push(d);

  // Box plot data
  const boxPlotData = visibleClubs.map(club => {
    const s = shotsByClub[club];
    if (!s?.length) return null;
    const stats = computeBoxStats(s);
    if (!stats) return null;
    return { club, ...stats, iqr: stats.q3 - stats.q1, color: getClubColor(club) };
  }).filter(Boolean);
  const boxYMax = boxPlotData.length
    ? Math.ceil(Math.max(...boxPlotData.map(d => d.max)) / 25) * 25 + 25
    : 300;

  // Shot metrics data — one Scatter series per club, x = club index
  const metric = METRICS.find(m => m.key === selectedMetric) ?? METRICS[0];
  const shotMetricsByClub = {};
  visibleClubs.forEach((club, i) => {
    const s = shotsByClub[club] ?? [];
    const filtered = top5Only
      ? [...s].sort((a, b) => (b.carry ?? 0) - (a.carry ?? 0)).slice(0, 5)
      : s;
    shotMetricsByClub[club] = filtered
      .filter(sh => sh[metric.key] != null)
      .map(sh => ({ x: i, y: sh[metric.key], club, shot_number: sh.shot_number, carry: sh.carry, metricKey: metric.key }));
  });
  const allMetricY = Object.values(shotMetricsByClub).flat().map(d => d.y);
  const metricYMin = allMetricY.length ? Math.floor(Math.min(...allMetricY) * 0.97) : 0;
  const metricYMax = allMetricY.length ? Math.ceil(Math.max(...allMetricY)  * 1.03) : 100;

  return (
    <div>
      {/* Club filter */}
      <div className="card">
        <div className="card-title">Club Filter</div>
        <div className="club-filters">
          <button
            className="club-pill"
            style={{
              background: selectedClubs.size === clubs.length ? 'var(--text-muted)' : 'transparent',
              color: selectedClubs.size === clubs.length ? '#000' : 'var(--text-muted)',
            }}
            onClick={toggleAll}
          >
            {selectedClubs.size === clubs.length ? 'Deselect All' : 'Select All'}
          </button>
          {clubs.map(club => (
            <button
              key={club}
              className={`club-pill${selectedClubs.has(club) ? ' active' : ''}`}
              style={selectedClubs.has(club) ? { background: getClubColor(club), borderColor: getClubColor(club) } : {}}
              onClick={() => toggleClub(club)}
            >
              {club}
            </button>
          ))}
        </div>
      </div>

      {/* Dispersion scatter chart */}
      <div className="card">
        <div className="card-title">Shot Dispersion — Top Down View</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          X-axis = offline (left is negative, right is positive) · Y-axis = carry distance
        </div>
        <ResponsiveContainer width="100%" height={520}>
          <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="fairwayGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#0d2e0d" />
                <stop offset="100%" stopColor="#1a4a1a" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
            <XAxis
              type="number"
              dataKey="offline"
              name="Offline"
              domain={[-maxOffline, maxOffline]}
              tickCount={9}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              label={{ value: 'Offline (yds) — L ← · → R', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="carry"
              name="Carry"
              domain={[0, maxCarry]}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              label={{ value: 'Carry (yds)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 8, cursor: 'pointer' }}
              formatter={(value) => <span style={{ color: getClubColor(value) }}>{value}</span>}
              onClick={(data) => toggleClub(data.value)}
            />
            {/* Target line */}
            <ReferenceLine
              x={0}
              stroke="var(--green)"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: 'Target', position: 'top', fill: 'var(--green)', fontSize: 11 }}
            />
            {/* Distance rings */}
            {distanceMarkers.map(d => (
              <ReferenceLine
                key={d}
                y={d}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={<DistanceLabel value={d} />}
              />
            ))}
            <ClubEllipses shotsByClub={shotsByClub} visibleClubs={visibleClubs} />
            {visibleClubs.map(club => (
              <Scatter
                key={club}
                name={club}
                data={shotsByClub[club] ?? []}
                fill={getClubColor(club)}
                fillOpacity={0.85}
                r={5}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Carry distribution box plot */}
      {boxPlotData.length > 0 && (
        <div className="card">
          <div className="card-title">Carry Distance Distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={boxPlotData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis
                domain={[0, boxYMax]}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                label={{ value: 'Carry (yds)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
              />
              <Tooltip content={<BoxTooltip />} />
              {/* Transparent spacer 0→Q1, then colored box Q1→Q3 */}
              <Bar dataKey="q1"  stackId="bp" fill="transparent" isAnimationActive={false} legendType="none" />
              <Bar dataKey="iqr" stackId="bp" shape={<BoxPlotShape />} isAnimationActive={false} legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Shot Metrics By Club */}
      {visibleClubs.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Shot Metrics By Club</div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={top5Only} onChange={e => setTop5Only(e.target.checked)} />
                Top 5 by Carry
              </label>
              <select value={selectedMetric} onChange={e => setSelectedMetric(e.target.value)}>
                {METRICS.map(m => (
                  <option key={m.key} value={m.key}>{m.label}{m.unit ? ` (${m.unit})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[-0.5, visibleClubs.length - 0.5]}
                ticks={visibleClubs.map((_, i) => i)}
                tickFormatter={i => visibleClubs[i] ?? ''}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                interval={0}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[metricYMin, metricYMax]}
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                label={{ value: metric.unit ? `${metric.label} (${metric.unit})` : metric.label, angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
              />
              <Tooltip content={<ShotMetricTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: 'pointer' }}
                formatter={v => <span style={{ color: getClubColor(v) }}>{v}</span>}
                onClick={(data) => toggleClub(data.value)}
              />
              {visibleClubs.map(club => (
                <Scatter
                  key={club}
                  name={club}
                  data={shotMetricsByClub[club]}
                  fill={getClubColor(club)}
                  fillOpacity={0.85}
                  r={4}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Shot list table */}
      <div className="card">
        <div className="card-title">Shot Detail ({visibleShots.length} shots)</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sessions-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Club</th>
                <th>Carry</th>
                <th>Total</th>
                <th>Ball Spd</th>
                <th>Club Spd</th>
                <th>Smash</th>
                <th>Offline</th>
                <th>Back Spin</th>
                <th>VLA</th>
                <th>Shape</th>
              </tr>
            </thead>
            <tbody>
              {visibleShots.map(s => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{s.shot_number}</td>
                  <td><span style={{ color: getClubColor(s.club), fontWeight: 600 }}>{s.club}</span></td>
                  <td>{s.carry?.toFixed(1)}</td>
                  <td>{s.total_distance?.toFixed(1)}</td>
                  <td>{s.ball_speed?.toFixed(1)}</td>
                  <td>{s.club_speed?.toFixed(1)}</td>
                  <td>{s.smash_factor?.toFixed(2)}</td>
                  <td style={{ color: Math.abs(s.offline ?? 0) > 15 ? 'var(--red)' : 'var(--text)' }}>
                    {s.offline != null ? `${s.offline > 0 ? '+' : ''}${s.offline.toFixed(1)}` : '—'}
                  </td>
                  <td>{s.back_spin?.toFixed(0)}</td>
                  <td>{s.vla?.toFixed(1)}°</td>
                  <td>{getShotShape(s.face_to_target, s.face_to_path) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
