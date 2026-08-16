const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export type Perf = "bullet" | "blitz";

export interface GameSummary {
  id: string;
  perf: string;
  created_at: number;
  color: "white" | "black";
  result: "win" | "loss" | "draw" | "other";
  user_rating: number | null;
  user_rating_diff: number | null;
  opponent: string;
  opponent_rating: number | null;
  opening_name: string | null;
  opening_eco: string | null;
  status: string;
  lichess_analyzed: number;
  local_analyzed: number;
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

export interface GameDetail extends GameSummary {
  moves: string;
  clocks: string | null;
  clock_initial: number | null;
  clock_increment: number | null;
  pgn: string | null;
  moveEvals: MoveEval[];
}

export interface RatingPoint {
  createdAt: number;
  rating: number;
  result: string;
}

export interface OpeningStat {
  name: string;
  eco: string | null;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export interface TimeUsage {
  curve: { moveNumber: number; avgSeconds: number }[];
  timePressureRate: number;
  flagLosses: number;
  gamesConsidered: number;
}

export interface BlunderGame {
  gameId: string;
  createdAt: number;
  opening: string | null;
  result: string;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  movesAnalyzed: number;
}

export interface BlunderStats {
  perGame: BlunderGame[];
  totals: {
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    movesAnalyzed: number;
    blunderRate: number;
  };
  worstOpenings: { opening: string; blunders: number }[];
  gamesAnalyzed: number;
}

async function getJson<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export const api = {
  status: () => getJson<{ defaultUsername: string; stockfishAvailable: boolean }>("/api/status"),

  sync: async (username: string, opts: { full?: boolean } = {}) => {
    const url = new URL(API_BASE + "/api/sync");
    url.searchParams.set("username", username);
    if (opts.full) url.searchParams.set("full", "true");
    const res = await fetch(url.toString(), { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ username: string; fetched: number }>;
  },

  games: (username: string, perf: Perf, limit = 50, offset = 0) =>
    getJson<{ total: number; games: GameSummary[] }>("/api/games", { username, perf, limit, offset }),

  game: (id: string) => getJson<GameDetail>(`/api/games/${id}`),

  analyzeGame: async (id: string) => {
    const res = await fetch(`${API_BASE}/api/games/${id}/analyze`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ gameId: string; source: string; moveEvals: MoveEval[] }>;
  },

  ratingHistory: (username: string, perf: Perf) =>
    getJson<{ data: RatingPoint[] }>("/api/stats/rating-history", { username, perf }),

  openings: (username: string, perf: Perf) => getJson<{ data: OpeningStat[] }>("/api/stats/openings", { username, perf }),

  timeUsage: (username: string, perf: Perf) => getJson<TimeUsage>("/api/stats/time-usage", { username, perf }),

  blunders: (username: string, perf: Perf) => getJson<BlunderStats>("/api/stats/blunders", { username, perf }),
};
