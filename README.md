# X Client

A simple, responsive web client for X (formerly Twitter).

## Features (v0.1 - First Run)

- Lists accounts you follow (mock data for now), sorted by most recent post activity.
- Accounts with new posts are highlighted and surface near the top.
- Click an account to see its posts (aggregated by account).
- "All Feed" view of recent posts across accounts.
- Real-time feel via polling every 15 seconds.
- Responsive UI: side-by-side on desktop, stacked/mobile-friendly on phone.
- Built with TypeScript + Node.js (Express backend, vanilla TS frontend compiled to JS).

## Running Locally

1. Clone or copy this folder.
2. `npm install`
3. `npm run build` (compiles backend) and `npm run build:frontend` (compiles frontend TS)
4. `npm start` or for dev: `npm run dev`
5. Open http://localhost:3000

## Next Steps for Real X Integration

- Add your X API credentials (Bearer Token or OAuth 1.0a/2.0 user context).
- Replace mock data with calls to X API v2:
  - Get following list
  - Fetch recent tweets for each or use timeline endpoints
  - Handle rate limits, pagination, streaming if available
- Persist last-seen state (per user/session).
- Auth for multi-user or personal use.
- Better real-time (webhooks/streaming or shorter poll + websockets).

This is a prototype for feedback. Provide notes on UI, features, sorting, etc. and we'll iterate.

## Project Structure

- `src/server.ts` - Backend API
- `src/frontend/app.ts` - Frontend logic
- `public/` - Static assets (index.html, styles.css, compiled JS)
- `tsconfig.json` / `tsconfig.frontend.json`

Mock data includes sample posts from well-known accounts for demo.