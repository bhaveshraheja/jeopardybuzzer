# Jeopardy Buzzer

A self-hosted, local-network Jeopardy-style quiz night app with physical light
feedback via Philips Wiz smart bulbs. One Node.js server, four browser pages,
no accounts, no internet dependency (besides fonts/CDNs your browser may
already have cached) — everyone just opens a URL on their phone.

## Requirements

- A Mac (or any machine) to run the server, on the same Wi-Fi as your players
- [Node.js](https://nodejs.org/) installed (v18+ recommended)
- Philips Wiz smart bulbs, one per team, on the **same network** the server
  can reach (see [Bulb setup](#bulb-setup) if they're on a separate/IoT
  network)

## Setup

```bash
npm install
```

Edit `bulbs.json` with your bulbs' real IP addresses:

```json
[
  { "id": "A", "ip": "192.168.x.x" },
  { "id": "B", "ip": "192.168.x.x" }
]
```

Tip: set a DHCP reservation for each bulb in your router so the IP doesn't
change later. The server reads this file once at startup — restart it after
editing `bulbs.json`.

## Running

```bash
npm start
```

You'll see:

```
Jeopardy buzzer server running at http://localhost:3000
```

Find your Mac's local IP (players need this, not `localhost`):

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Then share `http://<that-ip>:3000/<page>` with everyone on the same Wi-Fi.

## The four pages

| Page | Who | Purpose |
|---|---|---|
| `/editor` | You, ahead of time | Create/edit games — categories, questions, answers, images |
| `/host` | You, during the game | Pick a game, set up teams, run the board, resolve buzzes |
| `/board` | The TV/projector | Read-only display — categories, board, questions, timer, scores |
| `/buzz` | Each player, on their phone | Join a team, buzz in |

## Running a quiz night

1. Start the server (`npm start`) with your Mac connected to the party Wi-Fi.
2. Open `/editor` ahead of time to create your game (or use the included
   sample game, "Jiya Jale Jeopardy").
3. On your host device (phone/laptop), open `/host`. Pick the game, add team
   names, assign each a bulb, hit **Test Bulb** to confirm it lights up, then
   **Start Game**.
4. Project/cast `/board` onto the TV.
5. Share the `/buzz` URL (a QR code pointing at it works well) so players can
   join a team and buzz in from their own phones.
6. Run the category intro (**Start** → **Next** → auto-advances to the board
   after the last one), then click cells to reveal questions. Use the
   **Answer & Buzz** panel in the host sidebar to mark Correct/Wrong without
   scrolling.
7. If a bulb, a player's connection, or the board itself ever seems stuck,
   refreshing that page is safe — everything resyncs from the server
   automatically within a second or two.

## Bulb setup

Bulbs communicate over UDP; if they're on a separate IoT/guest network from
your Mac (common with mesh routers like TP-Link Deco), the server won't be
able to reach them. Either:
- Check your router for a setting that allows the main network to reach the
  IoT network, or
- Re-provision the bulbs onto your main Wi-Fi network instead.

If a bulb is unreachable, the app doesn't show any error — it just won't
light up. Sound and gameplay work fine regardless.

## Sounds

`sounds/buzz.mp3`, `sounds/miss.mp3`, and `sounds/reset.mp3` are currently
placeholder (silent) files. Replace them with real short sound clips of the
same names to get audio feedback on buzz, missed buzz, and buzzer reset.
Audio plays from the Mac's speakers — if the Mac is connected to the TV via
AirPlay, sound comes through the TV too.

## Notes

- No accounts, no database — game content lives as JSON files under `games/`,
  live session state (scores, buzz order) is in-memory only and resets if the
  server restarts mid-round.
- This is built for a trusted home network for one quiz night, not public
  deployment — there's no authentication, and the game editor's REST API has
  no input validation. Don't expose this server to the open internet.
