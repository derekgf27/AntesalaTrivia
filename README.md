# Antesala Trivia

Live trivia nights for your bar: lobby codes, team/solo play, host+timer pacing, auto-scoring, and a dual-screen host setup.

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

Locally, live games are stored in memory (and night history in `data/nights.json`). Restarting the dev server clears active lobbies unless Redis is configured.

## Deploy on Vercel

This app uses Next.js API routes and short polling, so it can run on Vercel. Vercel does not share memory across requests, so production needs **Upstash Redis**:

1. Create a free Redis database at [Upstash](https://upstash.com) (or Vercel Storage → Upstash Redis).
2. In the Vercel project, set:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `ADMIN_PIN` (optional; default `9271`)
3. Redeploy.

Without those Redis env vars, Host/Play will show that the game server is not ready.

## How to run a night

1. **Laptop** → Home → **Host** → enter PIN → create or resume a night.
2. **TV (second screen)** → on admin, click **Open TV display** → drag that window to the TV → fullscreen (F11).
3. **Guests** → Home → **Play** (or scan the QR) → create a team, join a team, or play solo.
4. When at least one team has joined, hit **Start question 1**. The timer locks answers automatically; you press **Next question** between rounds.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm start` — production Next.js server (after build)

## Notes

- Keep admin on the laptop and the display window on the TV — don't mirror the control panel unless you have to.
