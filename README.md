# Project Fall Fest 25/26 — Flappy Bird Remix

A polished, classroom-friendly Flappy Bird built with Next.js and React. It features animated portals every 10 pipes, city-themed parallax backgrounds, level-based background music, smooth portal audio (including iOS-friendly fades), a finish line at pipe 90, and a simple leaderboard submission flow.

## Features

- Flappy gameplay tuned for mobile and desktop
- 8 city backgrounds with multi-layer parallax; color-matched pipes per level
- Animated portals every 10th pipe with swirling rings and sparkles
- Portal audio: idle sound fades in/out with distance; warp sound on pass-through
- Level-based background music: no music at 0–9, new track each portal (10–19, 20–29, …)
- Finish line at pipe 90: pipes freeze, bird flies off-screen, victory sounds + modal
- Responsive canvas sizing and crisp pixel-art rendering
- iOS-ready audio: WebAudio for effects, proper context unlocking, smooth fades
- Simple leaderboard API with local file storage and optional Vercel KV

## How to play

- Tap/Click or press Space/Arrow Up to flap
- Avoid pipes; pass through portals every 10th pipe for a visual/music change
- Reach the checkered finish line at pipe 90 to win

## Run locally

This project’s app lives in `flappybird/` (Next.js 16, React 19, Tailwind CSS 4).

```bash
cd flappybird
npm install
npm run dev
```

Then open http://localhost:3000.

Notes:

- Requires a modern Node.js (v18+ recommended).
- No environment variables are required for local development. Scores persist to `flappybird/data/scores.json`.

## Dev options

- Start at a specific score (e.g. to test a background or portal):
  - Add `?startScore=85` to the URL (example: `http://localhost:3000/?startScore=85`).

## Leaderboard API

The in-app modal posts to `POST /api/scores`.

- POST `/api/scores`

  - Existing player update: `{ id: string, score: number }`
  - New player create: `{ id: string, score: number, firstName: string, lastInitial: string }`
  - Responses:
    - `201` created, `200` updated, or `409 { requiresProfile: true }` when missing profile on first submit

- GET `/api/scores`

  - Returns sorted scores (highest first). Optional `?limit=N`.

- GET `/api/scores?id=YOUR_ID`
  - Returns `{ exists: boolean, entry: ScoreEntry | null }`.

Storage backends:

- Local dev: JSON file at `flappybird/data/scores.json` (auto-created)
- Vercel: If `@vercel/kv` is configured (`KV_REST_API_URL` or `UPSTASH_REDIS_REST_URL`), the API uses KV with a sorted set

## iOS audio notes

- Audio playback on iOS requires a user gesture. The game unlocks the AudioContext on first tap.
- Portal idle sound uses WebAudio (looping buffer + GainNode) for reliable distance-based fading on iOS.
- One-shot effects (wing/point/warp) are handled to minimize latency and stutter on mobile.

## Tech stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Optional: Vercel KV for leaderboard persistence

## Project structure (partial)

```
flappybird/
	app/
		api/
			scores/route.ts      # Leaderboard API (KV on Vercel, JSON locally)
		page.tsx               # Game page
		layout.tsx             # App shell
	components/
		FlappyBird.tsx         # The game (canvas rendering + audio + logic)
		Leaderboard.tsx        # Leaderboard UI
		Modal.tsx              # Simple modal component
	data/
		scores.json            # Local dev storage
	public/
		flappy-bird-assets-master/  # Sprites and sfx (see credits)
		free-city-backgrounds-pixel-art/ # Multi-layer city backgrounds
		music/                 # Level-based tracks (short loops)
		portalSounds/          # Idle + warp effects
```

## Assets and credits

- Sprites and classic SFX: https://github.com/samuelcust/flappy-bird-assets
- City backgrounds: https://free-game-assets.itch.io/free-city-backgrounds-pixel-art
- Portal idle SFX: https://pixabay.com/sound-effects/portal-idle-34022/
- Portal warp SFX: https://pixabay.com/sound-effects/sci-fi-portal-jump-04-416161/
- Music tracks:
  - Western Journey (30s): https://pixabay.com/music/beats-western-journey-30-seconds-183089/
  - Pizzicato Play (30s): https://pixabay.com/music/cartoons-pizzicato-play-30-seconds-children-music-394553/
  - Cyborg in Me (27s): https://pixabay.com/music/upbeat-instrumental-music-for-video-blog-stories-cyborg-in-me-27-seconds-188532/
  - Emotional Orchestra (Short): https://pixabay.com/music/folk-emotional-orchestra-short-145091/
  - Falling Grace: https://pixabay.com/music/modern-classical-falling-grace-348198/
  - Epic Love (30s): https://pixabay.com/music/modern-classical-epic-love-inspirational-romantic-cinematic-30-seconds-406069/
  - Epic Middle Eastern Percussion (30s): https://pixabay.com/music/suspense-epic-middle-eastern-30-seconds-percussion-389431/

Please review and comply with each asset’s license on its source page.

## License

This repository is provided for educational/non-commercial event use. Third‑party assets are owned by their respective creators and used under their stated licenses. See the links above for details.
