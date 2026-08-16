/** In-browser Stockfish analysis — the client-side replacement for the
 * old server's analysis.py. Runs a full game through the WASM engine and
 * classifies each of the user's moves by centipawn loss. */
import { Chess } from "chess.js";
import { StockfishEngine } from "./engine";
import type { MoveEval } from "./types";

const MATE_SCORE = 100000;

export function classifyLoss(lossCp: number): string {
  if (lossCp >= 300) return "blunder";
  if (lossCp >= 120) return "mistake";
  if (lossCp >= 40) return "inaccuracy";
  if (lossCp <= 5) return "best";
  return "good";
}

// Converts an engine eval (relative to the side to move) into a mate-aware
// numeric score, still relative to the side to move.
function toRelativeCp(ev: { cp: number | null; mate: number | null }): number {
  if (ev.mate !== null) return ev.mate > 0 ? MATE_SCORE - ev.mate : -MATE_SCORE - ev.mate;
  return ev.cp ?? 0;
}

function uciToSan(fen: string, uci: string | null): string | null {
  if (!uci) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    return move?.san ?? uci;
  } catch {
    return uci;
  }
}

export async function analyzeMovesSan(
  movesSan: string[],
  clocksCentis: number[] | null,
  depth: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Omit<MoveEval, "game_id">[]> {
  const engine = new StockfishEngine();
  const chess = new Chess();

  // whiteCp[i] = White-perspective eval of the position *before* move i is
  // played (i.e. after i plies). whiteCp[movesSan.length] is the eval of
  // the final position. Keeping everything in one consistent perspective
  // (rather than "whoever's turn it is") means it can be diffed directly
  // across plies, and matches the convention Lichess's own analysis uses.
  const whiteCp: number[] = [];
  const bestMovesSan: (string | null)[] = [];

  function pushWhiteCp(fen: string, relative: number) {
    const sideToMove = fen.split(" ")[1];
    whiteCp.push(sideToMove === "w" ? relative : -relative);
  }

  try {
    for (let i = 0; i < movesSan.length; i++) {
      const fen = chess.fen();
      const ev = await engine.analyzePosition(fen, depth);
      pushWhiteCp(fen, toRelativeCp(ev));
      bestMovesSan.push(uciToSan(fen, ev.bestMoveUci));
      chess.move(movesSan[i]);
      onProgress?.(i + 1, movesSan.length);
    }
    // A checkmate/stalemate position has no legal moves, so the engine
    // returns no "info" line to score it — special-case it like
    // python-chess's analyse() does, instead of silently treating it as 0.
    if (chess.isCheckmate()) {
      const fen = chess.fen();
      const sideToMove = fen.split(" ")[1];
      // The side to move is checkmated, so it's maximally bad for them.
      whiteCp.push(sideToMove === "w" ? -MATE_SCORE : MATE_SCORE);
    } else if (chess.isGameOver()) {
      whiteCp.push(0);
    } else {
      const fen = chess.fen();
      const finalEv = await engine.analyzePosition(fen, depth);
      pushWhiteCp(fen, toRelativeCp(finalEv));
    }
  } finally {
    engine.terminate();
  }

  const evals: Omit<MoveEval, "game_id">[] = [];
  for (let ply = 0; ply < movesSan.length; ply++) {
    const mover: "white" | "black" = ply % 2 === 0 ? "white" : "black";
    const before = whiteCp[ply];
    const after = whiteCp[ply + 1];
    // Loss is always from the mover's own point of view (how much worse
    // this move made things for them), regardless of which side moved.
    const loss = mover === "white" ? Math.max(0, before - after) : Math.max(0, after - before);
    evals.push({
      ply,
      mover,
      move_san: movesSan[ply],
      // Stored White-perspective, same convention as the Lichess-analysis
      // path — so the eval graph and any diffing across plies is consistent
      // regardless of which engine/source produced the numbers.
      cp: Math.abs(after) < MATE_SCORE - 1000 ? after : null,
      mate: null,
      best_move: bestMovesSan[ply],
      classification: classifyLoss(loss),
      clock_seconds: clocksCentis && ply < clocksCentis.length ? clocksCentis[ply] / 100 : null,
    });
  }
  return evals;
}
