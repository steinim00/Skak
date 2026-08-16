import { useState } from "react";
import type { Perf } from "../api";

interface Props {
  username: string;
  onUsernameChange: (u: string) => void;
  perf: Perf;
  onPerfChange: (p: Perf) => void;
  onSync: (full: boolean) => void;
  syncing: boolean;
  syncMessage: string | null;
  stockfishAvailable: boolean | null;
}

export function SyncBar({ username, onUsernameChange, perf, onPerfChange, onSync, syncing, syncMessage, stockfishAvailable }: Props) {
  const [draft, setDraft] = useState(username);

  return (
    <div className="sync-bar">
      <div className="sync-bar-row">
        <input
          className="username-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Lichess username"
        />
        <button className="btn" onClick={() => onUsernameChange(draft)} disabled={!draft || draft === username}>
          Set
        </button>
        <button className="btn btn-primary" onClick={() => onSync(false)} disabled={syncing || !username}>
          {syncing ? "Syncing…" : "Sync new games"}
        </button>
        <button className="btn-link" onClick={() => onSync(true)} disabled={syncing || !username}>
          Full resync
        </button>
        <div className="perf-toggle">
          <button className={perf === "bullet" ? "active" : ""} onClick={() => onPerfChange("bullet")}>
            Bullet
          </button>
          <button className={perf === "blitz" ? "active" : ""} onClick={() => onPerfChange("blitz")}>
            Blitz
          </button>
        </div>
      </div>
      {syncMessage && <div className="sync-message">{syncMessage}</div>}
      {stockfishAvailable === false && (
        <div className="warning-banner">
          Stockfish isn't installed on the server — on-demand analysis of games without existing Lichess analysis
          won't work until you install it (e.g. <code>apt-get install stockfish</code>).
        </div>
      )}
    </div>
  );
}
