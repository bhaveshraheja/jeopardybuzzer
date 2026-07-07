const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '..', 'state');

function sessionPath(gameId) {
  return path.join(STATE_DIR, `${gameId}.json`);
}

function save(gameId, sessionState) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(sessionPath(gameId), JSON.stringify(sessionState));
}

function load(gameId) {
  const filePath = sessionPath(gameId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function remove(gameId) {
  const filePath = sessionPath(gameId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function hasSaved(gameId) {
  return fs.existsSync(sessionPath(gameId));
}

module.exports = { save, load, remove, hasSaved };
