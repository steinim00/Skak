"""Client for the Lichess games export API.

Docs: https://lichess.org/api#tag/Games/operation/apiGamesUser
Streams NDJSON (one JSON object per game) rather than PGN, since the
structured fields (clocks, opening, existing analysis) are much easier
to work with than parsing PGN tags/comments.
"""
import json
from typing import Iterator

import httpx

from app.config import LICHESS_BASE_URL

JUDGMENT_TO_CLASSIFICATION = {
    "Blunder": "blunder",
    "Mistake": "mistake",
    "Inaccuracy": "inaccuracy",
}


class LichessError(Exception):
    pass


def fetch_games(
    username: str,
    perf_types: list[str],
    token: str = "",
    since_ms: int | None = None,
    max_games: int | None = None,
) -> Iterator[dict]:
    """Yields normalized game dicts (with a 'raw_analysis' key for any
    existing Lichess computer analysis) for the given user."""
    url = f"{LICHESS_BASE_URL}/api/games/user/{username}"
    params = {
        "perfType": ",".join(perf_types),
        "evals": "true",
        "opening": "true",
        "clocks": "true",
        "rated": "true",
        "sort": "dateDesc",
    }
    if since_ms:
        params["since"] = since_ms
    if max_games:
        params["max"] = max_games

    headers = {"Accept": "application/x-ndjson"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    with httpx.Client(timeout=60.0) as client:
        with client.stream("GET", url, params=params, headers=headers) as resp:
            if resp.status_code == 429:
                raise LichessError("Rate limited by Lichess (429). Wait a minute and retry.")
            if resp.status_code != 200:
                body = resp.read().decode(errors="replace")[:500]
                raise LichessError(f"Lichess API error {resp.status_code}: {body}")

            for line in resp.iter_lines():
                if not line:
                    continue
                raw = json.loads(line)
                normalized = normalize_game(raw, username)
                if normalized:
                    yield normalized


def normalize_game(raw: dict, username: str) -> dict | None:
    players = raw.get("players", {})
    white = players.get("white", {})
    black = players.get("black", {})

    username_lower = username.lower()
    white_id = (white.get("user") or {}).get("id", "").lower()
    black_id = (black.get("user") or {}).get("id", "").lower()

    if username_lower == white_id:
        color, me, opponent = "white", white, black
    elif username_lower == black_id:
        color, me, opponent = "black", black, white
    else:
        # Game doesn't involve this user (shouldn't happen for this endpoint)
        return None

    winner = raw.get("winner")
    status = raw.get("status")
    if winner is None:
        result = "draw" if status in ("draw", "stalemate") else "other"
    else:
        result = "win" if winner == color else "loss"

    opp_user = opponent.get("user") or {}
    opponent_name = opp_user.get("name") or (
        f"Stockfish level {opponent.get('aiLevel')}" if opponent.get("aiLevel") else "Anonymous"
    )

    opening = raw.get("opening") or {}
    clock = raw.get("clock") or {}
    clocks = raw.get("clocks")

    analysis = raw.get("analysis")

    game = {
        "id": raw["id"],
        "username": username,
        "perf": raw.get("perf", raw.get("speed", "")),
        "speed": raw.get("speed", ""),
        "rated": 1 if raw.get("rated") else 0,
        "created_at": raw.get("createdAt", 0),
        "status": status,
        "termination": status,
        "color": color,
        "result": result,
        "user_rating": me.get("rating"),
        "user_rating_diff": me.get("ratingDiff"),
        "opponent": opponent_name,
        "opponent_rating": opponent.get("rating"),
        "opening_eco": opening.get("eco"),
        "opening_name": opening.get("name"),
        "moves": raw.get("moves", ""),
        "clocks": json.dumps(clocks) if clocks else None,
        "clock_initial": clock.get("initial"),
        "clock_increment": clock.get("increment"),
        "pgn": raw.get("pgn"),
        "lichess_analyzed": 1 if analysis else 0,
        "raw_analysis": analysis,
    }
    return game


def analysis_to_move_evals(game_id: str, moves_san: list[str], analysis: list[dict]) -> list[dict]:
    """Converts Lichess's per-ply analysis array into our move_evals rows."""
    evals = []
    for ply, (san, entry) in enumerate(zip(moves_san, analysis)):
        mover = "white" if ply % 2 == 0 else "black"
        judgment = (entry.get("judgment") or {}).get("name")
        evals.append(
            {
                "game_id": game_id,
                "ply": ply,
                "mover": mover,
                "move_san": san,
                "cp": entry.get("eval"),
                "mate": entry.get("mate"),
                "best_move": entry.get("best"),
                "classification": JUDGMENT_TO_CLASSIFICATION.get(judgment),
                "clock_seconds": None,
            }
        )
    return evals
