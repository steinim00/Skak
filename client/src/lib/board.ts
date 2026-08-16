import { Chess } from "chess.js";

export interface PositionAtPly {
  /** FEN of the position right before the move at `ply` was played — the
   * actual decision point, not just "middlegame" or some other label. */
  fen: string;
  from?: string;
  to?: string;
}

/** `movesStr` is a space-separated SAN move list (e.g. Game.moves), `ply`
 * is 0-indexed (0 = White's first move). */
export function positionForHighlight(movesStr: string, ply: number): PositionAtPly {
  const chess = new Chess();
  const sanMoves = movesStr.trim().split(/\s+/);
  for (let i = 0; i < ply; i++) {
    if (!sanMoves[i]) break;
    try {
      chess.move(sanMoves[i]);
    } catch {
      break;
    }
  }
  const fen = chess.fen();
  let from: string | undefined;
  let to: string | undefined;
  if (sanMoves[ply]) {
    try {
      const move = chess.move(sanMoves[ply]);
      from = move?.from;
      to = move?.to;
    } catch {
      // Leave from/to undefined — MiniBoard just won't highlight anything.
    }
  }
  return { fen, from, to };
}
