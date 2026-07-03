# Jeopardy Buzzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted local-network Jeopardy-style quiz app with a TV board, host control panel, player buzzers, and a game editor, wired to Philips Wiz bulbs and Mac audio.

**Architecture:** One Node.js process (Express + `ws`) serves four static-HTML/vanilla-JS pages (`/board`, `/host`, `/buzz`, `/editor`) and a single `/ws` WebSocket endpoint. Live session state lives in server memory and is broadcast in full to every connected client on every change; game content (categories/questions/images) is persisted as JSON + image files per game and managed through a small REST API used only by the editor. Side effects (Wiz UDP commands, `afplay`) are fire-and-forget, triggered from state transitions.

**Tech Stack:** Node.js, Express, `ws`, `multer` (multipart image upload), Node's built-in `dgram` (UDP) and `child_process` (afplay). No build step, no TypeScript, no frontend framework.

## Global Constraints

- No automated tests of any kind — manual verification only, per the spec's explicit Section 9 decision. Every task ends with a manual check (console output, `curl`, or browser) instead of a test suite.
- No build step: plain `<script>` tags and vanilla JS/CSS/HTML under `public/`.
- Live session state (`SessionState`) is in-memory only — never written to disk. A server restart mid-round loses that round's progress by design.
- Game content is one JSON file per game at `games/<slug>/game.json`, with images alongside at `games/<slug>/images/`.
- WebSocket protocol is full-state broadcast, not granular events: the server always sends the complete current state, never deltas.
- Answer text must never reach non-host clients before the question reaches `"answer"` phase — this requires per-connection redaction (elaborated in Task 6), a concrete mechanism the spec didn't spell out but that its "host sees the answer before teams do" requirement implies.
- Spec ambiguity resolved here: the spec states "revealing the answer always closes the question (answer-shown and closed are the same state transition)." Taken completely literally this would make the TV skip straight back to the grid with no time to actually display the answer, which defeats the point of a reveal step. This plan resolves it as: `reveal_answer` immediately and irreversibly marks the board cell `"answered"` (the question is settled, can't be reopened or re-selected — that's the "closed" part), but keeps the TV in a distinct `"answer"` phase so the answer text is actually shown; the host then uses "Close Question" (or picks the next question) to return the TV to the grid. `mark_correct`/`mark_wrong`, by contrast, do go straight back to the grid in one step, since no separate answer-reveal beat is needed there.
- Bulb and sound side effects are best-effort: failures are swallowed (logged to server console at most), never surfaced as errors to players.
- Default port 3000, overridable via `PORT` env var.

---

## Task 1: Project Scaffolding & Static Server

**Files:**
- Create: `package.json`
- Create: `server/index.js`
- Create: `bulbs.json`
- Create: `public/board/index.html`, `public/host/index.html`, `public/buzz/index.html`, `public/editor/index.html` (placeholder pages)
- Create: `games/.gitkeep`, `sounds/.gitkeep`

**Interfaces:**
- Produces: an Express app listening on `PORT` (default 3000), serving `/board`, `/host`, `/buzz`, `/editor` as static directories, and a `GET /api/bulbs` route reading `bulbs.json`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "jeopardy-buzzer",
  "version": "1.0.0",
  "private": true,
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "ws": "^8.18.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors, `package-lock.json` written.

- [ ] **Step 3: Create `bulbs.json`**

```json
[
  { "id": "A", "ip": "192.168.1.101" },
  { "id": "B", "ip": "192.168.1.102" }
]
```

(Replace IPs with your actual Wiz bulb addresses later — placeholder values for now.)

- [ ] **Step 4: Create placeholder static pages**

`public/board/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Jeopardy Board</title></head>
<body><div id="root">Board placeholder</div></body>
</html>
```

`public/host/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Jeopardy Host</title></head>
<body><div id="root">Host placeholder</div></body>
</html>
```

`public/buzz/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Jeopardy Buzz</title></head>
<body><div id="root">Buzz placeholder</div></body>
</html>
```

`public/editor/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Jeopardy Editor</title></head>
<body><div id="root">Editor placeholder</div></body>
</html>
```

- [ ] **Step 5: Create empty `games/` and `sounds/` dirs with placeholders**

Run: `mkdir -p games sounds && touch games/.gitkeep sounds/.gitkeep`

- [ ] **Step 6: Create `server/index.js`**

```js
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
```

- [ ] **Step 7: Manual verification**

Run: `npm start`
Expected console output: `Jeopardy buzzer server running at http://localhost:3000`

In another terminal:
```bash
curl -s http://localhost:3000/api/bulbs
```
Expected: `[{"id":"A","ip":"192.168.1.101"},{"id":"B","ip":"192.168.1.102"}]`

```bash
curl -s http://localhost:3000/host | grep "Host placeholder"
```
Expected: matches the placeholder line. Stop the server with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json bulbs.json server/index.js public games/.gitkeep sounds/.gitkeep
git commit -m "Scaffold Express server and static pages for all four UIs"
```

---

## Task 2: Game Storage + Editor REST API

**Files:**
- Create: `server/gameStore.js`
- Modify: `server/index.js` (add `/api/games*` routes)

**Interfaces:**
- Produces: `gameStore.slugify(name)`, `gameStore.listGames()`, `gameStore.readGame(slug)`, `gameStore.createGame({name, categoryCount, questionCount})`, `gameStore.writeGame(slug, game)`, `gameStore.saveImage(slug, filename, buffer)` — used by `state.js` (Task 6, via `readGame`) and by the editor UI (Task 9, via the REST routes added here).
- Game JSON shape: `{ id, name, createdAt, categories: [{ name, questions: [{ value, question, answer, image }] }] }`, matching spec Section 2.

- [ ] **Step 1: Create `server/gameStore.js`**

```js
const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', 'games');

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function gameDir(slug) {
  return path.join(GAMES_DIR, slug);
}

function listGames() {
  if (!fs.existsSync(GAMES_DIR)) return [];
  return fs.readdirSync(GAMES_DIR)
    .filter((entry) => fs.existsSync(path.join(gameDir(entry), 'game.json')))
    .map((slug) => readGame(slug));
}

