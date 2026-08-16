import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OpeningStat } from "../api";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const stat: OpeningStat = payload[0]?.payload;
  if (!stat) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div>{stat.games} games &middot; {stat.winRate}% win rate</div>
      <div style={{ color: "var(--status-good)" }}>{stat.wins} wins</div>
      <div style={{ color: "var(--text-muted)" }}>{stat.draws} draws</div>
      <div style={{ color: "var(--status-critical)" }}>{stat.losses} losses</div>
    </div>
  );
}

export function OpeningStats({ data }: { data: OpeningStat[] }) {
  if (data.length === 0) {
    return <div className="empty-state">No opening data yet.</div>;
  }
  const height = Math.max(220, data.length * 34);
  return (
    <>
      <div className="legend-row">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--status-good)" }} /> Win
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--text-muted)" }} /> Draw
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--status-critical)" }} /> Loss
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barCategoryGap={8}>
          <CartesianGrid stroke="var(--gridline)" horizontal={false} />
          <XAxis type="number" stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.4 }} />
          <Bar dataKey="wins" stackId="a" fill="var(--status-good)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="draws" stackId="a" fill="var(--text-muted)" />
          <Bar dataKey="losses" stackId="a" fill="var(--status-critical)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
