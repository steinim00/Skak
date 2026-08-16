"""Local Stockfish analysis, used as a fallback for games Lichess hasn't
already analyzed (most bullet/blitz games, since server-side analysis on
lichess.org is opt-in per game)."""
import shutil

import chess
import chess.engine

from app.config import STOCKFISH_DEPTH, STOCKFISH_PATH, STOCKFISH_TIME_LIMIT

# Debian/Ubuntu's stockfish package installs to /usr/games, which isn't
# always on PATH (e.g. non-login shells, some containers).
_FALLBACK_PATHS = ["/usr/games/stockfish", "/usr/local/bin/stockfish", "/opt/homebrew/bin/stockfish"]


class EngineUnavailable(Exception):
    pass


def resolve_stockfish_path() -> str | None:
    found = shutil.which(STOCKFISH_PATH)
    if found:
        return found
    for candidate in _FALLBACK_PATHS:
        if shutil.which(candidate):
            return candidate
    return None


def stockfish_available() -> bool:
    return resolve_stockfish_path() is not None


def classify_loss(loss_cp: int) -> str:
    if loss_cp >= 300:
        return "blunder"
    if loss_cp >= 120:
        return "mistake"
    if loss_cp >= 40:
        return "inaccuracy"
    if loss_cp <= 5:
        return "best"
    return "good"


def analyze_moves_san(moves_san: list[str], clocks_centis: list[int] | None = None) -> list[dict]:
    """Runs Stockfish over every position of a game and returns per-move
    eval + classification. `moves_san` is the game's move list in SAN."""
    resolved_path = resolve_stockfish_path()
    if not resolved_path:
        raise EngineUnavailable(
            f"Stockfish binary not found ('{STOCKFISH_PATH}'). "
            "Install it (e.g. `apt-get install stockfish`) or set STOCKFISH_PATH."
        )

    limit = (
        chess.engine.Limit(time=STOCKFISH_TIME_LIMIT)
        if STOCKFISH_TIME_LIMIT > 0
        else chess.engine.Limit(depth=STOCKFISH_DEPTH)
    )

    board = chess.Board()
    relative_cp: list[int] = []
    best_moves_san: list[str | None] = []

    with chess.engine.SimpleEngine.popen_uci(resolved_path) as engine:
        for san in moves_san:
            info = engine.analyse(board, limit)
            score = info["score"].relative.score(mate_score=100000)
            relative_cp.append(score if score is not None else 0)
            pv = info.get("pv")
            best_san = None
            if pv:
                try:
                    best_san = board.san(pv[0])
                except ValueError:
                    best_san = pv[0].uci()
            best_moves_san.append(best_san)
            board.push_san(san)

        # final position, no move to classify but needed as the "after" anchor
        info = engine.analyse(board, limit)
        score = info["score"].relative.score(mate_score=100000)
        relative_cp.append(score if score is not None else 0)

    evals = []
    for ply, san in enumerate(moves_san):
        mover = "white" if ply % 2 == 0 else "black"
        value_before = relative_cp[ply]
        value_after = -relative_cp[ply + 1]
        loss = max(0, value_before - value_after)
        clock_seconds = None
        if clocks_centis and ply < len(clocks_centis):
            clock_seconds = clocks_centis[ply] / 100.0
        evals.append(
            {
                "game_id": None,  # filled in by caller
                "ply": ply,
                "mover": mover,
                "move_san": san,
                "cp": value_after if abs(value_after) < 90000 else None,
                "mate": None,
                "best_move": best_moves_san[ply],
                "classification": classify_loss(loss),
                "clock_seconds": clock_seconds,
            }
        )
    return evals
