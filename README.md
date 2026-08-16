# Skak

A Lichess bullet & blitz game analyzer: syncs your games, tracks rating trend,
opening win rates, clock/time-usage patterns, and blunder/mistake rates —
using Lichess's own computer analysis where available and falling back to a
local Stockfish engine otherwise.

**Runs entirely in the browser** — static React app, no backend, deployable
straight to GitHub Pages. Your Lichess username is fetched with a direct
browser request to `lichess.org`, and everything (games, moves, analysis) is
stored locally in your browser's IndexedDB. Nothing is sent to any server
this project controls, because there isn't one.

## Live site

Deployed via GitHub Actions (`.github/workflows/deploy-pages.yml`) to
**https://steinim00.github.io/Skak/** whenever `client/` changes on `main`.
One-time setup in the repo: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

## How it works

- **Lichess data** — `client/src/lib/lichess.ts` calls the
  [games export API](https://lichess.org/api#tag/Games/operation/apiGamesUser)
  (`GET /api/games/user/{username}`) directly from the browser as streamed
  NDJSON, which already includes clocks, opening data, and — for games
  you've had analyzed on Lichess — per-move evals and blunder/mistake/
  inaccuracy judgments, for free.
- **Storage** — `client/src/lib/db.ts` wraps IndexedDB (games + per-move
  evals + sync state), replacing what would otherwise be a server database.
- **Stats** — `client/src/lib/stats.ts` computes rating trend, opening
  win rates, time usage, and blunder aggregates from what's in IndexedDB.
- **Analysis fallback** — for games Lichess hasn't analyzed, clicking
  "Analyze this game" runs a real Stockfish engine *in your browser* via
  WebAssembly (`client/src/lib/engine.ts` + `analysis.ts`, using the
  single-threaded build in `client/public/engine/` so it needs no special
  cross-origin-isolation headers — which GitHub Pages can't set anyway).

## Local development

