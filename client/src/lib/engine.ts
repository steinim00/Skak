/** Thin UCI wrapper around the WASM Stockfish build running in a Web
 * Worker (public/engine/stockfish.js, single-threaded "lite" build — no
 * SharedArrayBuffer/cross-origin-isolation needed, so it works unmodified
 * on GitHub Pages). */

export interface PositionEval {
  cp: number | null;
  mate: number | null;
  bestMoveUci: string | null;
}

export class StockfishEngine {
  private worker: Worker;
  private ready: Promise<void>;

  constructor() {
    this.worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish.js`);
    this.ready = new Promise((resolve) => {
      const onMessage = (e: MessageEvent<string>) => {
        if (e.data === "uciok") {
          this.worker.postMessage("isready");
        } else if (e.data === "readyok") {
          this.worker.removeEventListener("message", onMessage);
          resolve();
        }
      };
      this.worker.addEventListener("message", onMessage);
      this.worker.postMessage("uci");
    });
  }

  async analyzePosition(fen: string, depth: number): Promise<PositionEval> {
    await this.ready;
    return new Promise((resolve) => {
      const last: PositionEval = { cp: null, mate: null, bestMoveUci: null };
      const onMessage = (e: MessageEvent<string>) => {
        const line = e.data;
        if (line.startsWith("info") && line.includes(" pv ")) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (mateMatch) {
            last.mate = parseInt(mateMatch[1], 10);
            last.cp = null;
          } else if (cpMatch) {
            last.cp = parseInt(cpMatch[1], 10);
            last.mate = null;
          }
          const pvMatch = line.match(/ pv (\S+)/);
          if (pvMatch) last.bestMoveUci = pvMatch[1];
        } else if (line.startsWith("bestmove")) {
          this.worker.removeEventListener("message", onMessage);
          const parts = line.split(" ");
          if (!last.bestMoveUci && parts[1] && parts[1] !== "(none)") last.bestMoveUci = parts[1];
          resolve(last);
        }
      };
      this.worker.addEventListener("message", onMessage);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
