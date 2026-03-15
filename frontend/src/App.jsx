import { useState, useEffect } from 'react';
import Sessions from './components/Sessions';
import ClubStats from './components/ClubStats';
import Dispersion from './components/Dispersion';
import Progress from './components/Progress';
import SwingStats from './components/SwingStats';

const TABS = ['Sessions', 'Club Stats', 'Swing Stats', 'Dispersion', 'Progress'];

const tabToHash = t => '#' + t.toLowerCase().replace(' ', '-');
const hashToTab = () => {
  const match = TABS.find(t => tabToHash(t) === window.location.hash);
  return match ?? 'Sessions';
};

export default function App() {
  const [activeTab, setActiveTab] = useState(hashToTab);
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const navigateTo = tab => {
    window.location.hash = tabToHash(tab);
    setActiveTab(tab);
  };

  useEffect(() => {
    const onHashChange = () => setActiveTab(hashToTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
      setSelectedId(prev => {
        if (prev && data.find(s => s.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>⛳ Golf Shot Tracker</h1>
        {activeTab !== 'Sessions' && sessions.length > 0 && (
          <div className="session-selector">
            <label>Session</label>
            <select
              value={selectedId ?? ''}
              onChange={e => setSelectedId(Number(e.target.value))}
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.date} ({s.shot_count} shots)
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <nav className="nav">
        {TABS.map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => navigateTo(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="main">
        {activeTab === 'Sessions' && (
          <Sessions sessions={sessions} onRefresh={fetchSessions} onSelect={id => { setSelectedId(id); navigateTo('Club Stats'); }} />
        )}
        {activeTab === 'Club Stats' && (
          <ClubStats sessionId={selectedId} />
        )}
        {activeTab === 'Swing Stats' && (
          <SwingStats sessionId={selectedId} />
        )}
        {activeTab === 'Dispersion' && (
          <Dispersion sessionId={selectedId} />
        )}
        {activeTab === 'Progress' && (
          <Progress sessions={sessions} />
        )}
      </main>
    </div>
  );
}
