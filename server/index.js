const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const gameStore = require('./gameStore');

const PORT = process.env.PORT || 3000;
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

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/games', (req, res) => {
  res.json(gameStore.listGames());
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
  const filename = `${Date.now()}-${req.file.originalname}`;
  const relativePath = gameStore.saveImage(req.params.id, filename, req.file.buffer);
  res.json({ path: relativePath });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Jeopardy buzzer server running at http://localhost:${PORT}`);
});

module.exports = { app, server };
