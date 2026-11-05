# X Client

A simple, responsive web client for X (formerly Twitter).

## Features

- Lists accounts you follow (or a configured list), sorted by most recent post activity.
- Accounts with new posts are highlighted and surface near the top.
- Click an account to see its posts (aggregated by account).
- "All Feed" view of recent posts across accounts.
- Near real-time via background refresh + client polling.
- Responsive UI: side-by-side on desktop, stacked/mobile-friendly on phone.
- Built with TypeScript + Node.js (Express backend, vanilla TS frontend compiled to JS).
- Persists last-seen state to disk.
- Live X API v2 support when credentials are provided (falls back to mock).

## One-line start

```bash
npm run go
```

This builds the backend + frontend and starts the server. Open http://localhost:3000

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your X API credentials (optional – works with mock data without them).
3. `npm run go`

### Environment variables

- `TWITTER_BEARER_TOKEN` – App-only bearer token (from developer.x.com)
- `TWITTER_USER_TOKEN` + `MY_USER_ID` – Optional user-context token to pull your real following list
- `FOLLOWING_USERNAMES` – Comma-separated usernames to track when no user token (default: elonmusk,naval,karpathy,paulg)
- `PORT` – Server port (default 3000)

Rate limits are handled with light delays and caching (refresh every 60s).

## Project Structure

- `src/server.ts` – Backend API + refresh logic
- `src/x-api.ts` – X API client + last-seen persistence
- `src/frontend/app.ts` – Frontend logic
- `public/` – Static assets (index.html, styles.css, compiled JS)
- `.data/lastseen.json` – Persisted seen state (gitignored)

## Notes

- For personal following you need a user-context token with `tweet.read users.read follows.read`.
- Streaming / webhooks require elevated access; current design uses efficient polling + cache.
- Single-user for now (last-seen is global). Easy to extend with sessions later.
