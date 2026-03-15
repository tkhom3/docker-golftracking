import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ErrorBar,
} from 'recharts';
import { CLUB_ORDER, getClubColor, sortByClub } from '../utils';

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

export default function ClubStats({ sessionId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch(`/api/stats/clubs?session_id=${sessionId}`)
      .then(r => r.json())
      .then(data => setStats(sortByClub(data, 'club')))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!sessionId) return <div className="empty">Select a session from the header.</div>;
  if (loading) return <div className="empty">Loading…</div>;
  if (!stats.length) return <div className="empty">No shots found for this session.</div>;

  const distanceData = stats.map(s => ({
    club: s.club,
    'Avg Carry': s.avg_carry,
    'Avg Total': s.avg_total,
    'Min': s.min_carry,
    'Max': s.max_carry,
  }));

  const speedData = stats.map(s => ({
    club: s.club,
    'Ball Speed': s.avg_ball_speed,
    'Club Speed': s.avg_club_speed,
  }));

  const smashData = stats.map(s => ({
    club: s.club,
    'Smash Factor': s.avg_smash_factor,
  }));

  const dispersionData = stats.map(s => ({
    club: s.club,
    'Avg Offline': parseFloat(Math.abs(s.avg_offline).toFixed(1)),
    'Std Dev': s.std_offline,
  }));

  return (
    <div>
      {/* Summary stat pills */}
      <div className="card">
        <div className="card-title">Shot Summary</div>
        <div className="stat-grid">
          {stats.map(s => (
            <div className="stat-item" key={s.club} style={{ borderTop: `3px solid ${getClubColor(s.club)}` }}>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>{s.club}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{s.avg_carry} yds</div>
              <div className="stat-label">{s.shot_count} shots</div>
            </div>
          ))}
        </div>
      </div>

      <div className="charts-grid">
        {/* Distance chart */}
        <div className="card">
          <div className="card-title">Distance (yds)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distanceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <Bar dataKey="Avg Carry" fill="#3fb950" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Avg Total" fill="#58a6ff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Speed chart */}
        <div className="card">
          <div className="card-title">Speed (mph)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={speedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <Bar dataKey="Ball Speed" fill="#d29922" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Club Speed" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Smash factor */}
        <div className="card">
          <div className="card-title">Smash Factor</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={smashData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis domain={[1.0, 1.6]} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Smash Factor" fill="#f97316" radius={[3, 3, 0, 0]}>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Dispersion / accuracy */}
        <div className="card">
          <div className="card-title">Accuracy (lower = better)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dispersionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="club" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} unit=" yd" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <Bar dataKey="Avg Offline" fill="#f85149" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Std Dev" fill="#ec4899" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table */}
      <div className="card">
        <div className="card-title">Raw Averages</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Club</th>
                <th>Shots</th>
                <th>Avg Carry</th>
                <th>Avg Total</th>
                <th>Min / Max Carry</th>
                <th>Ball Speed</th>
                <th>Club Speed</th>
                <th>Smash</th>
                <th>Avg Offline</th>
                <th>Std Dev Offline</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.club}>
                  <td><span style={{ color: getClubColor(s.club), fontWeight: 600 }}>{s.club}</span></td>
                  <td>{s.shot_count}</td>
                  <td>{s.avg_carry}</td>
                  <td>{s.avg_total}</td>
                  <td>{s.min_carry} / {s.max_carry}</td>
                  <td>{s.avg_ball_speed}</td>
                  <td>{s.avg_club_speed}</td>
                  <td>{s.avg_smash_factor?.toFixed(2)}</td>
                  <td style={{ color: Math.abs(s.avg_offline) > 10 ? 'var(--red)' : 'var(--text)' }}>
                    {s.avg_offline > 0 ? '+' : ''}{s.avg_offline} yd
                  </td>
                  <td>{s.std_offline} yd</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
