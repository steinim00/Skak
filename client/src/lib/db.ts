/** IndexedDB storage for games and move evaluations — the client-side
 * replacement for the old server's SQLite database. */
import type { Game, MoveEval } from "./types";

const DB_NAME = "skak";
const DB_VERSION = 1;

interface SyncState {
  username: string;
  lastSyncedAt: number;
  newestGameCreatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("games")) {
        const games = db.createObjectStore("games", { keyPath: "id" });
        games.createIndex("username_perf", ["username", "perf"], { unique: false });
      }
      if (!db.objectStoreNames.contains("moveEvals")) {
        const evals = db.createObjectStore("moveEvals", { keyPath: ["game_id", "ply"] });
        evals.createIndex("game_id", "game_id", { unique: false });
      }
      if (!db.objectStoreNames.contains("syncState")) {
        db.createObjectStore("syncState", { keyPath: "username" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

export async function putGame(game: Game): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("games", "readwrite");
  tx.objectStore("games").put(game);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getGamesForUserPerf(username: string, perf: string): Promise<Game[]> {
  const db = await getDb();
  const tx = db.transaction("games", "readonly");
  const index = tx.objectStore("games").index("username_perf");
  const results = await promisify(index.getAll(IDBKeyRange.only([username, perf])));
  return results.sort((a, b) => b.created_at - a.created_at);
}

export async function getGame(id: string): Promise<Game | undefined> {
  const db = await getDb();
  const tx = db.transaction("games", "readonly");
  return promisify(tx.objectStore("games").get(id));
}

export async function getMoveEvals(gameId: string): Promise<MoveEval[]> {
  const db = await getDb();
  const tx = db.transaction("moveEvals", "readonly");
  const index = tx.objectStore("moveEvals").index("game_id");
  const results = await promisify(index.getAll(IDBKeyRange.only(gameId)));
  return results.sort((a, b) => a.ply - b.ply);
}

export async function saveMoveEvals(
  gameId: string,
  evals: MoveEval[],
  analyzedFlag: "lichess_analyzed" | "local_analyzed",
): Promise<void> {
  const db = await getDb();

  // Precompute summary counts on the game record for cheap aggregate stats.
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  const game = await getGame(gameId);
  for (const e of evals) {
    if (e.mover !== game?.color) continue;
    if (e.classification === "blunder") blunders++;
    else if (e.classification === "mistake") mistakes++;
    else if (e.classification === "inaccuracy") inaccuracies++;
  }

  const tx = db.transaction(["moveEvals", "games"], "readwrite");
  const evalStore = tx.objectStore("moveEvals");
  const existing = await promisify(evalStore.index("game_id").getAllKeys(IDBKeyRange.only(gameId)));
  for (const key of existing) evalStore.delete(key as IDBValidKey);
  for (const e of evals) evalStore.put(e);

  if (game) {
    const movesAnalyzed = evals.filter((e) => e.mover === game.color).length;
    tx.objectStore("games").put({ ...game, [analyzedFlag]: 1, blunders, mistakes, inaccuracies, movesAnalyzed });
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncState(username: string): Promise<SyncState | undefined> {
  const db = await getDb();
  const tx = db.transaction("syncState", "readonly");
  return promisify(tx.objectStore("syncState").get(username));
}

export async function setSyncState(username: string, newestGameCreatedAt: number): Promise<void> {
  const db = await getDb();
  const existing = await getSyncState(username);
  const tx = db.transaction("syncState", "readwrite");
  tx.objectStore("syncState").put({
    username,
    lastSyncedAt: Date.now(),
    newestGameCreatedAt: Math.max(existing?.newestGameCreatedAt ?? 0, newestGameCreatedAt),
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
