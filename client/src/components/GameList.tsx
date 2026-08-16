import type { GameSummary } from "../api";

const RESULT_COLOR: Record<string, string> = {
  win: "var(--status-good)",
  loss: "var(--status-critical)",
  draw: "var(--text-muted)",
};

export function GameList({ games, onSelect }: { games: GameSummary[]; onSelect: (id: string) => void }) {
  if (games.length === 0) {
    return <div className="empty-state">No games synced yet.</div>;
  }
  return (
    <table className="game-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Color</th>
          <th>Result</th>
          <th>Rating</th>
          <th>Opponent</th>
          <th>Opening</th>
          <th>Analyzed</th>
        </tr>
      </thead>
      <tbody>
        {games.map((g) => (
          <tr key={g.id} onClick={() => onSelect(g.id)} className="game-row">
            <td>{new Date(g.created_at).toLocaleDateString()}</td>
            <td>{g.color}</td>
            <td style={{ color: RESULT_COLOR[g.result] || "var(--text-muted)", textTransform: "capitalize" }}>
              {g.result}
            </td>
            <td>
              {g.user_rating}
              {g.user_rating_diff != null && (
                <span style={{ color: g.user_rating_diff >= 0 ? "var(--status-good)" : "var(--status-critical)" }}>
                  {" "}
                  {g.user_rating_diff >= 0 ? `+${g.user_rating_diff}` : g.user_rating_diff}
                </span>
              )}
            </td>
            <td>{g.opponent}</td>
            <td className="muted">{g.opening_name || "—"}</td>
            <td>{g.lichess_analyzed || g.local_analyzed ? "✓" : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
