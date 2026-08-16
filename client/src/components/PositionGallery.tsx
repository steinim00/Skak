import { useMemo } from "react";
import type { PositionHighlight } from "../api";
import { positionForHighlight } from "../lib/board";
import { MiniBoard } from "./MiniBoard";

function PositionCard({ highlight, onSelect }: { highlight: PositionHighlight; onSelect: (id: string) => void }) {
  const { fen, from, to } = useMemo(
    () => positionForHighlight(highlight.moves, highlight.ply),
    [highlight.moves, highlight.ply],
  );
  const swing = highlight.swingCp / 100;
  const swingLabel = `${swing > 0 ? "+" : ""}${swing.toFixed(1)}`;

  return (
    <button type="button" className="position-card" onClick={() => onSelect(highlight.gameId)}>
      <MiniBoard fen={fen} from={from} to={to} />
      <div className="position-card-label">
        <span className={swing < 0 ? "swing-bad" : "swing-good"}>{swingLabel}</span>
        <span className="position-card-move">{highlight.san}</span>
      </div>
      <div className="position-card-meta">
        vs {highlight.opponent} &middot; {highlight.opening ?? "Unknown opening"}
      </div>
    </button>
  );
}

export function PositionGallery({
  title,
  subtitle,
  highlights,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  highlights: PositionHighlight[];
  onSelect: (id: string) => void;
}) {
  if (!highlights.length) return null;
  return (
    <>
      <h4 className="section-subtitle">{title}</h4>
      {subtitle && <p className="muted" style={{ margin: "0 0 10px", fontSize: 12.5 }}>{subtitle}</p>}
      <div className="position-gallery">
        {highlights.map((h) => (
          <PositionCard key={`${h.gameId}-${h.ply}`} highlight={h} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}
