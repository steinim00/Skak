"""Aggregation helpers for the dashboard: rating history, opening
win-rates, clock/time-usage curves, and blunder trends."""
import json
import sqlite3

MOVE_BUCKET_CAP = 40  # moves beyond this get lumped into a single "40+" bucket


def rating_history(conn: sqlite3.Connection, username: str, perf: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT created_at, user_rating, result
        FROM games
        WHERE username = ? AND perf = ? AND rated = 1 AND user_rating IS NOT NULL
        ORDER BY created_at ASC
        """,
        (username, perf),
    ).fetchall()
    return [
        {"createdAt": r["created_at"], "rating": r["user_rating"], "result": r["result"]}
        for r in rows
    ]


def opening_stats(conn: sqlite3.Connection, username: str, perf: str, limit: int = 15) -> list[dict]:
    rows = conn.execute(
        """
        SELECT opening_name, opening_eco, color, result
        FROM games
        WHERE username = ? AND perf = ? AND opening_name IS NOT NULL
        """,
        (username, perf),
    ).fetchall()

    agg: dict[str, dict] = {}
    for r in rows:
        key = r["opening_name"] or "Unknown"
        entry = agg.setdefault(
            key, {"name": key, "eco": r["opening_eco"], "games": 0, "wins": 0, "draws": 0, "losses": 0}
        )
        entry["games"] += 1
        if r["result"] == "win":
            entry["wins"] += 1
        elif r["result"] == "draw":
            entry["draws"] += 1
        elif r["result"] == "loss":
            entry["losses"] += 1

    out = list(agg.values())
    for e in out:
        e["winRate"] = round(100 * e["wins"] / e["games"], 1) if e["games"] else 0.0
    out.sort(key=lambda e: e["games"], reverse=True)
    return out[:limit]


def _move_spent_seconds(clocks_centis: list[int], clock_initial: int, clock_increment: int) -> list[float]:
    spent = []
    for i, remaining_c in enumerate(clocks_centis):
        prev_c = clocks_centis[i - 2] if i >= 2 else clock_initial * 100
        s = (prev_c - remaining_c) / 100.0 + (clock_increment or 0)
        spent.append(max(0.0, s))
    return spent


def time_usage(conn: sqlite3.Connection, username: str, perf: str) -> dict:
    rows = conn.execute(
        """
        SELECT color, clocks, clock_initial, clock_increment, status, result
        FROM games
        WHERE username = ? AND perf = ? AND clocks IS NOT NULL
        """,
        (username, perf),
    ).fetchall()

    bucket_totals: dict[int, float] = {}
    bucket_counts: dict[int, int] = {}
    low_time_moves = 0
    total_moves = 0
    flag_losses = 0

    for r in rows:
        clocks = json.loads(r["clocks"])
        clock_initial = r["clock_initial"] or 0
        clock_increment = r["clock_increment"] or 0
        spent = _move_spent_seconds(clocks, clock_initial, clock_increment)

        my_offset = 0 if r["color"] == "white" else 1
        for ply in range(my_offset, len(spent), 2):
            move_number = ply // 2 + 1
            bucket = min(move_number, MOVE_BUCKET_CAP)
            bucket_totals[bucket] = bucket_totals.get(bucket, 0.0) + spent[ply]
            bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1
            total_moves += 1
            remaining_s = clocks[ply] / 100.0
            if clock_initial and remaining_s < 0.1 * clock_initial:
                low_time_moves += 1

        if r["status"] == "outoftime" and r["result"] == "loss":
            flag_losses += 1

    curve = [
        {"moveNumber": b, "avgSeconds": round(bucket_totals[b] / bucket_counts[b], 2)}
        for b in sorted(bucket_totals.keys())
    ]

    return {
        "curve": curve,
        "timePressureRate": round(100 * low_time_moves / total_moves, 1) if total_moves else 0.0,
        "flagLosses": flag_losses,
        "gamesConsidered": len(rows),
    }


def blunder_stats(conn: sqlite3.Connection, username: str, perf: str) -> dict:
    rows = conn.execute(
        """
        SELECT g.id, g.created_at, g.opening_name, g.result,
               SUM(CASE WHEN m.classification = 'blunder' THEN 1 ELSE 0 END) AS blunders,
               SUM(CASE WHEN m.classification = 'mistake' THEN 1 ELSE 0 END) AS mistakes,
               SUM(CASE WHEN m.classification = 'inaccuracy' THEN 1 ELSE 0 END) AS inaccuracies,
               COUNT(m.ply) AS moves_analyzed
        FROM games g
        JOIN move_evals m ON m.game_id = g.id
        WHERE g.username = ? AND g.perf = ? AND m.mover = g.color
        GROUP BY g.id
        ORDER BY g.created_at ASC
        """,
        (username, perf),
    ).fetchall()

    per_game = [
        {
            "gameId": r["id"],
            "createdAt": r["created_at"],
            "opening": r["opening_name"],
            "result": r["result"],
            "blunders": r["blunders"],
            "mistakes": r["mistakes"],
            "inaccuracies": r["inaccuracies"],
            "movesAnalyzed": r["moves_analyzed"],
        }
        for r in rows
    ]

    total_blunders = sum(g["blunders"] for g in per_game)
    total_mistakes = sum(g["mistakes"] for g in per_game)
    total_inaccuracies = sum(g["inaccuracies"] for g in per_game)
    total_moves = sum(g["movesAnalyzed"] for g in per_game)

    opening_blunders: dict[str, int] = {}
    for g in per_game:
        if g["blunders"]:
            key = g["opening"] or "Unknown"
            opening_blunders[key] = opening_blunders.get(key, 0) + g["blunders"]
    worst_openings = sorted(opening_blunders.items(), key=lambda kv: kv[1], reverse=True)[:10]

    return {
        "perGame": per_game,
        "totals": {
            "blunders": total_blunders,
            "mistakes": total_mistakes,
            "inaccuracies": total_inaccuracies,
            "movesAnalyzed": total_moves,
            "blunderRate": round(100 * total_blunders / total_moves, 2) if total_moves else 0.0,
        },
        "worstOpenings": [{"opening": k, "blunders": v} for k, v in worst_openings],
        "gamesAnalyzed": len(per_game),
    }
