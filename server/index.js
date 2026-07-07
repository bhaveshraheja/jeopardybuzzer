const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const gameStore = require('./gameStore');
const sessionStore = require('./sessionStore');
const { WebSocketServer } = require('ws');
const state = require('./state');
const wsHandlers = require('./wsHandlers');

const PORT = process.env.PORT || 3000;

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const app = express();
app.use(express.json());

app.use('/board', express.static(path.join(__dirname, '..', 'public', 'board')));
app.use('/host', express.static(path.join(__dirname, '..', 'public', 'host')));
app.use('/buzz', express.static(path.join(__dirname, '..', 'public', 'buzz')));
app.use('/editor', express.static(path.join(__dirname, '..', 'public', 'editor')));
app.use('/shared', express.static(path.join(__dirname, '..', 'public', 'shared')));
app.use('/games', express.static(path.join(__dirname, '..', 'games')));

app.get('/api/bulbs', (req, res) => {
  res.json(require('../bulbs.json'));
});

app.get('/api/wifi', (req, res) => {
  const wifiPath = path.join(__dirname, '..', 'wifi.json');
  if (!fs.existsSync(wifiPath)) {
    res.json(null);
    return;
  }
  res.json(JSON.parse(fs.readFileSync(wifiPath, 'utf8')));
});

app.get('/api/server-info', (req, res) => {
  res.json({ buzzUrl: `http://${getLanIp()}:${PORT}/buzz` });
});

app.get('/api/qrcode', async (req, res) => {
  const data = req.query.data;
  if (!data) {
    res.status(400).json({ error: 'missing_data' });
    return;
  }
  try {
    const buffer = await QRCode.toBuffer(String(data), { type: 'png', width: 300, margin: 1 });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: 'qrcode_failed' });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/games', (req, res) => {
  const games = gameStore.listGames();
  res.json(games.map((g) => ({ ...g, hasSavedSession: sessionStore.hasSaved(g.id) })));
});

app.get('/api/games/:id', (req, res) => {
  try {
    res.json(gameStore.readGame(req.params.id));
  } catch (e) {
    res.status(404).json({ error: 'not_found' });
  }
});

app.post('/api/games', (req, res) => {
  const { name, categoryCount, questionCount } = req.body;
  const game = gameStore.createGame({ name, categoryCount, questionCount });
  res.json(game);
});

app.put('/api/games/:id', (req, res) => {
  gameStore.writeGame(req.params.id, req.body);
  res.json({ ok: true });
});

app.post('/api/games/:id/images', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.json({ path: null });
    return;
  }
  const filename = `${Date.now()}-${path.basename(req.file.originalname)}`;
  const relativePath = gameStore.saveImage(req.params.id, filename, req.file.buffer);
  res.json({ path: relativePath });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wsHandlers.attach(wss);
state.loadBulbs(require('../bulbs.json'));

server.listen(PORT, () => {
  console.log(`Jeopardy buzzer server running at http://localhost:${PORT}`);
});

module.exports = { app, server };
