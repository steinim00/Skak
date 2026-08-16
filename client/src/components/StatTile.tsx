interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "good" | "critical";
}

export function StatTile({ label, value, sub, tone = "neutral" }: Props) {
  const color =
    tone === "good" ? "var(--delta-good-text)" : tone === "critical" ? "var(--status-critical)" : "var(--text-primary)";
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value" style={{ color }}>
        {value}
      </div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}
