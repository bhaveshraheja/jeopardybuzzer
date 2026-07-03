const { execFile } = require('child_process');
const path = require('path');

const SOUNDS_DIR = path.join(__dirname, '..', 'sounds');

function play(name) {
  const filePath = path.join(SOUNDS_DIR, `${name}.mp3`);
  execFile('afplay', [filePath], (err) => {
    if (err) console.error(`Failed to play sound "${name}":`, err.message);
  });
}

module.exports = { play };
