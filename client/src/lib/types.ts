export type Perf = "bullet" | "blitz";

export interface Game {
  id: string;
  username: string;
  perf: string;
  speed: string;
  rated: boolean;
  created_at: number;
  status: string;
  color: "white" | "black";
  result: "win" | "loss" | "draw" | "other";
  user_rating: number | null;
  user_rating_diff: number | null;
  opponent: string;
  opponent_rating: number | null;
  opening_name: string | null;
  opening_eco: string | null;
  moves: string;
  clocks: number[] | null;
  clock_initial: number | null;
  clock_increment: number | null;
  pgn: string | null;
  lichess_analyzed: number;
  local_analyzed: number;
  // Precomputed on analysis, for cheap aggregate stats without re-reading move_evals per game.
  blunders?: number;
  mistakes?: number;
  inaccuracies?: number;
  movesAnalyzed?: number;
}

export interface MoveEval {
  game_id: string;
  ply: number;
  mover: "white" | "black";
  move_san: string;
  cp: number | null;
  mate: number | null;
  best_move: string | null;
  classification: string | null;
  clock_seconds: number | null;
}
