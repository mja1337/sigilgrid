import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COSMETICS } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';

export function PracticeScreen() {
  const { save, patch } = useGame();
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
      <p>
        Deck{' '}
        <select
          aria-label="Practice deck"
          value={save.activeDeckId}
          onChange={(e) => patch((s) => ({ ...s, activeDeckId: e.target.value }))}
        >
          {save.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [saveMsg, setSaveMsg] = useState('');

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportSave() {
    const json = repo.export();
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `sigilgrid-save-${stamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSaveMsg('Save downloaded.');
    } catch {
      // Some embedded browsers block programmatic downloads; the clipboard
      // still gets the player their data.
      void navigator.clipboard?.writeText(json);
      setSaveMsg('Download blocked — save copied to clipboard instead.');
    }
  }

  function loadJson(json: string) {
    if (!confirm('Loading a save replaces your current collection, decks and campaign progress. Continue?')) {
      return;
    }
    try {
      setSave(repo.import(json));
      setSaveMsg('Save loaded.');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Could not read that save.');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    loadJson(await file.text());
  }

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
      <p>
        Card frame{' '}
        <select
          aria-label="Card frame"
          value={save.frameId}
          onChange={(e) => patch((x) => ({ ...x, frameId: e.target.value }))}
        >
          {COSMETICS.filter((c) => c.kind === 'frame' && save.unlockedCosmetics.includes(c.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </p>
      <p>
        Card back{' '}
        <select
          aria-label="Card back"
          value={save.backId}
          onChange={(e) => patch((x) => ({ ...x, backId: e.target.value }))}
        >
          {COSMETICS.filter((c) => c.kind === 'back' && save.unlockedCosmetics.includes(c.id)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </p>
      <h3>Your save</h3>
      <p>
        Progress lives in this browser only. Clearing site data erases it, and it does not follow
        you to another device — export a copy to keep it safe.
      </p>
      <p>
        <button className="btn" data-testid="save-export" onClick={exportSave}>
          Export save
        </button>{' '}
        <button className="btn ghost" data-testid="save-import" onClick={() => fileRef.current?.click()}>
          Import save
        </button>
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        style={{ display: 'none' }}
        data-testid="save-file"
      />
      <p>
        <button
          className="btn ghost"
          data-testid="save-paste"
          onClick={() => {
            const json = prompt('Paste save JSON');
            if (json) loadJson(json);
          }}
        >
          Paste save text instead
        </button>
      </p>
      {saveMsg && (
        <p role="status" data-testid="save-status">
          {saveMsg}
        </p>
      )}
      {import.meta.env.DEV && (
        <div style={{ marginTop: 16 }}>
          <h3>Developer</h3>
          <button className="btn ghost" onClick={() => { repo.reset(); location.reload(); }}>Reset save</button>
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