function readGame(slug) {
  const filePath = path.join(gameDir(slug), 'game.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createGame({ name, categoryCount, questionCount }) {
  const slug = slugify(name);
  fs.mkdirSync(path.join(gameDir(slug), 'images'), { recursive: true });

  const categories = Array.from({ length: categoryCount }, (_, i) => ({
    name: `Category ${i + 1}`,
    questions: Array.from({ length: questionCount }, (_, j) => ({
      value: (j + 1) * 100,
      question: '',
      answer: '',
      image: null
    }))
  }));

  const game = { id: slug, name, createdAt: new Date().toISOString(), categories };
  writeGame(slug, game);
  return game;
}

function writeGame(slug, game) {
  const filePath = path.join(gameDir(slug), 'game.json');
  fs.writeFileSync(filePath, JSON.stringify(game, null, 2));
}

function saveImage(slug, filename, buffer) {
  const imagesDir = path.join(gameDir(slug), 'images');
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.writeFileSync(path.join(imagesDir, filename), buffer);
  return `images/${filename}`;
}

module.exports = { slugify, listGames, readGame, createGame, writeGame, saveImage };
```

- [ ] **Step 2: Manual verification of `gameStore.js` in isolation**

Run:
```bash
node -e "
const gs = require('./server/gameStore');
const game = gs.createGame({ name: 'Test Game', categoryCount: 2, questionCount: 3 });
console.log(JSON.stringify(game, null, 2));
console.log('listGames:', gs.listGames().map(g => g.id));
"
```
Expected: prints a game object with `id: 'test-game'`, 2 categories each with 3 questions valued 100/200/300, and `listGames: [ 'test-game' ]`. Confirm `games/test-game/game.json` and `games/test-game/images/` now exist on disk.

Run: `rm -rf games/test-game` to clean up the manual test artifact.

- [ ] **Step 3: Add REST routes to `server/index.js`**

Add near the top, after other requires:
```js
const multer = require('multer');
const gameStore = require('./gameStore');
```

Add before `server.listen`:
```js
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
```

- [ ] **Step 4: Manual verification of the API**

Run: `npm start` in one terminal, then in another:
```bash
curl -s -X POST http://localhost:3000/api/games \
  -H "Content-Type: application/json" \
  -d '{"name":"Movie Night","categoryCount":2,"questionCount":2}'
```
Expected: JSON game object with `id: "movie-night"`.

```bash
curl -s http://localhost:3000/api/games
```
Expected: array containing the `movie-night` game.

```bash
curl -s -X PUT http://localhost:3000/api/games/movie-night \
  -H "Content-Type: application/json" \
  -d '{"id":"movie-night","name":"Movie Night","createdAt":"2026-07-03T00:00:00Z","categories":[{"name":"90s Films","questions":[{"value":100,"question":"Q1","answer":"A1","image":null},{"value":200,"question":"","answer":"","image":null}]},{"name":"Cat2","questions":[{"value":100,"question":"","answer":"","image":null},{"value":200,"question":"","answer":"","image":null}]}]}'
```
Expected: `{"ok":true}`. Confirm `games/movie-night/game.json` reflects the update (the "90s Films" category name and "Q1"/"A1" question text).

Stop the server. Leave `games/movie-night` in place — later tasks use it for manual verification too.

- [ ] **Step 5: Commit**

```bash
git add server/gameStore.js server/index.js games/movie-night
git commit -m "Add game storage module and editor REST API"
```

---

## Task 3: Wiz UDP Integration

**Status: revised after implementation.** The original version of this task specified a Promise-based ack-tracking/reachability heuristic. Task review found it had a real memory leak (pending entries for an unreachable bulb never cleared), incorrect reply-matching (one UDP reply could falsely ack multiple in-flight commands to the same bulb), and no socket-level error handler (risking a process crash, violating the "never throw" constraint). The project owner decided to drop the ack-tracking/reachability-heuristic feature entirely rather than fix it — bulb commands are now pure fire-and-forget, no `isUnreachable` status anywhere in the app. This supersedes spec Section 5's "bulb health (best-effort)" heuristic and the host-panel status dot — there is no bulb-health indicator in the app; a bulb that's offline just silently doesn't light up.

**Files:**
- Create: `server/wiz.js`

**Interfaces:**
- Produces: `wiz.warmWhite(bulb)`, `wiz.red(bulb)`, `wiz.testFlash(bulb)` — synchronous, fire-and-forget, no return value — consumed by `state.js` (Task 5/6). `bulb` is `{ id, ip }` as read from `bulbs.json`.

- [ ] **Step 1: Create `server/wiz.js`**

```js
const dgram = require('dgram');

const WIZ_PORT = 38899;

const socket = dgram.createSocket('udp4');

socket.on('error', (err) => {
  console.error('Wiz UDP socket error:', err.message);
});

socket.bind();

function sendCommand(bulb, params) {
  const message = Buffer.from(JSON.stringify({ method: 'setPilot', params }));
  socket.send(message, WIZ_PORT, bulb.ip, (err) => {
    if (err) console.error(`Failed to send command to bulb ${bulb.id}:`, err.message);
  });
}

function warmWhite(bulb) {
  sendCommand(bulb, { state: true, temp: 2700, dimming: 100 });
}

function red(bulb) {
  sendCommand(bulb, { state: true, r: 255, g: 0, b: 0, dimming: 100 });
}

function testFlash(bulb) {
  sendCommand(bulb, { state: true, r: 0, g: 0, b: 255, dimming: 100 });
}

module.exports = { warmWhite, red, testFlash, sendCommand };
```

- [ ] **Step 2: Manual verification**

With real Wiz bulb IPs saved in `bulbs.json`, run:
```bash
node -e "
const wiz = require('./server/wiz');
const bulbs = require('./bulbs.json');
wiz.red(bulbs[0]);
setTimeout(() => wiz.warmWhite(bulbs[0]), 1500);
setTimeout(() => process.exit(0), 3000);
"
```
Expected: the script runs to completion with no exceptions; if a real bulb is reachable at that IP, it visibly turns red, then warm white.

Also confirm no crash against an unreachable IP (e.g. `10.255.255.1` passed as a literal object, not written into `bulbs.json`) — the script should still complete cleanly.

- [ ] **Step 3: Commit**

```bash
git add server/wiz.js
git commit -m "Simplify Wiz bulb control to fire-and-forget, remove ack-tracking heuristic"
```

---

## Task 4: Sound Integration

**Files:**
- Create: `server/sound.js`
- Create (or obtain): `sounds/buzz.mp3`, `sounds/miss.mp3`, `sounds/reset.mp3`

**Interfaces:**
- Produces: `sound.play(name)` where `name` is `"buzz"`, `"miss"`, or `"reset"` — consumed by `state.js` (Task 6).

- [ ] **Step 1: Create `server/sound.js`**

```js
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
```

- [ ] **Step 2: Add placeholder sound files**

You'll need three short MP3s at `sounds/buzz.mp3`, `sounds/miss.mp3`, `sounds/reset.mp3` (e.g. a buzz/ding/chime — source these yourself; any short royalty-free clip works). For now, if you don't have final assets yet, use any three placeholder MP3s so the verification step below has something to play — swap in real sounds later.

- [ ] **Step 3: Manual verification**

Run:
```bash
node -e "require('./server/sound').play('buzz')"
```
Expected: you hear the sound play through your Mac's speakers within ~1 second. Repeat for `'miss'` and `'reset'`.

Run:
```bash
node -e "require('./server/sound').play('does-not-exist')"
```
Expected: prints `Failed to play sound "does-not-exist": ...` to console, process exits cleanly (no crash).

- [ ] **Step 4: Commit**

```bash
git add server/sound.js sounds/buzz.mp3 sounds/miss.mp3 sounds/reset.mp3
git commit -m "Add afplay-based sound trigger module"
```

---

## Task 5: Session State Module

**Files:**
- Create: `server/state.js`

**Interfaces:**
- Consumes: `gameStore.readGame(slug)` (Task 2), `wiz.warmWhite/red/testFlash(bulb)` (Task 3), `sound.play(name)` (Task 4).
- Produces (all consumed by `wsHandlers.js` in Task 6):
  - `state.loadBulbs(bulbList)`, `state.getState()` → current `SessionState`
  - `state.loadGame(gameId)`, `state.setupTeams(teamConfigs)`, `state.joinTeam(teamId, name)`, `state.testBulb(bulbId)`
  - `state.startIntro()`, `state.nextCategory()`, `state.endIntro()`
  - `state.selectQuestion(categoryIdx, questionIdx)`, `state.buzz(teamId)` → `{ accepted: boolean, reason?: string }`, `state.rejectBuzz()`
  - `state.markCorrect(teamId)`, `state.markWrong(teamId)`, `state.revealAnswer()`, `state.closeQuestion()`, `state.resetBuzzer()`
- `SessionState` shape (per spec Section 2):
```
{
  gameId, game,
  teams: [{ id, name, members: string[], score, bulbId }],
  board: ("unanswered"|"answered")[][],
  phase: "intro" | "board" | "question" | "answer",
  introCategoryIdx,
  currentQuestion: { categoryIdx, questionIdx, questionStartedAt } | null,
  buzzWinner: string | null,
  answeredBy: string[]
}
```

- [ ] **Step 1: Create `server/state.js`**

```js
const wiz = require('./wiz');
const sound = require('./sound');
const { readGame } = require('./gameStore');

let bulbs = [];

function loadBulbs(bulbList) {
  bulbs = bulbList;
}

function getBulb(bulbId) {
  return bulbs.find((b) => b.id === bulbId);
}

function createEmptyState() {
  return {
    gameId: null,
    game: null,
    teams: [],
    board: [],
    phase: 'board',
    introCategoryIdx: 0,
    currentQuestion: null,
    buzzWinner: null,
    answeredBy: []
  };
}

let state = createEmptyState();

function getState() {
  return state;
}

function loadGame(gameId) {
  const game = readGame(gameId);
  state = createEmptyState();
  state.gameId = gameId;
  state.game = game;
  state.board = game.categories.map((cat) => cat.questions.map(() => 'unanswered'));
  return state;
}

function slugifyTeamId(name) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function setupTeams(teamConfigs) {
  state.teams = teamConfigs.map(({ name, bulbId }) => ({
    id: slugifyTeamId(name),
    name,
    members: [],
    score: 0,
    bulbId
  }));
  state.teams.forEach((team) => {
    const bulb = getBulb(team.bulbId);
    if (bulb) wiz.warmWhite(bulb);
  });
  return state;
}

function joinTeam(teamId, name) {
  const team = state.teams.find((t) => t.id === teamId);
  if (team && !team.members.includes(name)) {
    team.members.push(name);
  }
  return state;
}

function testBulb(bulbId) {
  const bulb = getBulb(bulbId);
  if (!bulb) return state;
  wiz.testFlash(bulb);
  setTimeout(() => wiz.warmWhite(bulb), 1000);
  return state;
}

function startIntro() {
  state.phase = 'intro';
  state.introCategoryIdx = 0;
  return state;
}

function nextCategory() {
  if (state.introCategoryIdx < state.game.categories.length - 1) {
    state.introCategoryIdx += 1;
  }
  return state;
}

function endIntro() {
  state.phase = 'board';
  return state;
}

function selectQuestion(categoryIdx, questionIdx) {
  state.phase = 'question';
  state.currentQuestion = { categoryIdx, questionIdx, questionStartedAt: Date.now() };
  state.buzzWinner = null;
  state.answeredBy = [];
  return state;
}

function getCurrentQuestion() {
  if (!state.currentQuestion) return null;
  const { categoryIdx, questionIdx } = state.currentQuestion;
  return state.game.categories[categoryIdx].questions[questionIdx];
}

function buzz(teamId) {
  if (state.phase !== 'question') return { accepted: false, reason: 'not_open' };
  if (state.buzzWinner) return { accepted: false, reason: 'already_tried' };
  if (state.answeredBy.includes(teamId)) return { accepted: false, reason: 'already_tried' };

  state.buzzWinner = teamId;
  const team = state.teams.find((t) => t.id === teamId);
  if (team) {
    const bulb = getBulb(team.bulbId);
    if (bulb) wiz.red(bulb);
  }
  sound.play('buzz');
  return { accepted: true };
}

function rejectBuzz() {
  sound.play('miss');
}

function markCorrect(teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  const question = getCurrentQuestion();
  if (team && question) team.score += question.value;
  closeQuestion();
  return state;
}

function markWrong(teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  const question = getCurrentQuestion();
  if (team && question) team.score -= question.value;
  state.answeredBy.push(teamId);
  resetBuzzer();
  if (state.answeredBy.length >= state.teams.length) {
    closeQuestion();
  }
  return state;
}

function markAnswered() {
  if (state.currentQuestion) {
    const { categoryIdx, questionIdx } = state.currentQuestion;
    state.board[categoryIdx][questionIdx] = 'answered';
  }
}

function revealAnswer() {
  markAnswered();
  state.phase = 'answer';
  state.buzzWinner = null;
  state.answeredBy = [];
  return state;
}

function closeQuestion() {
  markAnswered();
  state.phase = 'board';
  state.currentQuestion = null;
  state.buzzWinner = null;
  state.answeredBy = [];
  return state;
}

function resetBuzzer() {
  state.buzzWinner = null;
  sound.play('reset');
  state.teams.forEach((team) => {
    const bulb = getBulb(team.bulbId);
    if (bulb) wiz.warmWhite(bulb);
  });
  return state;
}

module.exports = {
  loadBulbs, getState, loadGame, setupTeams, joinTeam, testBulb,
  startIntro, nextCategory, endIntro, selectQuestion, buzz, rejectBuzz,
  markCorrect, markWrong, revealAnswer, closeQuestion, resetBuzzer, getCurrentQuestion
};
```

- [ ] **Step 2: Manual verification — game load and team setup**

Run:
```bash
node -e "
const state = require('./server/state');
state.loadBulbs(require('./bulbs.json'));
console.log('after loadGame:', JSON.stringify(state.loadGame('movie-night').board));
console.log('after setupTeams:', JSON.stringify(state.setupTeams([{name:'Red Team', bulbId:'A'},{name:'Blue Team', bulbId:'B'}]).teams));
"
```
Expected: `after loadGame` prints a 2x2 array of `"unanswered"`. `after setupTeams` prints two team objects with generated `id`s, `members: []`, `score: 0`, and the given `bulbId`s. (Uses the `games/movie-night` game created in Task 2.)

- [ ] **Step 3: Manual verification — buzz/correct/wrong flow**

Run:
```bash
node -e "
const state = require('./server/state');
state.loadBulbs(require('./bulbs.json'));
state.loadGame('movie-night');
const teams = state.setupTeams([{name:'Red', bulbId:'A'},{name:'Blue', bulbId:'B'}]).teams;
state.selectQuestion(0, 0);
console.log('buzz Red:', state.buzz(teams[0].id));
console.log('buzz Blue (should be rejected):', state.buzz(teams[1].id));
console.log('markWrong Red:', JSON.stringify(state.markWrong(teams[0].id).teams));
console.log('buzz Blue (should now be accepted):', state.buzz(teams[1].id));
console.log('markCorrect Blue:', JSON.stringify(state.markCorrect(teams[1].id)));
"
```
Expected: first buzz accepted (`{accepted:true}`), second buzz rejected (`{accepted:false, reason:'already_tried'}`), Red's score is `-100` after `markWrong`, Blue's second buzz is accepted, and after `markCorrect` Blue's score is `100`, `phase` is `'board'`, `board[0][0]` is `'answered'`, `currentQuestion` is `null`.

- [ ] **Step 4: Commit**

```bash
git add server/state.js
git commit -m "Add in-memory session state module with full question/buzz flow"
```

---

## Task 6: WebSocket Handlers + Server Wiring

**Files:**
- Create: `server/wsHandlers.js`
- Modify: `server/index.js` (attach `ws` server, load bulbs on boot)

**Interfaces:**
- Consumes: all of `state.js`'s exports (Task 5). (No bulb-health enrichment — Task 3 dropped the ack-tracking/reachability heuristic entirely; there is no `wiz.isUnreachable` anymore.)
- Produces: `wsHandlers.attach(wss)` — called once from `index.js`. Defines the wire protocol: client messages `{ type, ...payload }` per spec Section 4, server responses `{ type: "state_update", state }` (broadcast, role-redacted) and `{ type: "buzz_rejected", reason }` (sent to the single losing client only).
- Redaction rule: a connection's `role` (from `?role=` query param: `"host"`, `"board"`, or `"player"`) determines whether `question.answer` fields are visible. Only the host always sees every answer; non-host roles only see the `answer` of the exact `currentQuestion` once `phase === "answer"` — all other questions' `answer` fields are nulled out in what's sent to them.

- [ ] **Step 1: Create `server/wsHandlers.js`**

```js
const state = require('./state');

function connectionRole(req) {
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get('role');
  return role === 'host' || role === 'board' ? role : 'player';
}

function redactedState(role) {
  const snapshot = JSON.parse(JSON.stringify(state.getState()));
  if (role === 'host' || !snapshot.game) return snapshot;

  snapshot.game.categories.forEach((category, cIdx) => {
    category.questions.forEach((question, qIdx) => {
      const isRevealed = snapshot.phase === 'answer' &&
        snapshot.currentQuestion &&
        snapshot.currentQuestion.categoryIdx === cIdx &&
        snapshot.currentQuestion.questionIdx === qIdx;
      if (!isRevealed) question.answer = null;
    });
  });
  return snapshot;
}

function sendState(ws) {
  ws.send(JSON.stringify({ type: 'state_update', state: redactedState(ws.role) }));
}

function broadcast(wss) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) sendState(client);
  });
}

