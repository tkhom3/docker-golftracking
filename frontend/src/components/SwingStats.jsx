import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts';
import { getClubColor, sortByClub, getShotShape } from '../utils';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.9rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || 'var(--text)', fontSize: 13 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const SHAPE_COLORS = {
  'Straight':   '#22c55e',
  'Draw':       '#3b82f6',
  'Fade':       '#f97316',
  'Hook':       '#6366f1',
  'Slice':      '#ef4444',
  'Push':       '#facc15',
  'Pull':       '#a855f7',
  'Push-Draw':  '#06b6d4',
  'Push-Fade':  '#fb923c',
  'Pull-Draw':  '#60a5fa',
  'Pull-Fade':  '#c084fc',
  'Pull-Hook':  '#818cf8',
};

const ShapeTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.8rem', fontSize: 12 }}>
      <strong style={{ color: SHAPE_COLORS[name] ?? '#94a3b8' }}>{name}</strong>: {value} shot{value !== 1 ? 's' : ''}
    </div>
  );
};

export default function SwingStats({ sessionId }) {
  const [stats, setStats] = useState([]);
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/stats/clubs?session_id=${sessionId}`).then(r => r.json()),
      fetch(`/api/shots?session_id=${sessionId}`).then(r => r.json()),
    ])
      .then(([clubStats, shotData]) => {
        setStats(sortByClub(clubStats, 'club'));
        setShots(shotData);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!sessionId) return <div className="empty">Select a session from the header.</div>;
  if (loading)    return <div className="empty">Loading…</div>;
  if (!stats.length) return <div className="empty">No shots found for this session.</div>;

  const launchData = stats.map(s => ({
    club: s.club,
    'VLA': s.avg_vla,
    'HLA': s.avg_hla,
  }));

  const spinData = stats.map(s => ({
    club: s.club,
    'Back Spin': s.avg_back_spin,
    'Side Spin': s.avg_side_spin,
  }));

  const pathData = stats.map(s => ({
    club: s.club,
    'Club Path': s.avg_path,
    'Face to Target': s.avg_face_to_target,
    'Face to Path': s.avg_face_to_path,
  }));

  const aoaData = stats.map(s => ({
    club: s.club,
    'Attack Angle': s.avg_aoa,
  }));

  const trajectoryData = stats.map(s => ({
    club: s.club,
    'Peak Height': s.avg_peak_height,
  }));

  const shapeCounts = {};
  for (const shot of shots) {
    const shape = getShotShape(shot.face_to_target, shot.face_to_path);
    if (!shape) continue;
    shapeCounts[shape] = (shapeCounts[shape] ?? 0) + 1;
  }
  const shapeData = Object.entries(shapeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  return (
    <div>
      {/* Summary pills */}
      <div className="card">
        <div className="card-title">Club Delivery Summary</div>
        <div className="stat-grid">
          {stats.map(s => (
            <div className="stat-item" key={s.club} style={{ borderTop: `3px solid ${getClubColor(s.club)}` }}>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>{s.club}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                {s.avg_path != null ? `${s.avg_path > 0 ? '+' : ''}${s.avg_path}° path` : '—'}
              </div>
              <div className="stat-label">
                {s.avg_face_to_path != null ? `${s.avg_face_to_path > 0 ? '+' : ''}${s.avg_face_to_path}° F→P` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="charts-grid">
        {/* Launch Angles */}
        <div className="card">
          <div className="card-title">Launch Angles (°)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={launchData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="°" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <Bar dataKey="VLA" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="HLA" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attack Angle */}
        <div className="card">
          <div className="card-title">Attack Angle (°)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={aoaData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="°" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <Bar dataKey="Attack Angle" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Club Path & Face */}
        <div className="card">
          <div className="card-title">Club Path & Face Angles (°)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Positive = right/open, negative = left/closed
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={pathData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit="°" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <Bar dataKey="Club Path"      fill="#3fb950" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Face to Target" fill="#58a6ff" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Face to Path"   fill="#ec4899" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spin Rates */}
        <div className="card">
          <div className="card-title">Spin Rates (rpm)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={spinData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <Bar dataKey="Back Spin" fill="#d29922" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Side Spin" fill="#f85149" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Peak Height */}
        <div className="card">
          <div className="card-title">Peak Height (yds)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trajectoryData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit=" yd" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Peak Height" fill="#06b6d4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Shot Shape Distribution */}
        {shapeData.length > 0 && (
          <div className="card">
            <div className="card-title">Shot Shape Distribution</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={shapeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={true}
                >
                  {shapeData.map(entry => (
                    <Cell key={entry.name} fill={SHAPE_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<ShapeTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Raw averages table */}
      <div className="card">
        <div className="card-title">Raw Swing Averages</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Shots</th>
                <th>VLA</th>
                <th>HLA</th>
                <th>AoA</th>
                <th>Club Path</th>
                <th>Face→Target</th>
                <th>Face→Path</th>
                <th>Back Spin</th>
                <th>Side Spin</th>
                <th>Peak Height</th>
                <th>Shape</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.club}>
                  <td><span style={{ color: getClubColor(s.club), fontWeight: 600 }}>{s.club}</span></td>
                  <td>{s.shot_count}</td>
                  <td>{s.avg_vla != null ? `${s.avg_vla}°` : '—'}</td>
                  <td>{s.avg_hla != null ? `${s.avg_hla > 0 ? '+' : ''}${s.avg_hla}°` : '—'}</td>
                  <td>{s.avg_aoa != null ? `${s.avg_aoa > 0 ? '+' : ''}${s.avg_aoa}°` : '—'}</td>
                  <td style={{ color: s.avg_path > 3 ? 'var(--orange)' : s.avg_path < -3 ? 'var(--accent)' : 'var(--text)' }}>
                    {s.avg_path != null ? `${s.avg_path > 0 ? '+' : ''}${s.avg_path}°` : '—'}
                  </td>
                  <td style={{ color: Math.abs(s.avg_face_to_target ?? 0) > 3 ? 'var(--red)' : 'var(--text)' }}>
                    {s.avg_face_to_target != null ? `${s.avg_face_to_target > 0 ? '+' : ''}${s.avg_face_to_target}°` : '—'}
                  </td>
                  <td style={{ color: Math.abs(s.avg_face_to_path ?? 0) > 3 ? 'var(--red)' : 'var(--text)' }}>
                    {s.avg_face_to_path != null ? `${s.avg_face_to_path > 0 ? '+' : ''}${s.avg_face_to_path}°` : '—'}
                  </td>
                  <td>{s.avg_back_spin?.toLocaleString() ?? '—'}</td>
                  <td style={{ color: Math.abs(s.avg_side_spin ?? 0) > 500 ? 'var(--orange)' : 'var(--text)' }}>
                    {s.avg_side_spin != null ? `${s.avg_side_spin > 0 ? '+' : ''}${s.avg_side_spin}` : '—'}
                  </td>
                  <td>{s.avg_peak_height != null ? `${s.avg_peak_height} yds` : '—'}</td>
                  <td>{getShotShape(s.avg_face_to_target, s.avg_face_to_path) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
