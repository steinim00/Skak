import { useMemo } from "react";

const PIECE_GLYPH: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
  P: "♙",
  N: "♘",
  B: "♗",
  R: "♖",
  Q: "♕",
  K: "♔",
};

interface Cell {
  file: number;
  rank: number;
  piece: string;
}

function squareName(file: number, rank: number): string {
  return `${"abcdefgh"[file]}${8 - rank}`;
}

export function MiniBoard({
  fen,
  from,
  to,
  size = 148,
}: {
  fen: string;
  from?: string;
  to?: string;
  size?: number;
}) {
  const cells = useMemo<Cell[]>(() => {
    const rows = fen.split(" ")[0].split("/");
    const out: Cell[] = [];
    rows.forEach((row, rank) => {
      let file = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) {
          file += Number(ch);
          continue;
        }
        out.push({ file, rank, piece: ch });
        file += 1;
      }
    });
    return out;
  }, [fen]);

  const sq = size / 8;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mini-board" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, rank) =>
        Array.from({ length: 8 }).map((_, file) => {
          const light = (rank + file) % 2 === 0;
          const name = squareName(file, rank);
          const highlighted = name === from || name === to;
          return (
            <rect
              key={`${rank}-${file}`}
              x={file * sq}
              y={rank * sq}
              width={sq}
              height={sq}
              fill={highlighted ? "var(--board-highlight)" : light ? "var(--board-light)" : "var(--board-dark)"}
            />
          );
        }),
      )}
      {cells.map((c, i) => {
        const isWhitePiece = c.piece === c.piece.toUpperCase();
        return (
          <text
            key={i}
            x={c.file * sq + sq / 2}
            y={c.rank * sq + sq / 2 + sq * 0.03}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={sq * 0.74}
            fill={isWhitePiece ? "var(--board-piece-white)" : "var(--board-piece-black)"}
            stroke={isWhitePiece ? "var(--board-piece-white-outline)" : "none"}
            strokeWidth={isWhitePiece ? 0.6 : 0}
          >
            {PIECE_GLYPH[c.piece]}
          </text>
        );
      })}
    </svg>
  );
}