function handleMessage(ws, msg, wss) {
  switch (msg.type) {
    case 'join_team':
      state.joinTeam(msg.teamId, msg.name);
      break;
    case 'buzz': {
      const result = state.buzz(msg.teamId);
      if (!result.accepted) {
        state.rejectBuzz();
        ws.send(JSON.stringify({ type: 'buzz_rejected', reason: result.reason }));
        return;
      }
      break;
    }
    case 'setup_teams':
      state.setupTeams(msg.teams);
      break;
    case 'test_bulb':
      state.testBulb(msg.bulbId);
      break;
    case 'load_game':
      state.loadGame(msg.gameId);
      break;
    case 'start_intro':
      state.startIntro();
      break;
    case 'next_category':
      state.nextCategory();
      break;
    case 'end_intro':
      state.endIntro();
      break;
    case 'select_question':
      state.selectQuestion(msg.categoryIdx, msg.questionIdx);
      break;
    case 'reveal_answer':
      state.revealAnswer();
      break;
    case 'mark_correct':
      state.markCorrect(msg.teamId);
      break;
    case 'mark_wrong':
      state.markWrong(msg.teamId);
      break;
    case 'close_question':
      state.closeQuestion();
      break;
    case 'reset_buzzer':
      state.resetBuzzer();
      break;
    default:
      return;
  }
  broadcast(wss);
}

