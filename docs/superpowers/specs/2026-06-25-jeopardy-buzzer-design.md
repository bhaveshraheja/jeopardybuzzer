# Jeopardy Buzzer App — Design Spec
**Status: COMPLETE — ready for implementation planning**
**Date: 2026-06-25 (completed 2026-07-03)**

---

## What We're Building

A self-hosted local-network app for running Jeopardy-style quiz nights with physical light feedback via Philips Wiz bulbs.

---

## Clarifying Questions — Settled

| Topic | Decision |
|---|---|
| Teams | Variable number of teams (default 2); each team has multiple members; any member can buzz |
| Questions | Pre-loaded via an in-app editor (like jeopardylabs.com); questions can have optional images |
| Game control | Host has a dedicated panel; TV board is read-only, driven by host actions |
| Host interface | Mobile/laptop web UI (not clicking on the TV) |
| Board structure | Main board only — no Daily Double, no Final Jeopardy; custom categories/questions; points in increments of 100 |
| Scoring | Points-based (not $), team scoring |
| Physical lights | Philips Wiz bulbs, one per team, controlled via UDP on local network |
| Light behavior | Default = warm white; buzz = winning team's bulb turns red; host reset = all bulbs back to default |
| Sound | Server-side `afplay`, audio reaches the TV via AirPlay from the Mac |
| Deployment | All local for now (one Mac, everyone on same Wi-Fi); Electron packaging for portability is a future option |

---

## Chosen Approach: Option A — Single Node.js Server

One Express + WebSocket server, four browser UIs served as static HTML/CSS/JS (no build step).
Future path: Option C (Electron) for taking to other people's homes without needing to "start a server."

---

## Section 1: Architecture (Approved)

One Node.js process (Express + `ws`) serves everything over your local network.

```
Your Mac (Node.js server, port 3000)
├── /board    → TV display (projected via browser, fullscreen)
├── /host     → Host panel (your phone/laptop)
├── /buzz     → Player buzzer (participants' phones)
├── /editor   → Game editor (create/edit games)
└── /ws       → WebSocket endpoint (all real-time events)

Local network side effects:
├── UDP → Wiz bulb IPs (one per team)
└── afplay buzz.mp3 (Mac system audio on buzz)
```

Players and host join by navigating to `http://<your-mac-ip>:3000/<path>`. No app install needed.

---

## Section 2: Data Model

**Persistence policy:** live game session state (scores, buzz order, board progress) lives in server memory only — not persisted to disk. A server crash/restart mid-round means restarting that round. Game *content* (categories/questions), by contrast, is persisted as JSON files via the editor.

**Game file** — `games/<slug>/game.json`, one file per game, uniform grid (N categories × M questions, both fixed per game at creation time; values auto-fill in 100s increments: 100, 200, ... up to `M*100`):
```json
{
  "id": "movie-night-2026",
  "name": "Movie Night Jeopardy",
  "createdAt": "2026-07-03T00:00:00Z",
  "categories": [
    {
      "name": "90s Films",
      "questions": [
        { "value": 100, "question": "...", "answer": "...", "image": "images/90s-100.jpg" }
      ]
    }
  ]
}
```
Images live in a sibling `images/` folder next to the game's JSON, referenced by relative path. The editor UI handles image upload directly (drag-and-drop or file picker) — the server saves the file into that game's `images/` folder and writes the relative path into the JSON. No manual file placement required.

**Runtime session state** — held in server memory only:
```
SessionState {
  gameId: string
  teams: Team[]
  board: ("unanswered" | "answered")[][]     // [categoryIdx][questionIdx]
  phase: "intro" | "board" | "question" | "answer"
  introCategoryIdx: number                    // during intro slideshow
  currentQuestion: { categoryIdx, questionIdx, questionStartedAt } | null
  buzzWinner: string | null                   // teamId currently answering
  answeredBy: string[]                        // teamIds that already tried+failed this question
}

Team {
  id: string
  name: string          // set by host on the team-setup screen, before players join
  members: string[]     // names added as players self-serve join via /buzz
  score: number
  bulbId: string        // references an entry in bulbs.json
}
```

**Team/session setup flow:** host creates team names (and assigns each a `bulbId` from the configured bulb list) on the host panel before the round starts → players open `/buzz` (e.g. via QR code), see the list of team names, tap one, type their own name to join. Team roster stays open throughout — new players can join an existing team at any point, even mid-round, by the same flow. Any member of a team can buzz on its behalf.

---

## Section 3: UI Screens

