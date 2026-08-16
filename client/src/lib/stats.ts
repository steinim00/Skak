/** Aggregation helpers for the dashboard — ported from the old server's
 * stats.py, operating on Game records already loaded from IndexedDB. */
import type { Game, MoveEval } from "./types";

const MOVE_BUCKET_CAP = 40;

export interface RatingPoint {
  createdAt: number;
  rating: number;
  result: string;
}

export function ratingHistory(games: Game[]): RatingPoint[] {
  return games
    .filter((g) => g.rated && g.user_rating != null)
    .sort((a, b) => a.created_at - b.created_at)
    .map((g) => ({ createdAt: g.created_at, rating: g.user_rating as number, result: g.result }));
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

export function openingStats(games: Game[], limit = 15): OpeningStat[] {
  const agg = new Map<string, OpeningStat>();
  for (const g of games) {
    if (!g.opening_name) continue;
    const key = g.opening_name;
    let entry = agg.get(key);
    if (!entry) {
      entry = { name: key, eco: g.opening_eco, games: 0, wins: 0, draws: 0, losses: 0, winRate: 0 };
      agg.set(key, entry);
    }
    entry.games += 1;
    if (g.result === "win") entry.wins += 1;
    else if (g.result === "draw") entry.draws += 1;
    else if (g.result === "loss") entry.losses += 1;
  }
  const out = Array.from(agg.values());
  for (const e of out) e.winRate = e.games ? Math.round((1000 * e.wins) / e.games) / 10 : 0;
  out.sort((a, b) => b.games - a.games);
  return out.slice(0, limit);
}

function moveSpentSeconds(clocksCentis: number[], clockInitial: number, clockIncrement: number): number[] {
  const spent: number[] = [];
  for (let i = 0; i < clocksCentis.length; i++) {
    const prevC = i >= 2 ? clocksCentis[i - 2] : clockInitial * 100;
    const s = (prevC - clocksCentis[i]) / 100 + (clockIncrement || 0);
    spent.push(Math.max(0, s));
  }
  return spent;
}

export interface TimeUsage {
  curve: { moveNumber: number; avgSeconds: number }[];
  timePressureRate: number;
  flagLosses: number;
  gamesConsidered: number;
}

export function timeUsage(games: Game[]): TimeUsage {
  const withClocks = games.filter((g) => g.clocks != null);
  const bucketTotals = new Map<number, number>();
  const bucketCounts = new Map<number, number>();
  let lowTimeMoves = 0;
  let totalMoves = 0;
  let flagLosses = 0;

  for (const g of withClocks) {
    const clocks = g.clocks as number[];
    const clockInitial = g.clock_initial ?? 0;
    const clockIncrement = g.clock_increment ?? 0;
    const spent = moveSpentSeconds(clocks, clockInitial, clockIncrement);

    const myOffset = g.color === "white" ? 0 : 1;
    for (let ply = myOffset; ply < spent.length; ply += 2) {
      const moveNumber = Math.floor(ply / 2) + 1;
      const bucket = Math.min(moveNumber, MOVE_BUCKET_CAP);
      bucketTotals.set(bucket, (bucketTotals.get(bucket) ?? 0) + spent[ply]);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
      totalMoves += 1;
      const remainingS = clocks[ply] / 100;
      if (clockInitial && remainingS < 0.1 * clockInitial) lowTimeMoves += 1;
    }

    if (g.status === "outoftime" && g.result === "loss") flagLosses += 1;
  }

  const curve = Array.from(bucketTotals.keys())
    .sort((a, b) => a - b)
    .map((b) => ({
      moveNumber: b,
      avgSeconds: Math.round((100 * (bucketTotals.get(b) as number)) / (bucketCounts.get(b) as number)) / 100,
    }));

  return {
    curve,
    timePressureRate: totalMoves ? Math.round((1000 * lowTimeMoves) / totalMoves) / 10 : 0,
    flagLosses,
    gamesConsidered: withClocks.length,
  };
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

export function blunderStats(games: Game[]): BlunderStats {
  const analyzed = games
    .filter((g) => g.lichess_analyzed || g.local_analyzed)
    .sort((a, b) => a.created_at - b.created_at);

  const perGame: BlunderGame[] = analyzed.map((g) => ({
    gameId: g.id,
    createdAt: g.created_at,
    opening: g.opening_name,
    result: g.result,
    blunders: g.blunders ?? 0,
    mistakes: g.mistakes ?? 0,
    inaccuracies: g.inaccuracies ?? 0,
    movesAnalyzed: g.movesAnalyzed ?? 0,
  }));

  const totalBlunders = perGame.reduce((s, g) => s + g.blunders, 0);
  const totalMistakes = perGame.reduce((s, g) => s + g.mistakes, 0);
  const totalInaccuracies = perGame.reduce((s, g) => s + g.inaccuracies, 0);
  const totalMoves = perGame.reduce((s, g) => s + g.movesAnalyzed, 0);

  const openingBlunders = new Map<string, number>();
  for (const g of perGame) {
    if (g.blunders) {
      const key = g.opening ?? "Unknown";
      openingBlunders.set(key, (openingBlunders.get(key) ?? 0) + g.blunders);
    }
  }
  const worstOpenings = Array.from(openingBlunders.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([opening, blunders]) => ({ opening, blunders }));

  return {
    perGame,
    totals: {
      blunders: totalBlunders,
      mistakes: totalMistakes,
      inaccuracies: totalInaccuracies,
      movesAnalyzed: totalMoves,
      blunderRate: totalMoves ? Math.round((10000 * totalBlunders) / totalMoves) / 100 : 0,
    },
    worstOpenings,
    gamesAnalyzed: perGame.length,
  };
}

/**
 * Instead of bucketing errors into a vague "opening/middlegame/endgame"
 * label, this surfaces the *actual positions* behind your biggest blunders
 * and your best swings — concrete diagrams instead of a phase name.
 *
 * "Swing" is the change in White-perspective eval this move caused, signed
 * from the mover's point of view: negative = this move made things worse
 * for you (a blunder candidate), positive = this move made things better
 * for you (you found a strong move in a tough or messy spot).
 *
 * Requires MoveEval.cp to be in a *consistent* perspective across plies
 * (White-perspective) — true for both the Lichess-analysis path and the
 * local-Stockfish path as of the analysis.ts perspective fix.
 */
export interface PositionHighlight {
  gameId: string;
  ply: number;
  san: string;
  swingCp: number;
  opponent: string;
  createdAt: number;
  opening: string | null;
  result: Game["result"];
  moves: string;
}

export function positionHighlightsForGame(game: Game, evals: MoveEval[]): PositionHighlight[] {
  const byPly = new Map(evals.map((e) => [e.ply, e]));
  const highlights: PositionHighlight[] = [];
  for (const e of evals) {
    if (e.mover !== game.color) continue;
    if (e.cp === null) continue; // mate / unscored — skip rather than guess
    const prev = e.ply === 0 ? null : byPly.get(e.ply - 1);
    const before = e.ply === 0 ? 0 : (prev?.cp ?? null);
    if (before === null) continue;
    const swing = e.mover === "white" ? e.cp - before : before - e.cp;
    highlights.push({
      gameId: game.id,
      ply: e.ply,
      san: e.move_san,
      swingCp: Math.round(swing),
      opponent: game.opponent,
      createdAt: game.created_at,
      opening: game.opening_name,
      result: game.result,
      moves: game.moves,
    });
  }
  return highlights;
}

const BLUNDER_SWING_THRESHOLD = -150;

export function topPositionHighlights(
  gamesWithEvals: { game: Game; evals: MoveEval[] }[],
  limit = 6,
): { blunders: PositionHighlight[]; bestMoves: PositionHighlight[] } {
  const all = gamesWithEvals.flatMap(({ game, evals }) => positionHighlightsForGame(game, evals));
  const blunders = all
    .filter((h) => h.swingCp <= BLUNDER_SWING_THRESHOLD)
    .sort((a, b) => a.swingCp - b.swingCp)
    .slice(0, limit);
  const bestMoves = all
    .filter((h) => h.swingCp > 0)
    .sort((a, b) => b.swingCp - a.swingCp)
    .slice(0, limit);
  return { blunders, bestMoves };
}
