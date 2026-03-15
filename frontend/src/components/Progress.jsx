import { useState, useEffect, Fragment } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getClubColor, sortByClub, CLUB_ORDER } from '../utils';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.9rem' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontSize: 13 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Progress({ sessions }) {
  const [rawData, setRawData] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/stats/progress')
      .then(r => r.json())
      .then(data => {
        setRawData(data);
        const clubs = [...new Set(data.map(d => d.club))];
        const sorted = sortByClub(clubs.map(c => ({ club: c })), 'club').map(c => c.club);
        setAllClubs(sorted);
        setSelectedClubs(new Set(sorted.slice(0, 6))); // default: first 6 clubs
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Loading…</div>;
  if (!rawData.length) return <div className="empty">No data yet — upload at least one session to see progress.</div>;
  if (sessions.length < 1) return <div className="empty">No sessions available.</div>;

  function toggleClub(club) {
    setSelectedClubs(prev => {
      const next = new Set(prev);
      next.has(club) ? next.delete(club) : next.add(club);
      return next;
    });
  }

  // Build chart data: one entry per session, columns for each club
  const sessionMap = {};
  for (const session of sessions) {
    sessionMap[session.id] = {
      label: `${session.name}\n(${session.date})`,
      shortLabel: session.date,
      session_id: session.id,
    };
  }

  // carry progress data
  const carryRows = Object.values(sessionMap).map(s => ({ ...s }));
  // consistency (std_offline) data
  const consistencyRows = Object.values(sessionMap).map(s => ({ ...s }));

  for (const row of rawData) {
    if (!sessionMap[row.session_id]) continue;
    const idx = carryRows.findIndex(r => r.session_id === row.session_id);
    if (idx >= 0) {
      carryRows[idx][row.club] = row.avg_carry;
      consistencyRows[idx][row.club] = row.std_offline;
    }
  }

  const visibleClubs = allClubs.filter(c => selectedClubs.has(c));

  if (sessions.length === 1) {
    return (
      <div className="empty" style={{ paddingTop: '4rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
        <div>Upload more sessions to see progress trends.</div>
        <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>You have 1 session so far.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Club selector */}
      <div className="card">
        <div className="card-title">Select Clubs to Compare</div>
        <div className="club-filters">
          {allClubs.map(club => (
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

      {/* Average carry over time */}
      <div className="card">
        <div className="card-title">Average Carry Distance Over Time (yds)</div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={carryRows} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="shortLabel"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: 'pointer' }} formatter={v => <span style={{ color: getClubColor(v) }}>{v}</span>} onClick={data => toggleClub(data.dataKey)} />
            {visibleClubs.map(club => (
              <Line
                key={club}
                type="monotone"
                dataKey={club}
                stroke={getClubColor(club)}
                strokeWidth={2}
                dot={{ r: 4, fill: getClubColor(club) }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Consistency (std dev of offline) over time */}
      <div className="card">
        <div className="card-title">Offline Consistency Over Time — Std Dev (lower = tighter)</div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={consistencyRows} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="shortLabel"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit=" yd" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, cursor: 'pointer' }} formatter={v => <span style={{ color: getClubColor(v) }}>{v}</span>} onClick={data => toggleClub(data.dataKey)} />
            {visibleClubs.map(club => (
              <Line
                key={club}
                type="monotone"
                dataKey={club}
                stroke={getClubColor(club)}
                strokeWidth={2}
                dot={{ r: 4, fill: getClubColor(club) }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="card">
        <div className="card-title">Session Breakdown</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Date</th>
                {visibleClubs.map(c => (
                  <th key={c} colSpan={2} style={{ borderLeft: `2px solid ${getClubColor(c)}`, textAlign: 'center' }}>
                    <span style={{ color: getClubColor(c) }}>{c}</span>
                  </th>
                ))}
              </tr>
              <tr>
                <th></th>
                <th></th>
                {visibleClubs.map(c => (
                  <Fragment key={c}>
                    <th style={{ borderLeft: `2px solid ${getClubColor(c)}`, fontWeight: 400, color: 'var(--text-muted)' }}>Carry</th>
                    <th style={{ fontWeight: 400, color: 'var(--text-muted)' }}>±Offline</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {carryRows.map((row, i) => (
                <tr key={row.session_id}>
                  <td>{sessions.find(s => s.id === row.session_id)?.name ?? '—'}</td>
                  <td>{row.shortLabel}</td>
                  {visibleClubs.map(c => (
                    <Fragment key={c}>
                      <td style={{ borderLeft: `2px solid ${getClubColor(c)}20` }}>
                        {carryRows[i][c] != null ? `${carryRows[i][c]} yd` : '—'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {consistencyRows[i][c] != null ? `±${consistencyRows[i][c]} yd` : '—'}
                      </td>
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
