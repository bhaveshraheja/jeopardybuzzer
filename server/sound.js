const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOUNDS_DIR = path.join(__dirname, '..', 'sounds');
const WAIT_FILE = path.join(SOUNDS_DIR, 'wait.mp3');
let waiting = false;
let waitingPlayer = null;
let waitingTimer = null;
let waitingGeneration = 0;

function play(name, onEnd) {
  const filePath = path.join(SOUNDS_DIR, `${name}.mp3`);
  execFile('afplay', [filePath], (err) => {
    if (err) console.error(`Failed to play sound "${name}":`, err.message);
    if (onEnd) onEnd();
  });
}

function startWaitingMusic() {
  if (waiting || !fs.existsSync(WAIT_FILE)) return;
  waiting = true;
  const generation = ++waitingGeneration;

  function playLoop() {
    if (!waiting || generation !== waitingGeneration) return;
    const player = spawn('afplay', ['-v', '0.35', WAIT_FILE], { stdio: 'ignore' });
    waitingPlayer = player;
    player.once('error', (err) => {
      if (waiting && generation === waitingGeneration) {
        waiting = false;
        console.error('Failed to play waiting music:', err.message);
      }
    });
    player.once('close', (code) => {
      if (waitingPlayer === player) waitingPlayer = null;
      if (!waiting || generation !== waitingGeneration) return;
      if (code !== 0) {
        waiting = false;
        console.error(`Waiting music exited with code ${code}`);
        return;
      }
      waitingTimer = setTimeout(playLoop, 0);
    });
  }

  playLoop();
}

function stopWaitingMusic() {
  waiting = false;
  waitingGeneration++;
  clearTimeout(waitingTimer);
  waitingTimer = null;
  if (waitingPlayer) {
    const player = waitingPlayer;
    waitingPlayer = null;
    player.kill();
  }
}

module.exports = { play, startWaitingMusic, stopWaitingMusic };
