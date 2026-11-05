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
- OAuth 2.0 login to pull your real following list (with token refresh).
- Persists last-seen state and OAuth tokens to disk.

## OAuth Login (recommended)

1. In the [X Developer Console](https://console.x.com), open your app.
2. Enable **OAuth 2.0** (User authentication settings).
3. Set App type to **Web App** or **Automated App**.
4. Add callback URL: `http://localhost:3000/auth/callback` (or your production URL).
5. Required scopes: `tweet.read`, `users.read`, `follows.read`, `offline.access`.
6. Copy **Client ID** and **Client Secret** into `.env`.
7. Restart the server, then click **Login with X** in the UI.

Once logged in, the app pulls your real following list and keeps the token refreshed.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your X API credentials (optional – works with mock data without them).
3. `npm run go`

### Environment variables

- `TWITTER_CLIENT_ID` + `TWITTER_CLIENT_SECRET` – for OAuth 2.0 login (recommended)
- `TWITTER_REDIRECT_URI` – must match the callback registered in the console (default: http://localhost:3000/auth/callback)
- `TWITTER_BEARER_TOKEN` – optional app-only fallback
- `FOLLOWING_USERNAMES` – used when not logged in
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
