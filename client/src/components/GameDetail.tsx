import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type GameDetail as GameDetailT, type MoveEval } from "../api";

const CLASS_COLOR: Record<string, string> = {
  blunder: "var(--status-critical)",
  mistake: "var(--status-serious)",
  inaccuracy: "var(--status-warning)",
  best: "var(--status-good)",
};

const CLASS_LABEL: Record<string, string> = {
  blunder: "Blunder",
  mistake: "Mistake",
  inaccuracy: "Inaccuracy",
  best: "Best",
  good: "Good",
};

function evalToCp(e: MoveEval): number {
  if (e.mate !== null && e.mate !== undefined) return e.mate > 0 ? 1000 : -1000;
  return e.cp ?? 0;
}

function EvalTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const e: MoveEval = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">
        {Math.floor(e.ply / 2) + 1}
        {e.mover === "white" ? "." : "..."} {e.move_san}
      </div>
      <div>{e.mate ? `Mate in ${Math.abs(e.mate)}` : `${(evalToCp(e) / 100).toFixed(2)}`}</div>
      {e.classification && CLASS_LABEL[e.classification] && (
        <div style={{ color: CLASS_COLOR[e.classification] || "var(--text-muted)" }}>
          {CLASS_LABEL[e.classification]}
        </div>
      )}
    </div>
  );
}

export function GameDetail({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const [game, setGame] = useState<GameDetailT | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .game(gameId)
      .then(setGame)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [gameId]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      await api.analyzeGame(gameId);
      const fresh = await api.game(gameId);
      setGame(fresh);
    } catch (e) {
      setError(String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const isAnalyzed = game && (game.lichess_analyzed || game.local_analyzed);
  const chartData = game?.moveEvals ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        {loading && <div className="empty-state">Loading…</div>}
        {error && <div className="error-banner">{error}</div>}
        {game && (
          <>
            <h3>
              {game.color === "white" ? "White" : "Black"} vs {game.opponent} &middot;{" "}
              <span className={`result-${game.result}`}>{game.result}</span>
            </h3>
            <div className="game-meta">
              {new Date(game.created_at).toLocaleString()} &middot; {game.opening_name || "Unknown opening"} &middot;{" "}
              rating {game.user_rating}
              {game.user_rating_diff != null && (game.user_rating_diff >= 0 ? ` (+${game.user_rating_diff})` : ` (${game.user_rating_diff})`)}
            </div>

            {!isAnalyzed && (
              <button className="btn" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "Analyzing with Stockfish…" : "Analyze this game"}
              </button>
            )}

            {chartData.length > 0 && (
              <>
                <h4 className="section-subtitle">Evaluation</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                    <defs>
                      <linearGradient id="evalPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="evalNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--status-critical)" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="var(--status-critical)" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--gridline)" vertical={false} />
                    <XAxis dataKey="ply" hide />
                    <YAxis hide domain={[-800, 800]} />
                    <ReferenceLine y={0} stroke="var(--baseline)" />
                    <Tooltip content={<EvalTooltip />} />
                    <Area
                      type="monotone"
                      dataKey={(e: MoveEval) => evalToCp(e)}
                      stroke="var(--series-1)"
                      strokeWidth={1.5}
                      fill="url(#evalPos)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}

            <h4 className="section-subtitle">Moves</h4>
            <div className="move-list">
              {chartData.length > 0
                ? chartData.map((e) => (
                    <span key={e.ply} className="move-chip" style={e.classification && CLASS_COLOR[e.classification] ? { color: CLASS_COLOR[e.classification] } : undefined}>
                      {e.mover === "white" ? `${Math.floor(e.ply / 2) + 1}.` : ""}
                      {e.move_san}
                    </span>
                  ))
                : game.moves.split(" ").map((san, i) => (
                    <span key={i} className="move-chip">
                      {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}
                      {san}
                    </span>
                  ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