function attach(wss) {
  wss.on('connection', (ws, req) => {
    ws.role = connectionRole(req);
    sendState(ws);

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return;
      }
      handleMessage(ws, msg, wss);
    });
  });
}

module.exports = { attach, broadcast, redactedState };
```

- [ ] **Step 2: Wire into `server/index.js`**

Add near the top:
```js
const { WebSocketServer } = require('ws');
const state = require('./state');
const wsHandlers = require('./wsHandlers');
```

Replace the `const server = http.createServer(app);` / `server.listen(...)` block at the bottom with:
```js
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
wsHandlers.attach(wss);
state.loadBulbs(require('../bulbs.json'));

server.listen(PORT, () => {
  console.log(`Jeopardy buzzer server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Manual verification**

Run: `npm start`, then in another terminal use Node itself as a quick WS client (no extra deps needed):
```bash
node -e "
const WebSocket = require('ws');
const host = new WebSocket('ws://localhost:3000/ws?role=host');
const player = new WebSocket('ws://localhost:3000/ws?role=player');

host.on('message', (m) => console.log('HOST sees:', m.toString()));
player.on('message', (m) => console.log('PLAYER sees:', m.toString()));

host.on('open', () => {
  setTimeout(() => host.send(JSON.stringify({ type: 'load_game', gameId: 'movie-night' })), 300);
  setTimeout(() => host.send(JSON.stringify({ type: 'select_question', categoryIdx: 0, questionIdx: 0 })), 600);
  setTimeout(() => process.exit(0), 1200);
});
"
```
Expected: both HOST and PLAYER receive an initial `state_update`. After `load_game` and `select_question`, both receive updated `state_update` messages — but in the PLAYER's messages, `categories[0].questions[0].answer` is `null`, while in the HOST's messages it shows the real answer text (`"A1"` from Task 2's manual PUT). Stop the server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add server/wsHandlers.js server/index.js
git commit -m "Add role-aware WebSocket broadcast with answer redaction"
```

---

## Task 7: Shared WebSocket Client Helper

**Files:**
- Create: `public/shared/ws-client.js`

**Interfaces:**
- Produces: global function `createWsClient({ role, onState, onBuzzRejected })` returning `{ send(type, payload) }`. Dispatches `ws-connected` / `ws-disconnected` `CustomEvent`s on `document`. Consumed by `board.js`, `host.js`, `buzz.js` (Tasks 9-11).

- [ ] **Step 1: Create `public/shared/ws-client.js`**

```js
function createWsClient({ role, onState, onBuzzRejected }) {
  let ws;
  let reconnectTimer;

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}/ws?role=${role}`);

    ws.addEventListener('open', () => {
      clearTimeout(reconnectTimer);
      document.dispatchEvent(new CustomEvent('ws-connected'));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state_update') onState(msg.state);
      if (msg.type === 'buzz_rejected' && onBuzzRejected) onBuzzRejected(msg.reason);
    });

    ws.addEventListener('close', () => {
      document.dispatchEvent(new CustomEvent('ws-disconnected'));
      reconnectTimer = setTimeout(connect, 1500);
    });

    ws.addEventListener('error', () => ws.close());
  }

  function send(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...(payload || {}) }));
    }
  }

  connect();
  return { send };
}
```

- [ ] **Step 2: Manual verification**

Add `<script src="/shared/ws-client.js"></script>` temporarily to `public/host/index.html` before `</body>`, then run `npm start` and open `http://localhost:3000/host` in a browser. Open the browser dev console and run:
```js
const c = createWsClient({ role: 'host', onState: (s) => console.log('state:', s) });
```
Expected: console logs a `state:` line immediately (the initial broadcast). Turn off wifi/network briefly (or stop the server) — expect no uncaught errors, and once reconnected/restarted, a fresh `state:` log appears automatically within ~1.5s. Remove the temporary script tag from `host/index.html` afterward (Task 9 adds it properly).

