import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext.tsx';

export function PracticeScreen() {
  const { save } = useGame();
  const nav = useNavigate();
  const [seed, setSeed] = useState(() => String((Date.now() + 17) % 100000));
  const [ai, setAi] = useState('standard');
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Practice Table</div>
      </div>
      <p>No stakes. Each seed coins a new first player and a new pattern of closed spaces (0–6 cells).</p>
      <label>
        Seed{' '}
        <input value={seed} onChange={(e) => setSeed(e.target.value)} data-testid="seed-input" />
      </label>
      <p>
        AI{' '}
        <select value={ai} onChange={(e) => setAi(e.target.value)}>
          <option>easy</option>
          <option>standard</option>
          <option>expert</option>
        </select>
      </p>
      <p>Active deck: {save.decks.find((d) => d.id === save.activeDeckId)?.name}</p>
      <button className="btn" data-testid="practice-start" onClick={() => nav(`/play?mode=practice&seed=${Number(seed) || 1}&ai=${ai}`)}>
        Sit at the table
      </button>
    </div>
  );
}

export function DailyScreen() {
  const { save } = useGame();
  const date = new Date().toISOString().slice(0, 10);
  const seed = Number(date.replaceAll('-', ''));
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Daily Rift</div>
      </div>
      <p>Date {date}. Local best score {save.daily.date === date ? save.daily.bestScore : '—'}</p>
      <Link className="btn" to={`/play?mode=daily&seed=${seed}`}>Enter rift</Link>
    </div>
  );
}

export function WagerScreen() {
  const [ok, setOk] = useState(false);
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Wager Rites</div>
      </div>
      <p>
        If you lose, the first card of your active deck is forfeit. Safe stakes remain the default everywhere else.
      </p>
      <label>
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I understand a card may be lost.
      </label>
      <p>
        {ok ? (
          <Link className="btn" to="/play?mode=wager&wager=1&seed=88&encounter=a2-road">
            Confirm wager
          </Link>
        ) : (
          <button className="btn" disabled>
            Confirm wager
          </button>
        )}
      </p>
    </div>
  );
}

export function SettingsScreen() {
  const { save, patch, repo, setSave } = useGame();
  const s = save.settings;
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Settings</div>
      </div>
      <label><input type="checkbox" checked={s.classicOpacity} onChange={(e) => patch((x) => ({ ...x, settings: { ...x.settings, classicOpacity: e.target.checked } }))} /> Classic opacity (hide odds until Resolve)</label>
      <br />
      <label><input type="checkbox" checked={s.tacticalPreview} onChange={(e) => patch((x) => ({ ...x, settings: { ...x.settings, tacticalPreview: e.target.checked } }))} /> Tactical preview</label>
      <br />
      <label><input type="checkbox" checked={s.fastResolve} onChange={(e) => patch((x) => ({ ...x, settings: { ...x.settings, fastResolve: e.target.checked } }))} /> Fast resolve</label>
      <br />
      <label>
        Animation{' '}
        <select value={s.animationSpeed} onChange={(e) => patch((x) => ({ ...x, settings: { ...x.settings, animationSpeed: e.target.value as typeof s.animationSpeed } }))}>
          <option>slow</option>
          <option>normal</option>
          <option>fast</option>
        </select>
      </label>
      <br />
      <label><input type="checkbox" checked={s.highContrast} onChange={(e) => patch((x) => ({ ...x, settings: { ...x.settings, highContrast: e.target.checked } }))} /> High contrast</label>
      {import.meta.env.DEV && (
        <div style={{ marginTop: 16 }}>
          <h3>Developer save</h3>
          <button className="btn" onClick={() => { repo.reset(); location.reload(); }}>Reset</button>
          <button className="btn ghost" onClick={() => navigator.clipboard.writeText(repo.export())}>Export</button>
          <button
            className="btn ghost"
            onClick={async () => {
              const json = prompt('Paste save JSON');
              if (json) setSave(repo.import(json));
            }}
          >
            Import
          </button>
        </div>
      )}
      <h3>Replays</h3>
      {save.replays.length === 0 && <p>None yet.</p>}
      {save.replays.map((r, i) => (
        <p key={i}>
          <Link to={`/play?mode=practice&seed=${r.config.seed}`}>Seed {r.config.seed}</Link> · {r.createdAt}
        </p>
      ))}
    </div>
  );
}
