import { useEffect, useState } from "react";
import {
  api,
  type BlunderStats as BlunderStatsT,
  type GameSummary,
  type OpeningStat,
  type Perf,
  type PositionHighlight,
  type RatingPoint,
  type TimeUsage,
} from "./api";
import { RatingChart } from "./components/RatingChart";
import { OpeningStats } from "./components/OpeningStats";
import { TimeUsageChart } from "./components/TimeUsageChart";
import { BlunderStats } from "./components/BlunderStats";
import { PositionGallery } from "./components/PositionGallery";
import { GameList } from "./components/GameList";
import { GameDetail } from "./components/GameDetail";
import { SyncBar } from "./components/SyncBar";
import { StatTile } from "./components/StatTile";
import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem("skak.username") || "");
  const [perf, setPerf] = useState<Perf>("bullet");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [games, setGames] = useState<GameSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [rating, setRating] = useState<RatingPoint[]>([]);
  const [openings, setOpenings] = useState<OpeningStat[]>([]);
  const [timeUsage, setTimeUsage] = useState<TimeUsage | null>(null);
  const [blunders, setBlunders] = useState<BlunderStatsT | null>(null);
  const [highlights, setHighlights] = useState<{ blunders: PositionHighlight[]; bestMoves: PositionHighlight[] } | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("skak.username", username);
  }, [username]);

  function refreshAll() {
    if (!username) return;
    setError(null);
    api.games(username, perf).then((r) => {
      setGames(r.games);
      setTotal(r.total);
    }).catch((e) => setError(String(e)));
    api.ratingHistory(username, perf).then((r) => setRating(r.data)).catch((e) => setError(String(e)));
    api.openings(username, perf).then((r) => setOpenings(r.data)).catch((e) => setError(String(e)));
    api.timeUsage(username, perf).then(setTimeUsage).catch((e) => setError(String(e)));
    api.blunders(username, perf).then(setBlunders).catch((e) => setError(String(e)));
    api.positionHighlights(username, perf).then(setHighlights).catch((e) => setError(String(e)));
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, perf]);

  async function handleSync(full: boolean) {
    if (!username) return;
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const r = await api.sync(username, { full });
      setSyncMessage(`Fetched ${r.fetched} new game${r.fetched === 1 ? "" : "s"} for ${r.username}.`);
      refreshAll();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  const wins = games.filter((g) => g.result === "win").length;
  const losses = games.filter((g) => g.result === "loss").length;
  const draws = games.filter((g) => g.result === "draw").length;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <div>
            <h1>Skak</h1>
            <p className="subtitle">Lichess bullet &amp; blitz game analyzer</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <SyncBar
        username={username}
        onUsernameChange={setUsername}
        perf={perf}
        onPerfChange={setPerf}
        onSync={handleSync}
        syncing={syncing}
        syncMessage={syncMessage}
      />

      {error && <div className="error-banner">{error}</div>}

      {!username && <div className="empty-state large">Enter your Lichess username above and hit Sync to get started.</div>}

      {username && (
        <>
          <div className="stat-row">
            <StatTile label="Games loaded" value={total} sub={`${perf}`} />
            <StatTile label="Wins" value={wins} tone="good" />
            <StatTile label="Losses" value={losses} tone="critical" />
            <StatTile label="Draws" value={draws} />
          </div>

          <section className="card">
            <h2>Rating trend</h2>
            <RatingChart data={rating} />
          </section>

          <section className="card">
            <h2>Openings</h2>
            <OpeningStats data={openings} />
          </section>

          <section className="card">
            <h2>Time usage</h2>
            {timeUsage && <TimeUsageChart data={timeUsage} />}
          </section>

          <section className="card">
            <h2>Blunders &amp; mistakes</h2>
            {blunders && <BlunderStats data={blunders} />}
            {highlights && (
              <>
                <PositionGallery
                  title="Positions where you blundered"
                  subtitle="Your biggest single drops in evaluation — the actual position, not just a phase label."
                  highlights={highlights.blunders}
                  onSelect={setSelectedGame}
                />
                <PositionGallery
                  title="Positions you handled well"
                  subtitle="Moves that swung the position most in your favor."
                  highlights={highlights.bestMoves}
                  onSelect={setSelectedGame}
                />
              </>
            )}
          </section>

          <section className="card">
            <h2>Games</h2>
            <GameList games={games} onSelect={setSelectedGame} />
          </section>
        </>
      )}

      {selectedGame && <GameDetail gameId={selectedGame} onClose={() => setSelectedGame(null)} />}
    </div>
  );
}