**`/editor`** — Jeopardylabs-style grid editor. Host sets N categories × M questions per game (fixed per game, uniform grid, values auto-fill in 100s). Click a cell to expand and edit that question's text/answer/image inline; image upload saves into that game's `images/` folder.

**`/host`** — control panel:
- Team-setup screen: create team names, assign each a bulb ID from `bulbs.json`, with a "Test Bulb" button per team (flashes the bulb a distinct color, e.g. blue, to confirm it's reachable before the game starts)
- Category-intro slideshow control: "Next" button advances through categories one at a time on the TV board before the round starts
- Game/category grid to pick a question
- On pick: host sees question + answer immediately; question also reveals on the TV board and starts the elapsed timer
- Elapsed-time display, turns red past 15s (tweakable default) — purely visual pacing aid, never auto-triggers any action (answer reveal is always a manual host decision, regardless of elapsed time)
- Shows which team buzzed first (`buzzWinner`)
- Right/Wrong buttons: **right** → adds the question's point value, closes the question, resets the buzzer; **wrong** → deducts the question's point value, reopens the buzzer for remaining teams (teams already in `answeredBy` can't buzz again on that question)
- Auto-closes the question once all teams have wrong-buzzed (`answeredBy` covers all teams); a manual **"Close Question"** button is always available regardless of state, to move on whenever the host wants
- Revealing the answer always closes the question (answer-shown and closed are the same state transition)

**`/buzz`** — player join + buzzer:
- Open link/QR → pick a team from the host-created list → enter own name to join (`join_team`)
- One big buzz button, optionally shows own team's current score
- Optimistic tap: always tappable; server arbitrates first-buzz-wins and returns `buzz_rejected` (`too_late` / `already_tried`) if you didn't win it
- Watches its own WebSocket connection state directly; shows a small "Disconnected — reconnecting..." banner locally whenever the socket isn't open, clearing once reconnected (host panel does not need per-player connection visibility)

**`/board`** — TV display, states:
1. Category-intro slideshow (host-paced via "Next")
2. Board grid (categories × values), answered questions shown blanked/greyed out
3. Question revealed (text + image), elapsed timer visible (also color-coded past 15s), ticking in sync with the host view
4. On buzz: highlighting the buzzing team's name (alongside their bulb turning red)
5. Answer revealed → question closes → returns to board grid
6. Team scores always visible in a footer bar

---

## Section 4: WebSocket Protocol

Simple **full-state broadcast** model rather than fine-grained events: the server keeps one `SessionState` object in memory, and every change triggers a broadcast of the *entire* current state to all connected clients (board, host, all buzzers). Each page re-renders from whatever state it receives. This means a page refresh/reconnect "just works" — the server sends the current state to a newly-connected client immediately, no special reconnect logic needed server-side.

**Client → Server messages:**
| Message | Payload | Who sends |
|---|---|---|
| `join_team` | `{ teamId, name }` | player (`/buzz`) |
| `buzz` | `{ teamId }` | player (`/buzz`) |
| `setup_teams` | `{ teams: [{ name, bulbId }] }` | host |
| `test_bulb` | `{ bulbId }` | host |
| `load_game` | `{ gameId }` | host |
| `start_intro` / `next_category` / `end_intro` | — | host |
| `select_question` | `{ categoryIdx, questionIdx }` | host |
| `reveal_answer` | — | host |
| `mark_correct` / `mark_wrong` | `{ teamId }` | host |
| `close_question` | — | host |
| `reset_buzzer` | — | host (manual override) |

**Server → All clients:** `state_update` with the full `SessionState` (see Section 2 for shape). Clients compute elapsed time locally from `currentQuestion.questionStartedAt` — no server tick spam needed.

**Server → single client:** `buzz_rejected` with `{ reason: "too_late" | "already_tried" }`, sent only to the losing buzz attempt.

**Reconnect behavior:** each page opens a WebSocket on load with client-side auto-reconnect (retry every 1-2s on drop, small "reconnecting..." indicator). On (re)connect, the server immediately sends a `state_update` — no distinction between a fresh load and a reconnect.

---

## Section 5: Wiz UDP Integration

**Bulb configuration** — `bulbs.json`, a flat list of available bulbs, edited by hand:
```json
[
  { "id": "A", "ip": "192.168.1.101" },
  { "id": "B", "ip": "192.168.1.102" }
]
```
Teams are assigned a `bulbId` from this list on the host panel's team-setup screen (Section 3), not hardcoded to team order.

**Commands** — JSON over UDP, port 38899:
- **Warm white (default/reset):** `{"method":"setPilot","params":{"state":true,"temp":2700,"dimming":100}}`
- **Red (buzz winner):** `{"method":"setPilot","params":{"state":true,"r":255,"g":0,"b":0,"dimming":100}}`
- **Test flash (host "Test Bulb" button):** same shape, distinct color (e.g. blue) to visually confirm reachability before the game starts

Server sends warm-white to all configured bulbs on startup and on host reset; sends red to just the winning team's bulb on buzz.

**Bulb health (best-effort, revised during implementation):** Commands are pure fire-and-forget UDP — no ack-tracking or reachability heuristic. An earlier version of this design tracked replies to `setPilot` and flagged a bulb "unreachable" after enough misses, but that heuristic had real bugs (a memory leak for a genuinely offline bulb, and incorrect reply-matching under concurrent commands) and was dropped rather than fixed. There is no bulb-health status anywhere in the app. The manual "Test Bulb" button remains the host's only way to check a bulb works, by watching for the flash. A genuinely unreachable bulb just doesn't light up — no error or indicator shown anywhere.

---

## Section 6: Sound Integration

Three bundled sound files, all triggered server-side via `child_process` → `afplay`, playing through the Mac's audio output (routed via AirPlay to the TV, so everyone hears them together — no client-side audio at all):
- `sounds/buzz.mp3` — plays when a buzz is accepted as the winner
- `sounds/miss.mp3` — plays on every rejected buzz (too late / already tried) — lets everyone know someone's still trying to buzz in
- `sounds/reset.mp3` — plays when the buzzer resets (manual or auto)

Fixed assets, no upload/customization UI.

---

## Section 7: File/Folder Structure

```
jeopardybuzzer/
├── server/
│   ├── index.js              # Express + ws bootstrap
│   ├── state.js              # in-memory SessionState + transitions
│   ├── wsHandlers.js          # client -> server message handling
│   ├── wiz.js                 # UDP bulb commands (fire-and-forget)
│   ├── sound.js               # afplay wrapper
│   └── gameStore.js           # read/write game JSON + image uploads
├── public/
│   ├── board/
│   │   ├── index.html
│   │   └── board.js
│   ├── host/
│   │   ├── index.html
│   │   └── host.js
│   ├── buzz/
│   │   ├── index.html
│   │   └── buzz.js
│   ├── editor/
│   │   ├── index.html
│   │   └── editor.js
│   └── shared/
│       └── ws-client.js       # shared WS connect/reconnect helper
├── games/
│   └── <slug>/
│       ├── game.json
│       └── images/
├── sounds/
│   ├── buzz.mp3
│   ├── miss.mp3
│   └── reset.mp3
├── bulbs.json                 # [{ id, ip }]
└── package.json
```

---

## Section 8: Error Handling

- **Late/duplicate buzzes** — handled via `buzz_rejected` (`too_late` / `already_tried`); see Section 4.
- **Bulb offline/unreachable** — best-effort, fire-and-forget; see Section 5. No warning is shown anywhere — the host's only tool is the manual "Test Bulb" button.
- **Disconnected players** — client-side auto-reconnect (Section 4); the `/buzz` page shows its own "Disconnected — reconnecting..." banner based on its own socket state. The host panel does not track or display per-player connection status.

---

## Section 9: Testing Approach

Manual verification only — no automated tests. This is a home project with real hardware dependencies (Wiz bulbs, Mac audio) that can't be meaningfully automated without significant extra investment, so a manual checklist covers it:

- Start a session, set up 2+ teams, assign bulbs, run "Test Bulb" for each
- Join `/buzz` as multiple players across different teams
- Load a game in `/editor`, verify grid creation, question/answer entry, and image upload
- Run the category-intro slideshow via host "Next"
- Select a question, verify it appears on `/board` and `/host` simultaneously, verify timer ticks and turns red past 15s
- Buzz from two teams in quick succession — verify only the first registers, the correct bulb turns red, `buzz.mp3` plays, and the second team gets a "too late" response and hears `miss.mp3`
- Mark an answer wrong — verify points deducted, buzzer reopens, remaining team can buzz
- Mark an answer right — verify points added, question closes, board updates
- Let all teams buzz wrong — verify auto-close
- Use manual "Close Question" mid-question — verify it works regardless of state
- Reset the buzzer manually — verify all bulbs return to warm white and `reset.mp3` plays
- Refresh each page (`/board`, `/host`, `/buzz`) mid-game — verify state resyncs correctly
- Join a new player to a team mid-round — verify they can buzz immediately

---

## Next Step

Spec complete. Proceed to implementation planning via the writing-plans skill.