- [ ] **Step 3: Commit**

```bash
git add public/shared/ws-client.js
git commit -m "Add shared WebSocket client with auto-reconnect"
```

---

## Task 8: Editor UI

**Files:**
- Modify: `public/editor/index.html`
- Create: `public/editor/editor.js`
- Create: `public/editor/editor.css`

**Interfaces:**
- Consumes: `GET/POST /api/games`, `GET/PUT /api/games/:id`, `POST /api/games/:id/images` (Task 2).
- No WebSocket usage — the editor is pure REST, per Global Constraints (WS protocol is only for live session state).

- [ ] **Step 1: Write `public/editor/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Jeopardy Editor</title>
  <link rel="stylesheet" href="editor.css" />
</head>
<body>
  <h1>Game Editor</h1>
  <div class="new-game">
    <input type="text" id="new-game-name" placeholder="Game name" />
    <input type="number" id="new-game-categories" placeholder="# categories" value="5" />
    <input type="number" id="new-game-questions" placeholder="# questions per category" value="5" />
    <button id="create-game-btn">Create Game</button>
  </div>
  <div id="games-list"></div>
  <div id="editor-grid"></div>
  <div id="question-modal" style="display:none;"></div>
  <script src="editor.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `public/editor/editor.css`**

```css
body { font-family: sans-serif; margin: 2rem; }
.grid { display: flex; gap: 1rem; }
.column { display: flex; flex-direction: column; gap: 0.5rem; width: 150px; }
.category-name { font-weight: bold; }
.cell { padding: 1rem; cursor: pointer; }
#question-modal { position: fixed; top: 10%; left: 10%; right: 10%; background: white; border: 2px solid black; padding: 1rem; }
#question-modal textarea { width: 100%; height: 4rem; display: block; margin-bottom: 0.5rem; }
```

- [ ] **Step 3: Write `public/editor/editor.js`**

```js
let currentGame = null;

async function loadGamesList() {
  const games = await fetch('/api/games').then((r) => r.json());
  const list = document.getElementById('games-list');
  list.innerHTML = games.map((g) => `<button class="game-item" data-id="${g.id}">${g.name}</button>`).join('');
  list.querySelectorAll('.game-item').forEach((btn) => {
    btn.addEventListener('click', () => openGame(btn.dataset.id));
  });
}
loadGamesList();

document.getElementById('create-game-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-game-name').value.trim();
  const categoryCount = Number(document.getElementById('new-game-categories').value);
  const questionCount = Number(document.getElementById('new-game-questions').value);
  if (!name || !categoryCount || !questionCount) return;
  const game = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, categoryCount, questionCount })
  }).then((r) => r.json());
  await loadGamesList();
  openGame(game.id);
});

async function openGame(id) {
  currentGame = await fetch(`/api/games/${id}`).then((r) => r.json());
  renderGrid();
}

function renderGrid() {
  const root = document.getElementById('editor-grid');
  if (!currentGame) { root.innerHTML = ''; return; }
  let html = '<div class="grid">';
  currentGame.categories.forEach((category, cIdx) => {
    html += `<div class="column"><input class="category-name" data-c="${cIdx}" value="${category.name}" />`;
    category.questions.forEach((q, qIdx) => {
      html += `<button class="cell" data-c="${cIdx}" data-q="${qIdx}">${q.value}</button>`;
    });
    html += '</div>';
  });
  html += '</div>';
  root.innerHTML = html;

  root.querySelectorAll('.category-name').forEach((input) => {
    input.addEventListener('change', () => {
      currentGame.categories[Number(input.dataset.c)].name = input.value;
      saveGame();
    });
  });
  root.querySelectorAll('.cell').forEach((btn) => {
    btn.addEventListener('click', () => openQuestionEditor(Number(btn.dataset.c), Number(btn.dataset.q)));
  });
}

function openQuestionEditor(cIdx, qIdx) {
  const question = currentGame.categories[cIdx].questions[qIdx];
  const modal = document.getElementById('question-modal');
  modal.style.display = 'block';
  modal.innerHTML = `
    <textarea id="q-text" placeholder="Question">${question.question}</textarea>
    <textarea id="a-text" placeholder="Answer">${question.answer}</textarea>
    <input type="file" id="q-image" accept="image/*" />
    ${question.image ? `<img src="/games/${currentGame.id}/${question.image}" width="200" />` : ''}
    <button id="save-question-btn">Save</button>
    <button id="close-modal-btn">Close</button>
  `;

  document.getElementById('save-question-btn').addEventListener('click', async () => {
    question.question = document.getElementById('q-text').value;
    question.answer = document.getElementById('a-text').value;

    const fileInput = document.getElementById('q-image');
    if (fileInput.files[0]) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const result = await fetch(`/api/games/${currentGame.id}/images`, {
        method: 'POST', body: formData
      }).then((r) => r.json());
      question.image = result.path;
    }

    await saveGame();
    modal.style.display = 'none';
    renderGrid();
  });

  document.getElementById('close-modal-btn').addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

