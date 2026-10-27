# Architecture

```
 Twitch EventSub (WebSocket)            Mock simulator (npm run mock / demo)
        │  chat · follow · sub · gift · cheer · raid · hype · redemptions
        ▼                                         │
  src/twitch/eventsub.js ──normalize.js──►  { type, user, … }  ◄───┘
                                │
                         src/cues.js  (event → side effects)
                                │
                        src/director.js
        votes · timed rounds · weighted ballots · heat · reel log
                                │ cues (JSON over WebSocket /ws)
                                ▼
                    public/overlay.html  (OBS Browser Source)
        canvas scene · tween engine · easing library · kinetic type
```

## Why EventSub-over-WebSocket
No public URL, tunnel or webhook secret is needed — the streamer runs the server locally,
runs `npm run auth` once (OAuth Device Code flow for a public client), and OBS loads
`http://localhost:8787/`. The client handles `session_welcome` → subscribe, keepalive watchdog,
`session_reconnect`, de-duplication and automatic reconnect.

## The Director
* **Parameters** (`shared/params.js`): `ease`, `palette`, `shape`, `tempo`.
* **Rounds**: chat votes accumulate for `ROUND_SECONDS`; the winner of each category is applied with a staggered transition.
* **Ballots**: one per user per category (re-voting replaces); subs/mods count ×2; ties go to the earliest first vote.
* **Heat**: chat activity + events raise `heat` (half-life 8 s) → rotation speed, glow, jitter.
* **Channel points**: a reward whose title contains `ease|palette|shape|tempo|chaos` directly changes that parameter (viewer's text input picks the value, otherwise random).
* **Reel**: every applied change is timestamped; `GET /api/reel` (and a file on Ctrl-C) exports the stream's "choreography".

## Overlay motion language
* `shared/easing.js` — five named easings (smooth, bounce, elastic, snap, back); the **same** curve is used for the idle "breathing" of all 36 shapes, for banner slides, kinetic typography and layout changes, so the chosen ease is visible everywhere.
* `public/js/tween.js` — tiny tween manager (delay, per-property, newest-wins).
* Staggered transitions: palette cross-fades and shape morphs ripple through the rings with per-element delay — the classic motion-design stagger.
