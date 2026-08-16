import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    perf TEXT NOT NULL,
    speed TEXT NOT NULL,
    rated INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT,
    termination TEXT,
    color TEXT NOT NULL,
    result TEXT NOT NULL,
    user_rating INTEGER,
    user_rating_diff INTEGER,
    opponent TEXT,
    opponent_rating INTEGER,
    opening_eco TEXT,
    opening_name TEXT,
    moves TEXT,
    clocks TEXT,
    clock_initial INTEGER,
    clock_increment INTEGER,
    pgn TEXT,
    lichess_analyzed INTEGER DEFAULT 0,
    local_analyzed INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_games_username_perf ON games(username, perf);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);

CREATE TABLE IF NOT EXISTS move_evals (
    game_id TEXT NOT NULL,
    ply INTEGER NOT NULL,
    mover TEXT NOT NULL,
    move_san TEXT,
    cp INTEGER,
    mate INTEGER,
    best_move TEXT,
    classification TEXT,
    clock_seconds REAL,
    PRIMARY KEY (game_id, ply),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS sync_state (
    username TEXT PRIMARY KEY,
    last_synced_at INTEGER,
    newest_game_created_at INTEGER
);
"""


def get_connection() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        yield conn.cursor()
        conn.commit()
    finally:
        conn.close()


def upsert_game(conn: sqlite3.Connection, game: dict) -> None:
    conn.execute(
        """
        INSERT INTO games (
            id, username, perf, speed, rated, created_at, status, termination,
            color, result, user_rating, user_rating_diff, opponent, opponent_rating,
            opening_eco, opening_name, moves, clocks, clock_initial, clock_increment,
            pgn, lichess_analyzed
        ) VALUES (
            :id, :username, :perf, :speed, :rated, :created_at, :status, :termination,
            :color, :result, :user_rating, :user_rating_diff, :opponent, :opponent_rating,
            :opening_eco, :opening_name, :moves, :clocks, :clock_initial, :clock_increment,
            :pgn, :lichess_analyzed
        )
        ON CONFLICT(id) DO UPDATE SET
            status=excluded.status,
            termination=excluded.termination,
            user_rating_diff=excluded.user_rating_diff,
            lichess_analyzed=excluded.lichess_analyzed
        """,
        game,
    )


def get_sync_state(conn: sqlite3.Connection, username: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM sync_state WHERE username = ?", (username,)
    ).fetchone()


def set_sync_state(conn: sqlite3.Connection, username: str, newest_game_created_at: int) -> None:
    import time

    conn.execute(
        """
        INSERT INTO sync_state (username, last_synced_at, newest_game_created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            last_synced_at=excluded.last_synced_at,
            newest_game_created_at=MAX(sync_state.newest_game_created_at, excluded.newest_game_created_at)
        """,
        (username, int(time.time() * 1000), newest_game_created_at),
    )


def save_move_evals(conn: sqlite3.Connection, game_id: str, evals: list[dict], analyzed_flag_col: str) -> None:
    conn.execute(f"DELETE FROM move_evals WHERE game_id = ?", (game_id,))
    conn.executemany(
        """
        INSERT INTO move_evals (game_id, ply, mover, move_san, cp, mate, best_move, classification, clock_seconds)
        VALUES (:game_id, :ply, :mover, :move_san, :cp, :mate, :best_move, :classification, :clock_seconds)
        """,
        evals,
    )
    conn.execute(f"UPDATE games SET {analyzed_flag_col} = 1 WHERE id = ?", (game_id,))


def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}
