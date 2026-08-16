from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app import db, stats
from app.analysis import EngineUnavailable, analyze_moves_san, stockfish_available
from app.config import CORS_ORIGINS, DEFAULT_USERNAME, LICHESS_TOKEN
from app.lichess_client import LichessError, analysis_to_move_evals, fetch_games

app = FastAPI(title="Skak — Lichess Game Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db.init_db()


@app.get("/api/status")
def status():
    return {
        "defaultUsername": DEFAULT_USERNAME,
        "stockfishAvailable": stockfish_available(),
    }


@app.post("/api/sync")
def sync(username: str = Query(...), token: str = Query(""), full: bool = Query(False), max_games: int = Query(300)):
    token = token or LICHESS_TOKEN
    with db.db_cursor() as cur:
        conn = cur.connection
        since_ms = None
        if not full:
            state = db.get_sync_state(conn, username)
            if state and state["newest_game_created_at"]:
                since_ms = state["newest_game_created_at"] + 1

        fetched = 0
        newest = since_ms or 0
        try:
            for game in fetch_games(username, ["bullet", "blitz"], token=token, since_ms=since_ms, max_games=max_games):
                raw_analysis = game.pop("raw_analysis")
                db.upsert_game(conn, game)
                fetched += 1
                newest = max(newest, game["created_at"])

                if raw_analysis:
                    moves_san = game["moves"].split() if game["moves"] else []
                    evals = analysis_to_move_evals(game["id"], moves_san, raw_analysis)
                    for e in evals:
                        e["game_id"] = game["id"]
                    db.save_move_evals(conn, game["id"], evals, "lichess_analyzed")
        except LichessError as e:
            raise HTTPException(status_code=502, detail=str(e))

        if fetched and newest:
            db.set_sync_state(conn, username, newest)

    return {"username": username, "fetched": fetched}


@app.get("/api/games")
def list_games(
    username: str = Query(...),
    perf: str = Query("bullet"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
):
    with db.db_cursor() as cur:
        rows = cur.execute(
            """
            SELECT id, perf, created_at, color, result, user_rating, user_rating_diff,
                   opponent, opponent_rating, opening_name, opening_eco, status,
                   lichess_analyzed, local_analyzed
            FROM games
            WHERE username = ? AND perf = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (username, perf, limit, offset),
        ).fetchall()
        total = cur.execute(
            "SELECT COUNT(*) as c FROM games WHERE username = ? AND perf = ?", (username, perf)
        ).fetchone()["c"]
    return {"total": total, "games": [db.row_to_dict(r) for r in rows]}


@app.get("/api/games/{game_id}")
def get_game(game_id: str):
    with db.db_cursor() as cur:
        row = cur.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Game not found")
        game = db.row_to_dict(row)
        evals = cur.execute(
            "SELECT * FROM move_evals WHERE game_id = ? ORDER BY ply ASC", (game_id,)
        ).fetchall()
        game["moveEvals"] = [db.row_to_dict(e) for e in evals]
    return game


@app.post("/api/games/{game_id}/analyze")
def analyze_game(game_id: str):
    with db.db_cursor() as cur:
        conn = cur.connection
        row = cur.execute("SELECT * FROM games WHERE id = ?", (game_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Game not found")
        if row["lichess_analyzed"] or row["local_analyzed"]:
            existing = cur.execute(
                "SELECT * FROM move_evals WHERE game_id = ? ORDER BY ply ASC", (game_id,)
            ).fetchall()
            return {"gameId": game_id, "source": "cached", "moveEvals": [db.row_to_dict(e) for e in existing]}

        moves_san = row["moves"].split() if row["moves"] else []
        clocks = None
        if row["clocks"]:
            import json

            clocks = json.loads(row["clocks"])

        try:
            evals = analyze_moves_san(moves_san, clocks)
        except EngineUnavailable as e:
            raise HTTPException(status_code=503, detail=str(e))

        for e in evals:
            e["game_id"] = game_id
        db.save_move_evals(conn, game_id, evals, "local_analyzed")

    return {"gameId": game_id, "source": "stockfish", "moveEvals": evals}


@app.get("/api/stats/rating-history")
def api_rating_history(username: str = Query(...), perf: str = Query("bullet")):
    with db.db_cursor() as cur:
        return {"data": stats.rating_history(cur.connection, username, perf)}


@app.get("/api/stats/openings")
def api_opening_stats(username: str = Query(...), perf: str = Query("bullet")):
    with db.db_cursor() as cur:
        return {"data": stats.opening_stats(cur.connection, username, perf)}


@app.get("/api/stats/time-usage")
def api_time_usage(username: str = Query(...), perf: str = Query("bullet")):
    with db.db_cursor() as cur:
        return stats.time_usage(cur.connection, username, perf)


@app.get("/api/stats/blunders")
def api_blunder_stats(username: str = Query(...), perf: str = Query("bullet")):
    with db.db_cursor() as cur:
        return stats.blunder_stats(cur.connection, username, perf)
