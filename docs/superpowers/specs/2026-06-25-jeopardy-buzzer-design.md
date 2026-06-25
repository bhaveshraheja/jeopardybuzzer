# Jeopardy Buzzer App — Design Spec
**Status: PARTIAL — brainstorming in progress, not yet ready for implementation**
**Date: 2026-06-25**

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
| Sound | Short beep plays from server (Mac `afplay`) when a buzz is accepted |
| Deployment | All local for now (one Mac, everyone on same Wi-Fi); Electron packaging for portability is a future option |

---

## Chosen Approach: Option A — Single Node.js Server

One Express + WebSocket server, four browser UIs served as static HTML/CSS/JS (no build step).
Future path: Option C (Electron) for taking to other people's homes without needing to "start a server."

---

## Architecture (Section 1 — Approved)

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

## Sections Not Yet Designed

The following sections still need to be walked through and approved:

- [ ] **Data model** — Game, Category, Question, Team, GameSession structures; JSON file storage
- [ ] **Four UI screens** — TV board, host panel, player buzzer, game editor (layout + behavior)
- [ ] **WebSocket event protocol** — full event list, payload shapes, state machine
- [ ] **Wiz UDP integration** — command format, bulb configuration, error handling
- [ ] **Sound integration** — trigger point, file management
- [ ] **File/folder structure** — full project layout
- [ ] **Error handling** — late buzzes, disconnected players, bulb offline
- [ ] **Testing approach**

---

## Next Step

Resume brainstorming from **Section 2: Data Model**.
