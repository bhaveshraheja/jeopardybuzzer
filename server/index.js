const express = require('express');
const http = require('http');
const path = require('path');

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

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Jeopardy buzzer server running at http://localhost:${PORT}`);
});

module.exports = { app, server };
