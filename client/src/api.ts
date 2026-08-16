/**
 * Client-only data layer: fetches from Lichess directly, stores in
 * IndexedDB, and runs Stockfish in a Web Worker — no backend server.
 * Keeps the same shape as the old HTTP-backed api.ts so components don't
 * need to change.
 */
import * as db from "./lib/db";
import { analyzeMovesSan } from "./lib/analysis";
import { analysisToMoveEvals, fetchGames } from "./lib/lichess";
import * as statsLib from "./lib/stats";
import type { Game, MoveEval, Perf } from "./lib/types";

export type { Perf, MoveEval } from "./lib/types";
export type { RatingPoint, OpeningStat, TimeUsage, BlunderGame, BlunderStats, PositionHighlight } from "./lib/stats";

export type GameSummary = Game;
export interface GameDetail extends Game {
  moveEvals: MoveEval[];
}

const STOCKFISH_DEPTH = 14;

export const api = {
  status: async () => ({ defaultUsername: "", stockfishAvailable: true }),

  sync: async (username: string, opts: { full?: boolean } = {}) => {
    const sinceMs = opts.full ? undefined : (await db.getSyncState(username))?.newestGameCreatedAt;
    let fetched = 0;
    let newest = sinceMs ?? 0;

    for await (const game of fetchGames(username, ["bullet", "blitz"], {
      sinceMs: sinceMs ? sinceMs + 1 : undefined,
      maxGames: 300,
    })) {
      const { rawAnalysis, ...gameRecord } = game;
      await db.putGame(gameRecord);
      fetched += 1;
      newest = Math.max(newest, gameRecord.created_at);

      if (rawAnalysis) {
        const movesSan = gameRecord.moves ? gameRecord.moves.split(" ") : [];
        const evals = analysisToMoveEvals(gameRecord.id, movesSan, rawAnalysis) as MoveEval[];
        await db.saveMoveEvals(gameRecord.id, evals, "lichess_analyzed");
      }
    }

    if (fetched && newest) await db.setSyncState(username, newest);
    return { username, fetched };
  },

  games: async (username: string, perf: Perf, limit = 50, offset = 0) => {
    const all = await db.getGamesForUserPerf(username, perf);
    return { total: all.length, games: all.slice(offset, offset + limit) };
  },

  game: async (id: string): Promise<GameDetail> => {
    const game = await db.getGame(id);
    if (!game) throw new Error(`Game ${id} not found locally — try syncing again.`);
    const moveEvals = await db.getMoveEvals(id);
    return { ...game, moveEvals };
  },

  analyzeGame: async (id: string, onProgress?: (done: number, total: number) => void) => {
    const game = await db.getGame(id);
    if (!game) throw new Error(`Game ${id} not found locally.`);
    if (game.lichess_analyzed || game.local_analyzed) {
      return { gameId: id, source: "cached", moveEvals: await db.getMoveEvals(id) };
    }
    const movesSan = game.moves ? game.moves.split(" ") : [];
    const evalsWithoutGameId = await analyzeMovesSan(movesSan, game.clocks, STOCKFISH_DEPTH, onProgress);
    const evals: MoveEval[] = evalsWithoutGameId.map((e) => ({ ...e, game_id: id }));
    await db.saveMoveEvals(id, evals, "local_analyzed");
    return { gameId: id, source: "stockfish", moveEvals: evals };
  },

  ratingHistory: async (username: string, perf: Perf) => ({
    data: statsLib.ratingHistory(await db.getGamesForUserPerf(username, perf)),
  }),

  openings: async (username: string, perf: Perf) => ({
    data: statsLib.openingStats(await db.getGamesForUserPerf(username, perf)),
  }),

  timeUsage: async (username: string, perf: Perf) =>
    statsLib.timeUsage(await db.getGamesForUserPerf(username, perf)),

  blunders: async (username: string, perf: Perf) =>
    statsLib.blunderStats(await db.getGamesForUserPerf(username, perf)),

  /** Actual board positions behind your biggest blunders and your best
   * swings, instead of a vague phase-of-the-game label. */
  positionHighlights: async (username: string, perf: Perf, limit = 6) => {
    const games = (await db.getGamesForUserPerf(username, perf)).filter(
      (g) => g.lichess_analyzed || g.local_analyzed,
    );
    const gamesWithEvals = await Promise.all(
      games.map(async (game) => ({ game, evals: await db.getMoveEvals(game.id) })),
    );
    return statsLib.topPositionHighlights(gamesWithEvals, limit);
  },
};
