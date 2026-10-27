# Codex task list

Work to hand to Codex in the single session thread that is submitted to Devpost
(`/status` in Codex shows the session ID). Keep everything in ONE thread.

1. Read `README.md` + `docs/ARCHITECTURE.md`, run `npm test` and `npm run demo`.
2. Live-verify the EventSub path against a real channel (`npm run auth`, `npm start`) and fix any
   subscription/scope problems that appear in the logs.
3. Add `!vote` anti-spam (per-user rate limit) and a `!reel` chat command that links the exported reel.
4. Reel replay page (`/reel.html`) — plays an exported reel back as an animation timeline.
5. Overlay polish: emote rendering in chat lines, per-shape layouts, intro/outro animation, reduced-motion toggle.
6. Add a Twitch Extension-style `viewer.html` panel (no review required to demo) that lets viewers vote with buttons through the same Director.
7. Record the Codex-in-action footage for the demo video (this thread).