async function saveGame() {
  await fetch(`/api/games/${currentGame.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentGame)
  });
}
```

- [ ] **Step 4: Manual verification in browser**

Run `npm start`, open `http://localhost:3000/editor`.
1. Create a new game "Test Night" with 3 categories, 2 questions each → grid of 3 columns × 2 cells (100/200) appears.
2. Click a cell → modal opens with empty question/answer fields.
3. Type a question and answer, upload any image file, click Save → modal closes, grid re-renders.
4. Reload the page, click the game in the list, click the same cell → confirm question/answer text and the uploaded image persisted.
5. Edit a category name in the text input, click elsewhere (blur/change event) → reload page, confirm the new name persisted.

- [ ] **Step 5: Commit**

```bash
git add public/editor
git commit -m "Add game editor UI with grid, question modal, and image upload"
```

---

## Task 9: Host UI

**Files:**
- Modify: `public/host/index.html`
- Create: `public/host/host.js`
- Create: `public/host/host.css`

**Interfaces:**
- Consumes: `createWsClient` (Task 7), `GET /api/bulbs` (Task 1), `GET /api/games` (Task 2), and sends every host-originated WS message type defined in Task 6 (`setup_teams`, `test_bulb`, `load_game`, `start_intro`, `next_category`, `end_intro`, `select_question`, `reveal_answer`, `mark_correct`, `mark_wrong`, `close_question`, `reset_buzzer`). No bulb-health status is rendered — Task 3 dropped the reachability heuristic entirely.

- [ ] **Step 1: Write `public/host/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Jeopardy Host</title>
  <link rel="stylesheet" href="host.css" />
</head>
<body>
  <h1>Host Panel</h1>

  <section id="setup-section">
    <select id="game-select"></select>
    <button id="load-game-btn">Load Game</button>
    <div id="teams-setup"></div>
    <button id="add-team-btn">Add Team</button>
    <button id="save-teams-btn">Save Teams</button>
  </section>

  <section id="intro-controls">
    <button id="start-intro-btn">Start Category Intro</button>
    <button id="next-category-btn">Next Category</button>
    <button id="end-intro-btn">End Intro / Show Board</button>
  </section>

  <div id="board-grid"></div>
  <div id="question-panel"></div>
  <div id="team-scores"></div>

  <section id="question-controls">
    <button id="reveal-answer-btn">Reveal Answer</button>
    <button id="close-question-btn">Close Question</button>
    <button id="reset-buzzer-btn">Reset Buzzer</button>
  </section>

  <script src="/shared/ws-client.js"></script>
  <script src="host.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `public/host/host.css`**

```css
body { font-family: sans-serif; margin: 1rem; }
.column { display: inline-flex; flex-direction: column; gap: 0.5rem; margin-right: 1rem; }
.cell { padding: 1rem; }
.cell:disabled { opacity: 0.3; }
.timer.late { color: red; font-weight: bold; }
.team-row { margin-bottom: 0.5rem; }
```

- [ ] **Step 3: Write `public/host/host.js`**

```js
let bulbs = [];
let currentState = null;

const client = createWsClient({
  role: 'host',
  onState: (state) => {
    currentState = state;
    render(state);
  }
});

fetch('/api/bulbs').then((r) => r.json()).then((data) => { bulbs = data; });

async function loadGamesList() {
  const games = await fetch('/api/games').then((r) => r.json());
  const select = document.getElementById('game-select');
  select.innerHTML = games.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
}
loadGamesList();

document.getElementById('load-game-btn').addEventListener('click', () => {
  const gameId = document.getElementById('game-select').value;
  client.send('load_game', { gameId });
});

document.getElementById('add-team-btn').addEventListener('click', addTeamRow);

function addTeamRow() {
  const container = document.getElementById('teams-setup');
  const row = document.createElement('div');
  row.className = 'team-row';
  row.innerHTML = `
    <input type="text" class="team-name" placeholder="Team name" />
    <select class="team-bulb">${bulbs.map((b) => `<option value="${b.id}">${b.id}</option>`).join('')}</select>
    <button type="button" class="test-bulb-btn">Test Bulb</button>
  `;
  row.querySelector('.test-bulb-btn').addEventListener('click', () => {
    client.send('test_bulb', { bulbId: row.querySelector('.team-bulb').value });
  });
  container.appendChild(row);
}

document.getElementById('save-teams-btn').addEventListener('click', () => {
  const rows = document.querySelectorAll('.team-row');
  const teams = Array.from(rows)
    .map((row) => ({
      name: row.querySelector('.team-name').value,
      bulbId: row.querySelector('.team-bulb').value
    }))
    .filter((t) => t.name);
  client.send('setup_teams', { teams });
});

document.getElementById('start-intro-btn').addEventListener('click', () => client.send('start_intro'));
document.getElementById('next-category-btn').addEventListener('click', () => client.send('next_category'));
document.getElementById('end-intro-btn').addEventListener('click', () => client.send('end_intro'));
document.getElementById('reset-buzzer-btn').addEventListener('click', () => client.send('reset_buzzer'));
document.getElementById('close-question-btn').addEventListener('click', () => client.send('close_question'));
document.getElementById('reveal-answer-btn').addEventListener('click', () => client.send('reveal_answer'));

function render(state) {
  renderBoardGrid(state);
  renderQuestionPanel(state);
  renderTeamScores(state);
}

function renderBoardGrid(state) {
  const root = document.getElementById('board-grid');
  if (!state.game) { root.innerHTML = ''; return; }
  let html = '';
  state.game.categories.forEach((category, cIdx) => {
    html += `<div class="column"><div class="header">${category.name}</div>`;
    category.questions.forEach((q, qIdx) => {
      const answered = state.board[cIdx][qIdx] === 'answered';
      html += `<button class="cell" data-c="${cIdx}" data-q="${qIdx}" ${answered ? 'disabled' : ''}>${q.value}</button>`;
    });
    html += '</div>';
  });
  root.innerHTML = html;
  root.querySelectorAll('.cell:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      client.send('select_question', { categoryIdx: Number(btn.dataset.c), questionIdx: Number(btn.dataset.q) });
    });
  });
}

let timerInterval;
function renderQuestionPanel(state) {
  const root = document.getElementById('question-panel');
  if (!state.currentQuestion) {
    root.innerHTML = '<p>No question selected</p>';
    clearInterval(timerInterval);
    return;
  }
  const { categoryIdx, questionIdx, questionStartedAt } = state.currentQuestion;
  const question = state.game.categories[categoryIdx].questions[questionIdx];

  root.innerHTML = `
    <div class="q-text">${question.question}</div>
    <div class="a-text">Answer: ${question.answer}</div>
    <div class="timer" id="host-timer">0s</div>
    <div class="buzz-winner">${state.buzzWinner ? teamName(state, state.buzzWinner) : 'No buzz yet'}</div>
    <div class="team-buttons">
      ${state.teams.map((t) => `
        <span>${t.name}
          <button class="correct-btn" data-team="${t.id}" ${state.buzzWinner === t.id ? '' : 'disabled'}>Correct</button>
          <button class="wrong-btn" data-team="${t.id}" ${state.buzzWinner === t.id ? '' : 'disabled'}>Wrong</button>
        </span>`).join('')}
    </div>
  `;

  root.querySelectorAll('.correct-btn').forEach((btn) =>
    btn.addEventListener('click', () => client.send('mark_correct', { teamId: btn.dataset.team })));
  root.querySelectorAll('.wrong-btn').forEach((btn) =>
    btn.addEventListener('click', () => client.send('mark_wrong', { teamId: btn.dataset.team })));

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('host-timer');
    if (!el) { clearInterval(timerInterval); return; }
    const seconds = Math.floor((Date.now() - questionStartedAt) / 1000);
    el.textContent = `${seconds}s`;
    el.classList.toggle('late', seconds > 15);
  }, 250);
}

