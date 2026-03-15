import { useState, useRef, Fragment } from 'react';

export default function Sessions({ sessions, onRefresh, onSelect }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Per-session add-shots state
  const [addShotsId, setAddShotsId] = useState(null);
  const [addShotsFile, setAddShotsFile] = useState(null);
  const [addShotsUploading, setAddShotsUploading] = useState(false);
  const [addShotsError, setAddShotsError] = useState('');

  const fileRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); autoFillName(f.name); }
  }

  function autoFillName(filename) {
    // Try to extract a meaningful name from GSPro export filenames like "gspro-export03-15-26-11-29-17"
    const match = filename.match(/(\d{2}-\d{2}-\d{2})/);
    if (match && !name) {
      const [mm, dd, yy] = match[1].split('-');
      setName(`Range Session ${mm}/${dd}/20${yy}`);
      setDate(`20${yy}-${mm}-${dd}`);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !name || !date) return setError('File, name, and date are all required.');
    setError('');
    setSuccess('');
    setUploading(true);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    fd.append('date', date);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Upload failed');
      setSuccess(`Uploaded ${data.shot_count} shots to "${data.name}"`);
      setFile(null);
      setName('');
      if (fileRef.current) fileRef.current.value = '';
      await onRefresh();
      onSelect(data.id);
    } catch {
      setError('Upload failed — check the server.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAddShots(sessionId) {
    if (!addShotsFile) return;
    setAddShotsError('');
    setAddShotsUploading(true);

    const fd = new FormData();
    fd.append('file', addShotsFile);
    fd.append('session_id', sessionId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) return setAddShotsError(data.error || 'Upload failed');
      setAddShotsId(null);
      setAddShotsFile(null);
      await onRefresh();
    } catch {
      setAddShotsError('Upload failed');
    } finally {
      setAddShotsUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this session and all its shots?')) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    await onRefresh();
  }

  return (
    <div>
      {/* Upload form */}
      <div className="card">
        <div className="card-title">Upload New Session</div>
        <div
          className={`upload-area${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          {file
            ? <span style={{ color: 'var(--text)' }}>📄 {file.name}</span>
            : <span>Drop a GSPro CSV export here, or click to select</span>
          }
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files[0];
              if (f) { setFile(f); autoFillName(f.name); }
            }}
          />
        </div>

        <form onSubmit={handleUpload}>
          <div className="form-row">
            <div className="form-field">
              <label>Session Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Range Session"
                style={{ width: '220px' }}
              />
            </div>
            <div className="form-field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
              style={{ alignSelf: 'flex-end' }}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {error && <div className="msg-error">{error}</div>}
          {success && <div className="msg-success">{success}</div>}
        </form>
      </div>

      {/* Sessions list */}
      <div className="card">
        <div className="card-title">Sessions ({sessions.length})</div>
        {sessions.length === 0 ? (
          <div className="empty">No sessions yet — upload a CSV to get started.</div>
        ) : (
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Shots</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <Fragment key={s.id}>
                  <tr>
                    <td>
                      <button
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.875rem', padding: 0 }}
                        onClick={() => onSelect(s.id)}
                      >
                        {s.name}
                      </button>
                    </td>
                    <td>{s.date}</td>
                    <td>{s.shot_count}</td>
                    <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        onClick={() => setAddShotsId(addShotsId === s.id ? null : s.id)}
                      >
                        + Add Shots
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(s.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  {addShotsId === s.id && (
                    <tr>
                      <td colSpan={4} style={{ background: 'var(--surface2)', padding: '0.75rem' }}>
                        <div className="form-row">
                          <input
                            type="file"
                            accept=".csv"
                            onChange={e => setAddShotsFile(e.target.files[0])}
                          />
                          <button
                            className="btn btn-primary"
                            disabled={addShotsUploading || !addShotsFile}
                            onClick={() => handleAddShots(s.id)}
                          >
                            {addShotsUploading ? 'Adding…' : 'Add'}
                          </button>
                          <button
                            className="btn"
                            style={{ background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                            onClick={() => { setAddShotsId(null); setAddShotsFile(null); setAddShotsError(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                        {addShotsError && <div className="msg-error">{addShotsError}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
