import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BlunderStats as BlunderStatsT } from "../api";
import { StatTile } from "./StatTile";

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const g = payload[0]?.payload;
  if (!g) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{new Date(g.createdAt).toLocaleDateString()}</div>
      <div>{g.opening || "Unknown opening"}</div>
      <div style={{ color: "var(--status-critical)" }}>{g.blunders} blunders</div>
      <div style={{ color: "var(--status-serious)" }}>{g.mistakes} mistakes</div>
      <div style={{ color: "var(--status-warning)" }}>{g.inaccuracies} inaccuracies</div>
    </div>
  );
}

function OpeningTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{payload[0].payload.opening}</div>
      <div>{payload[0].value} blunders</div>
    </div>
  );
}

export function BlunderStats({ data }: { data: BlunderStatsT }) {
  if (data.gamesAnalyzed === 0) {
    return (
      <div className="empty-state">
        No analyzed games yet. Open a game below and click "Analyze" (uses existing Lichess analysis when available,
        otherwise runs Stockfish locally).
      </div>
    );
  }

  return (
    <>
      <div className="stat-row">
        <StatTile label="Blunders" value={data.totals.blunders} tone="critical" />
        <StatTile label="Mistakes" value={data.totals.mistakes} />
        <StatTile label="Inaccuracies" value={data.totals.inaccuracies} />
        <StatTile label="Error rate" value={`${data.totals.blunderRate}%`} sub="of analyzed moves" />
      </div>

      <h4 className="section-subtitle">Errors per game (chronological)</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.perGame} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis dataKey="gameId" tick={false} stroke="var(--baseline)" />
          <YAxis stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={32} />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.4 }} />
          <Bar dataKey="blunders" stackId="e" fill="var(--status-critical)" />
          <Bar dataKey="mistakes" stackId="e" fill="var(--status-serious)" />
          <Bar dataKey="inaccuracies" stackId="e" fill="var(--status-warning)" />
        </BarChart>
      </ResponsiveContainer>

      {data.worstOpenings.length > 0 && (
        <>
          <h4 className="section-subtitle">Openings where you blunder most</h4>
          <ResponsiveContainer width="100%" height={Math.max(160, data.worstOpenings.length * 32)}>
            <BarChart
              data={data.worstOpenings}
              layout="vertical"
              margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
            >
              <CartesianGrid stroke="var(--gridline)" horizontal={false} />
              <XAxis type="number" stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="opening"
                width={160}
                stroke="var(--baseline)"
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
              <Tooltip content={<OpeningTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.4 }} />
              <Bar dataKey="blunders" fill="var(--series-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </>
  );
}
