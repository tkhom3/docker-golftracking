const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const os = require('os');
const { scheduleBackups } = require('./backup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60_000, max: 200 });
const staticLimiter = rateLimit({ windowMs: 60_000, max: 1000 });
app.use('/api/', limiter);

app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/shots', require('./routes/shots'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/upload', require('./routes/upload'));

app.use(express.static(path.join(__dirname, '../public')));
app.get('/{*path}', staticLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

scheduleBackups();

app.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const ips = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
  console.log(`Golf Tracker running → http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`                       http://${ip}:${PORT}`));
});
