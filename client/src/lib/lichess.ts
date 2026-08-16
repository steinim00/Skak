/**
 * Client for the Lichess games export API, called directly from the browser.
 * Docs: https://lichess.org/api#tag/Games/operation/apiGamesUser
 * Streams NDJSON (one JSON object per game) so the structured fields
 * (clocks, opening, existing analysis) don't need PGN parsing.
 */
import type { Game } from "./types";

const LICHESS_BASE_URL = "https://lichess.org";

export const JUDGMENT_TO_CLASSIFICATION: Record<string, string> = {
  Blunder: "blunder",
  Mistake: "mistake",
  Inaccuracy: "inaccuracy",
};

export class LichessError extends Error {}

interface RawAnalysisEntry {
  eval?: number;
  mate?: number;
  best?: string;
  judgment?: { name: string };
}

export interface NormalizedGame extends Game {
  rawAnalysis: RawAnalysisEntry[] | null;
}

async function* streamNdjson(url: string, headers: Record<string, string>): AsyncGenerator<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    throw new LichessError(
      `Couldn't reach lichess.org (${e instanceof Error ? e.message : String(e)}). ` +
        "This is usually a network or browser CORS issue, not a bug in the app.",
    );
  }
  if (res.status === 429) {
    throw new LichessError("Rate limited by Lichess (429). Wait a minute and retry.");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new LichessError(`Lichess API error ${res.status}: ${body.slice(0, 500)}`);
  }
  if (!res.body) {
    throw new LichessError("Streaming not supported by this browser.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) yield JSON.parse(line);
    }
  }
  const rest = buffer.trim();
  if (rest) yield JSON.parse(rest);
}

export async function* fetchGames(
  username: string,
  perfTypes: string[],
  opts: { token?: string; sinceMs?: number; maxGames?: number } = {},
): AsyncGenerator<NormalizedGame> {
  const url = new URL(`${LICHESS_BASE_URL}/api/games/user/${encodeURIComponent(username)}`);
  url.searchParams.set("perfType", perfTypes.join(","));
  url.searchParams.set("evals", "true");
  url.searchParams.set("opening", "true");
  url.searchParams.set("clocks", "true");
  url.searchParams.set("rated", "true");
  url.searchParams.set("sort", "dateDesc");
  if (opts.sinceMs) url.searchParams.set("since", String(opts.sinceMs));
  if (opts.maxGames) url.searchParams.set("max", String(opts.maxGames));

  const headers: Record<string, string> = { Accept: "application/x-ndjson" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  for await (const raw of streamNdjson(url.toString(), headers)) {
    const normalized = normalizeGame(raw, username);
    if (normalized) yield normalized;
  }
}

export function normalizeGame(raw: any, username: string): NormalizedGame | null {
  const players = raw.players ?? {};
  const white = players.white ?? {};
  const black = players.black ?? {};

  const usernameLower = username.toLowerCase();
  const whiteId = (white.user?.id ?? "").toLowerCase();
  const blackId = (black.user?.id ?? "").toLowerCase();

  let color: "white" | "black";
  let me: any;
  let opponent: any;
  if (usernameLower === whiteId) {
    color = "white";
    me = white;
    opponent = black;
  } else if (usernameLower === blackId) {
    color = "black";
    me = black;
    opponent = white;
  } else {
    return null;
  }

  const winner = raw.winner as string | undefined;
  const status = raw.status as string;
  let result: Game["result"];
  if (winner == null) {
    result = status === "draw" || status === "stalemate" ? "draw" : "other";
  } else {
    result = winner === color ? "win" : "loss";
  }

  const opponentName: string =
    opponent.user?.name ?? (opponent.aiLevel ? `Stockfish level ${opponent.aiLevel}` : "Anonymous");

  const opening = raw.opening ?? {};
  const clock = raw.clock ?? {};
  const clocks: number[] | null = raw.clocks ?? null;
  const analysis: RawAnalysisEntry[] | null = raw.analysis ?? null;

  return {
    id: raw.id,
    username,
    perf: raw.perf ?? raw.speed ?? "",
    speed: raw.speed ?? "",
    rated: Boolean(raw.rated),
    created_at: raw.createdAt ?? 0,
    status,
    color,
    result,
    user_rating: me.rating ?? null,
    user_rating_diff: me.ratingDiff ?? null,
    opponent: opponentName,
    opponent_rating: opponent.rating ?? null,
    opening_name: opening.name ?? null,
    opening_eco: opening.eco ?? null,
    moves: raw.moves ?? "",
    clocks,
    clock_initial: clock.initial ?? null,
    clock_increment: clock.increment ?? null,
    pgn: raw.pgn ?? null,
    lichess_analyzed: analysis ? 1 : 0,
    local_analyzed: 0,
    rawAnalysis: analysis,
  };
}

export function analysisToMoveEvals(gameId: string, movesSan: string[], analysis: RawAnalysisEntry[]) {
  // Mirror Python's zip() truncation: only produce rows for plies actually covered by analysis.
  return movesSan.slice(0, analysis.length).map((san, ply) => {
    const entry = analysis[ply];
    const mover: "white" | "black" = ply % 2 === 0 ? "white" : "black";
    const judgment = entry?.judgment?.name;
    return {
      game_id: gameId,
      ply,
      mover,
      move_san: san,
      cp: entry?.eval ?? null,
      mate: entry?.mate ?? null,
      best_move: entry?.best ?? null,
      classification: judgment ? JUDGMENT_TO_CLASSIFICATION[judgment] ?? null : null,
      clock_seconds: null,
    };
  });
}