function teamName(state, teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  return team ? team.name : teamId;
}

function renderTeamScores(state) {
  const root = document.getElementById('team-scores');
  root.innerHTML = state.teams.map((t) => `<div>${t.name}: ${t.score}</div>`).join('');
}
```

- [ ] **Step 4: Manual verification in browser**

Run `npm start`, open `http://localhost:3000/host`.
1. Select "Movie Night" (or "Test Night" from Task 8) in the dropdown, click "Load Game" → board grid appears with category columns.
2. Click "Add Team" twice, name them "Red"/"Blue", pick bulb A/B, click "Test Bulb" for each (if hardware is connected, confirm the correct bulb flashes blue then returns to warm white).
3. Click "Save Teams" → team scores section shows `Red: 0`, `Blue: 0`.
4. Click a board cell → question panel shows question/answer text, timer starts counting, turns red past 15s.
5. Confirm Correct/Wrong buttons are disabled until a buzz occurs (verified together with Task 10's buzzer in Task 12's end-to-end pass — for now confirm they render disabled with no buzz winner).
6. Click "Close Question" → question panel clears, board cell shows disabled/answered.

- [ ] **Step 5: Commit**

```bash
git add public/host
git commit -m "Add host control panel UI"
```

---

## Task 10: Buzzer UI

**Files:**
- Modify: `public/buzz/index.html`
- Create: `public/buzz/buzz.js`
- Create: `public/buzz/buzz.css`

**Interfaces:**
- Consumes: `createWsClient` (Task 7); sends `join_team`, `buzz`; listens for `buzz_rejected` via `onBuzzRejected`, and `ws-connected`/`ws-disconnected` events for the reconnect banner.

- [ ] **Step 1: Write `public/buzz/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Jeopardy Buzz</title>
  <link rel="stylesheet" href="buzz.css" />
</head>
<body>
  <div id="disconnect-banner" style="display:none;">Disconnected — reconnecting...</div>
  <div id="root"></div>
  <script src="/shared/ws-client.js"></script>
  <script src="buzz.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `public/buzz/buzz.css`**

```css
body { font-family: sans-serif; margin: 0; text-align: center; }
#disconnect-banner { background: darkred; color: white; padding: 0.5rem; }
.buzz-button { width: 90vw; height: 60vh; font-size: 3rem; margin-top: 2rem; }
.team-pick { display: block; width: 90vw; margin: 0.5rem auto; padding: 1rem; font-size: 1.5rem; }
```

- [ ] **Step 3: Write `public/buzz/buzz.js`**

```js
let myTeamId = null;
let currentState = null;

const client = createWsClient({
  role: 'player',
  onState: (state) => { currentState = state; render(state); },
  onBuzzRejected: (reason) => showFeedback(reason)
});

function render(state) {
  if (!myTeamId) {
    renderTeamPicker(state);
  } else {
    renderBuzzer(state);
  }
}

function renderTeamPicker(state) {
  const root = document.getElementById('root');
  if (!state.teams.length) {
    root.innerHTML = '<p>Waiting for host to set up teams...</p>';
    return;
  }
  root.innerHTML = `
    <h1>Pick your team</h1>
    <input type="text" id="player-name" placeholder="Your name" />
    ${state.teams.map((t) => `<button class="team-pick" data-team="${t.id}">${t.name}</button>`).join('')}
  `;
  root.querySelectorAll('.team-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = document.getElementById('player-name').value.trim();
      if (!name) return;
      myTeamId = btn.dataset.team;
      client.send('join_team', { teamId: myTeamId, name });
      render(currentState);
    });
  });
}

function renderBuzzer(state) {
  const root = document.getElementById('root');
  const team = state.teams.find((t) => t.id === myTeamId);
  root.innerHTML = `
    <div class="score">${team ? team.name : ''}: ${team ? team.score : 0}</div>
    <button id="buzz-btn" class="buzz-button">BUZZ</button>
    <div id="feedback"></div>
  `;
  document.getElementById('buzz-btn').addEventListener('click', () => {
    client.send('buzz', { teamId: myTeamId });
  });
}

function showFeedback(reason) {
  const el = document.getElementById('feedback');
  if (!el) return;
  el.textContent = reason === 'too_late' ? 'Too late!' : 'Already tried!';
  setTimeout(() => { if (el) el.textContent = ''; }, 1000);
}

document.addEventListener('ws-disconnected', () => {
  document.getElementById('disconnect-banner').style.display = 'block';
});
document.addEventListener('ws-connected', () => {
  document.getElementById('disconnect-banner').style.display = 'none';
});
```

- [ ] **Step 4: Manual verification in browser**

With the host panel from Task 9 already having loaded a game and saved two teams:
1. Open `http://localhost:3000/buzz` in a second browser tab/phone → see "Pick your team" with Red/Blue buttons.
2. Type a name, click "Red" → view switches to the big BUZZ button showing "Red: 0".
3. On the host panel, select a question. On the buzz page, click BUZZ → host panel shows Red as the buzz winner within ~1s (via the shared state broadcast).
4. Open a third tab, join Blue, click BUZZ after Red already won → "Already tried!" (or "Too late!") feedback briefly appears.
5. Stop the server, confirm the disconnect banner appears on the buzz page within ~2s; restart the server, confirm the banner disappears and the page still shows the correct team/score.

- [ ] **Step 5: Commit**

```bash
git add public/buzz
git commit -m "Add player join + buzzer UI with reconnect banner"
```

---

## Task 11: TV Board UI

**Files:**
- Modify: `public/board/index.html`
- Create: `public/board/board.js`
- Create: `public/board/board.css`

**Interfaces:**
- Consumes: `createWsClient` (Task 7), read-only (sends no messages) — renders `phase`, `board`, `game`, `currentQuestion`, `buzzWinner`, `teams` from `state_update`.

