# Antesala Trivia

Live trivia nights for your bar: lobby codes, team/solo play, hybrid host+timer pacing, auto-scoring, and a dual-screen host setup.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Home has two big buttons:
- **Play** → player join flow
- **Host** → asks for PIN (default `9271`, override with `ADMIN_PIN` env), then opens admin

The PIN is checked on the **server** and exchanges for a short-lived host token. Players who open `/admin` without that token cannot create nights or run host controls.

## How to run a night

1. **Laptop** → Home → **Host** → enter PIN → create or resume a night.
2. **TV (second screen)** → on admin, click **Open TV display** → drag that window to the TV → fullscreen (F11).
3. **Guests** → Home → **Play** (or scan the QR) → create a team, join a team, or play solo.
4. When the room is ready, hit **Start question 1**. The timer locks answers automatically; you press **Next question** between rounds.

## Scripts

- `npm run dev` — local server with Socket.io realtime
- `npm run build` — build the Next.js app
- `npm start` — production server (after build)

## Notes

- Games live in memory on the server (fine for a single venue night; restart clears lobbies).
- Keep admin on the laptop and the display window on the TV — don't mirror the control panel unless you have to.
