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

Copy `bulbs.json.example` to `bulbs.json` and fill in your bulbs' real IP
addresses:

```bash
cp bulbs.json.example bulbs.json
# then edit bulbs.json with your real bulb IPs
```

```json
[
  { "id": "A", "ip": "192.168.x.x" },
  { "id": "B", "ip": "192.168.x.x" }
]
```

Tip: set a DHCP reservation for each bulb in your router so the IP doesn't
change later. The server reads this file once at startup — restart it after
editing `bulbs.json`.

Copy `wifi.json.example` to `wifi.json` and fill in your real network name
and password — this powers the join-QR-codes screen (see
[QR codes for joining](#qr-codes-for-joining)).

```bash
cp wifi.json.example wifi.json
# then edit wifi.json with your real ssid/password
```

Both `bulbs.json` and `wifi.json` are git-ignored since they contain
network-specific/private details — don't remove them from `.gitignore`.

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
5. On `/host`, click **Show QR Codes** — the board switches to a two-step
   join screen (scan to join WiFi, then scan to join `/buzz`) that players can
   scan straight off the TV. Click it again to hide and return to the game.
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

Sound is played by the **server Mac**, using macOS `afplay` and the Mac's
currently selected audio output. The `/buzz` phones, `/host` browser, and
`/board` browser do not play these sounds themselves. Before the game, connect
speakers or a TV to the Mac, select that device under macOS **Sound > Output**,
and turn up its volume. Casting the board to a TV does not by itself guarantee
that the Mac's audio is routed to the TV. If you run the server on a non-macOS
machine, `afplay` is unavailable and these sounds will not play without
changing `server/sound.js` to use a player installed on that machine.

`sounds/buzz.mp3` plays for an accepted buzz while a question is open;
`sounds/miss.mp3` plays for a rejected buzz. `sounds/reset.mp3` plays when a
held buzzer is cleared (by **Reset Buzzer**, a wrong answer, revealing the
answer, or closing the question). Resetting when nobody has buzzed stays
silent. Replace any clip with your own MP3 using the same filename. To check
the Mac's output independently of the app, run `afplay sounds/buzz.mp3` on
the server Mac.

Optional `sounds/wait.mp3` starts at a lower volume when a question opens and
loops until a team buzzes. It stops for the buzzer sound and resumes after the
reset sound if the question is still open and another team can try. It also
stops on answer reveal, question close, or game change. Without this file, the
game works as before, without waiting music.

For private home use, a 33-second recording of the Jeopardy! thinking music
is available at [Orange Free Sounds](https://orangefreesounds.com/jeopardy-theme-song/)
([MP3 download](https://www.orangefreesounds.com/wp-content/uploads/2014/10/Jeopardy-theme-song.mp3)).
Save it locally as `sounds/wait.mp3`; the file is git-ignored and must not be
committed or redistributed. The source labels the recording **private use
only** and does not claim to own the underlying composition. For use beyond a
private game, obtain the necessary rights or supply music you can use. Other
Jeopardy!-labeled sound samples can be found at
[Quick Sounds](https://quicksounds.com/library/sounds/jeopardy), but their
rights were not verified, so this project keeps its existing buzzer clips.

## QR codes for joining

Once `wifi.json` is set up, clicking **Show QR Codes** on `/host` puts up a
two-step join screen on `/board`:

1. **Join WiFi** — a standard WiFi QR code (scannable by any phone camera,
   no app needed) plus the network name/password as plain text for manual
   entry.
2. **Join the Game** — a QR code pointing at `/buzz` on your Mac's LAN IP
   (auto-detected), plus the URL as text.

Toggle it off from the same button to go back to the game.

## Credits

Game-night format inspired by [JeopardyLabs](https://jeopardylabs.com/) —
this project builds on that idea with a real-time, physical buzzer/bulb
experience layered on top.

## Notes

- No accounts, no database — game content lives as JSON files under `games/`,
  live session state (scores, buzz order) is in-memory only and resets if the
  server restarts mid-round.
- This is built for a trusted home network for one quiz night, not public
  deployment — there's no authentication, and the game editor's REST API has
  no input validation. Don't expose this server to the open internet.
