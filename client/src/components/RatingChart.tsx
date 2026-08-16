import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { RatingPoint } from "../api";

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: RatingPoint = payload[0].payload;
  const resultColor =
    p.result === "win" ? "var(--status-good)" : p.result === "loss" ? "var(--status-critical)" : "var(--text-muted)";
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{new Date(p.createdAt).toLocaleString()}</div>
      <div>
        Rating: <strong>{p.rating}</strong>
      </div>
      <div style={{ color: resultColor, textTransform: "capitalize" }}>{p.result}</div>
    </div>
  );
}

export function RatingChart({ data }: { data: RatingPoint[] }) {
  if (data.length === 0) {
    return <div className="empty-state">No rated games yet. Sync to load your history.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="createdAt"
          tickFormatter={formatDate}
          stroke="var(--baseline)"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          minTickGap={40}
        />
        <YAxis
          domain={["dataMin - 30", "dataMax + 30"]}
          stroke="var(--baseline)"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="rating"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
