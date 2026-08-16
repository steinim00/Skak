# Skak

A Lichess bullet & blitz game analyzer: syncs your games, tracks rating trend,
opening win rates, clock/time-usage patterns, and blunder/mistake rates —
using Lichess's own computer analysis where available and falling back to a
local Stockfish engine otherwise.

## Architecture

- **`server/`** — FastAPI + SQLite backend.
  - Fetches games from the [Lichess games export API](https://lichess.org/api#tag/Games/operation/apiGamesUser)
    as NDJSON (`GET /api/games/user/{username}`), which already includes
    clocks, opening data, and — for games you've had analyzed on Lichess —
    per-move evals and blunder/mistake/inaccuracy judgments, for free.
  - For games without existing Lichess analysis, `POST /api/games/{id}/analyze`
    runs a local Stockfish engine (via `python-chess`) on demand and caches
    the result, since analyzing every move of every bullet game up front
    would be far too slow.
- **`client/`** — React + Vite + Recharts dashboard.

## Setup

### 1. Backend

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # optionally fill in LICHESS_USERNAME / LICHESS_TOKEN

# Stockfish is used for on-demand analysis of games Lichess hasn't analyzed.
# Debian/Ubuntu:
sudo apt-get install -y stockfish
# macOS:
brew install stockfish

.venv/bin/uvicorn app.main:app --reload --port 8000
```

If `stockfish` isn't on your `PATH` after installing (e.g. Debian puts it in
`/usr/games`), set `STOCKFISH_PATH` in `server/.env`.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env.local   # points the UI at the backend
npm run dev
```

Open http://localhost:5173, enter your Lichess username, and click **Sync new
games**.

## A note on the Lichess token

A token isn't required to read public games — the sync will work with just a
username. Add a token (`LICHESS_TOKEN` in `server/.env`) only if you want a
higher rate limit or need to read your own unlisted games. Generate one at
https://lichess.org/account/oauth/token with the `game:read` scope.

**Never paste an API token into a chat prompt or commit it to git.** Keep it
in `server/.env`, which is gitignored.

## How the numbers are computed

- **Rating trend** — each rated game's post-game rating for your account,
  plotted chronologically.
- **Openings** — win/draw/loss counts grouped by Lichess's own opening
  classification (ECO + name).
- **Time usage** — reconstructed from the per-move clock snapshots Lichess
  returns, converted to time spent per move (accounting for increment), and
  averaged per move number.
- **Blunders/mistakes/inaccuracies** — from Lichess's own analysis judgments
  when a game has been analyzed there, otherwise from a local Stockfish pass:
  centipawn loss between the best available move and the move actually
  played, thresholded at 40/120/300 cp for inaccuracy/mistake/blunder.

## Limitations

- Bulk sync does **not** run Stockfish on every game (would be far too slow
  for hundreds of bullet games) — blunder stats only cover games that have
  been analyzed, either on Lichess or via the "Analyze this game" button.
- Stockfish analysis depth defaults to 14 (`STOCKFISH_DEPTH` in `.env`);
  raise it for more accurate (but slower) evaluations.
