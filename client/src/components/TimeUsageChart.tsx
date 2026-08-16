import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeUsage } from "../api";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">Move {label}</div>
      <div>{payload[0].value}s avg</div>
    </div>
  );
}

export function TimeUsageChart({ data }: { data: TimeUsage }) {
  if (data.curve.length === 0) {
    return <div className="empty-state">No clock data yet.</div>;
  }
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data.curve} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="timeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="moveNumber"
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            label={{ value: "Move number", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 11 }}
          />
          <YAxis
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            width={48}
            label={{ value: "seconds", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="avgSeconds" stroke="var(--series-1)" strokeWidth={2} fill="url(#timeFill)" />
        </AreaChart>
      </ResponsiveContainer>
      <div className="stat-row">
        <StatSmall label="Time pressure moves" value={`${data.timePressureRate}%`} />
        <StatSmall label="Games lost on time" value={data.flagLosses} />
        <StatSmall label="Games considered" value={data.gamesConsidered} />
      </div>
    </>
  );
}

function StatSmall({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-small">
      <div className="stat-small-value">{value}</div>
      <div className="stat-small-label">{label}</div>
    </div>
  );
}