- [ ] **Step 1: Write `public/board/index.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <title>Jeopardy Board</title>
  <link rel="stylesheet" href="board.css" />
</head>
<body>
  <div id="root"></div>
  <script src="/shared/ws-client.js"></script>
  <script src="board.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `public/board/board.css`**

```css
body { font-family: sans-serif; margin: 0; background: black; color: white; height: 100vh; }
.grid { display: flex; justify-content: center; gap: 1rem; padding-top: 2rem; }
.column { display: flex; flex-direction: column; gap: 1rem; width: 15vw; }
.header { font-weight: bold; text-align: center; font-size: 1.5rem; }
.cell { background: darkblue; padding: 2rem; text-align: center; font-size: 2rem; }
.cell.answered { background: #111; color: #111; }
.question { text-align: center; padding-top: 5rem; font-size: 3rem; }
.answer { color: gold; margin-top: 2rem; }
.winner { font-size: 4rem; color: red; margin-top: 2rem; }
.timer { font-size: 2rem; margin-top: 2rem; }
.timer.late { color: red; }
.scores { position: fixed; bottom: 0; width: 100%; display: flex; justify-content: center; gap: 2rem; padding: 1rem; background: #222; font-size: 1.5rem; }
.intro { text-align: center; padding-top: 20vh; font-size: 4rem; }
```

- [ ] **Step 3: Write `public/board/board.js`**

```js
let timerInterval;

const client = createWsClient({
  role: 'board',
  onState: (state) => render(state)
});

function render(state) {
  const root = document.getElementById('root');
  if (!state.game) {
    root.innerHTML = '<h1 style="text-align:center;padding-top:20vh;">Waiting for host to load a game...</h1>';
    return;
  }

  let bodyHtml;
  if (state.phase === 'intro') {
    bodyHtml = renderIntro(state);
  } else if (state.phase === 'question' || state.phase === 'answer') {
    bodyHtml = renderQuestion(state);
  } else {
    bodyHtml = renderGrid(state);
  }

  root.innerHTML = bodyHtml + renderScores(state);

  if (state.phase === 'question' || state.phase === 'answer') {
    startTimerTick(state.currentQuestion.questionStartedAt);
  } else {
    clearInterval(timerInterval);
  }
}

function renderIntro(state) {
  const category = state.game.categories[state.introCategoryIdx];
  return `<div class="intro">${category.name}</div>`;
}

function renderGrid(state) {
  let html = '<div class="grid">';
  state.game.categories.forEach((category, cIdx) => {
    html += `<div class="column"><div class="header">${category.name}</div>`;
    category.questions.forEach((q, qIdx) => {
      const answered = state.board[cIdx][qIdx] === 'answered';
      html += `<div class="cell ${answered ? 'answered' : ''}">${answered ? '' : q.value}</div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderQuestion(state) {
  const { categoryIdx, questionIdx } = state.currentQuestion;
  const question = state.game.categories[categoryIdx].questions[questionIdx];
  const winnerTeam = state.teams.find((t) => t.id === state.buzzWinner);

  let html = '<div class="question">';
  html += `<div class="text">${question.question}</div>`;
  if (question.image) html += `<img src="/games/${state.gameId}/${question.image}" style="max-width:50vw;" />`;
  if (state.phase === 'answer' && question.answer) {
    html += `<div class="answer">${question.answer}</div>`;
  }
  if (winnerTeam) html += `<div class="winner">${winnerTeam.name}</div>`;
  html += `<div class="timer" id="timer">0s</div>`;
  html += '</div>';
  return html;
}

function startTimerTick(startedAt) {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById('timer');
    if (!el) { clearInterval(timerInterval); return; }
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    el.textContent = `${seconds}s`;
    el.classList.toggle('late', seconds > 15);
  }, 250);
}

function renderScores(state) {
  return `<div class="scores">${state.teams.map((t) => `<span>${t.name}: ${t.score}</span>`).join('')}</div>`;
}
```

- [ ] **Step 4: Manual verification in browser**

With host + buzz pages from Tasks 9-10 open:
1. Open `http://localhost:3000/board` in a third tab (or fullscreen it, simulating the TV).
2. On host, click "Start Category Intro" → board shows the first category name centered. Click "Next Category" → advances. Click "End Intro / Show Board" → grid view appears with all cells showing point values.
3. On host, select a question → board shows the question text, timer starts at 0s and increments; past 15s the timer turns red.
4. Buzz from `/buzz` as a team → board highlights that team's name.
5. On host, click "Reveal Answer" → board shows the answer text (gold) below the question.
6. On host, click "Close Question" → board returns to grid view, that cell now blanked/greyed out, and the scores footer reflects any point changes.

- [ ] **Step 5: Commit**

```bash
git add public/board
git commit -m "Add TV board UI with intro slideshow, grid, question/answer, and timer"
```

---

## Task 12: End-to-End Manual Verification Pass

**Files:** none (verification only, using everything built in Tasks 1-11)

- [ ] **Step 1: Full playthrough checklist**

Run `npm start`. Open `/editor`, `/host`, `/board`, and two `/buzz` tabs (representing two players on different teams). Work through the Section 9 checklist from the spec:

- [ ] Create a fresh game in `/editor` with real questions/answers/images for at least 2 categories × 3 questions; confirm it loads correctly on `/host`.
- [ ] Set up 2 teams on `/host`, assign real bulb IDs from `bulbs.json`, run "Test Bulb" for each and confirm the correct physical bulb flashes.
- [ ] Join both `/buzz` tabs to different teams.
- [ ] Run the category-intro slideshow via host "Next" and confirm `/board` advances in sync.
- [ ] Select a question: confirm it appears on `/board` and `/host` simultaneously, confirm the timer ticks on both and turns red past 15s, and confirm the answer is visible on `/host` but not visible in the `/buzz` or `/board` page's underlying state (check via browser dev tools network/WS frames if unsure).
- [ ] Buzz from both teams in quick succession: confirm only the first registers, that team's physical bulb turns red, `buzz.mp3` plays once, and the second team's tab shows "Too late!"/"Already tried!" while `miss.mp3` also plays.
- [ ] Click "Wrong" for the buzz winner: confirm points deducted, `reset.mp3` plays, that bulb returns to warm white, and the buzzer reopens (the same team cannot buzz again, but the remaining team can).
- [ ] Buzz with the remaining team and click "Correct": confirm points added, question closes, board cell greys out on `/board`.
- [ ] Pick a new question, have every team buzz and get marked "Wrong": confirm auto-close triggers once the last team is marked wrong.
- [ ] Pick another question and click "Close Question" manually mid-question (no buzzes yet): confirm it closes immediately.
- [ ] Click "Reset Buzzer" manually with no question selected: confirm all bulbs flash warm white and `reset.mp3` plays.
- [ ] Refresh `/board`, `/host`, and both `/buzz` tabs mid-game: confirm every page resyncs to the current state within ~1-2 seconds with no manual steps beyond the page load.
- [ ] Join a third `/buzz` tab to an existing team mid-round with a new player name: confirm they appear in that team's roster (if displayed) and can buzz immediately.

- [ ] **Step 2: Fix any issues found**

If any checklist item fails, identify which file/module is responsible (cross-reference Tasks 1-11's Interfaces sections), fix it, and re-run the specific failing checklist item (no need to redo the whole pass).

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "Fix issues found during end-to-end manual verification"
```

(Skip this commit if the pass found no issues requiring changes.)
