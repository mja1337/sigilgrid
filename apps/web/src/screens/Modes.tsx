import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COSMETICS, WAGER_RIVALS, encounterById } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { dailyChallenge, todayKey, visibleDailyStreak } from '../daily.ts';
import { DeckReadout } from '../components/DeckReadout.tsx';
import { wagerRivalUnlocked } from '../progress.ts';

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
      <DeckReadout testId="practice-deck-banner" />
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
  const date = todayKey();
  const challenge = dailyChallenge(date);
  const streak = visibleDailyStreak(save.daily, date);
  const [shareMsg, setShareMsg] = useState('');

  async function shareChallenge() {
    const text = `Sigil Grid Daily Rift · ${challenge.date} · ${challenge.name} · seed ${challenge.seed}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Sigil Grid Daily Rift', text });
      else {
        await navigator.clipboard.writeText(text);
        setShareMsg('Challenge copied.');
      }
    } catch {
      setShareMsg('Sharing cancelled.');
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Daily Rift</div>
      </div>
      <section className="daily-card" data-testid="daily-challenge">
        <p className="muted">{date} · seed {challenge.seed}</p>
        <h2>{challenge.name}</h2>
        <p>{challenge.description}</p>
        <dl className="daily-stats">
          <div><dt>Opponent</dt><dd>{challenge.ai}</dd></div>
          <div><dt>Closed spaces</dt><dd>{challenge.blockedCells.length}</dd></div>
          <div><dt>Best today</dt><dd>{save.daily.date === date ? save.daily.bestScore ?? '—' : '—'}</dd></div>
          <div><dt>Streak</dt><dd>{streak} {streak === 1 ? 'day' : 'days'}</dd></div>
        </dl>
        <p className="muted">First win today awards one sealed pack.</p>
        <div className="daily-actions">
          <Link className="btn" to={`/play?mode=daily&date=${date}&seed=${challenge.seed}`}>
            Enter rift
          </Link>
          <button className="btn ghost" type="button" onClick={() => void shareChallenge()}>
            Share challenge
          </button>
        </div>
        {shareMsg && <p role="status">{shareMsg}</p>}
      </section>
    </div>
  );
}

export function WagerScreen() {
  const { save } = useGame();
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [seed] = useState(() => String(Date.now() % 100000));
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Wager Rites</div>
      </div>
      <p>
        Named rivals keep whatever they win from you and are very likely to play it next time,
        giving you a chance to reclaim it. Safe stakes remain the default everywhere else.
      </p>
      <DeckReadout testId="wager-deck-banner" />
      {WAGER_RIVALS.map((rival) => {
        const encounter = encounterById(rival.encounterId);
        if (!encounter) return null;
        const unlocked = wagerRivalUnlocked(save, rival.unlockAfter);
        const held = save.opponentHoldings[rival.encounterId] ?? [];
        const confirmed = ok[rival.encounterId] === true;
        return (
          <div
            key={rival.encounterId}
            className="mode-card"
            style={{ marginBottom: 8, opacity: unlocked ? 1 : 0.45 }}
            data-testid={`wager-rival-${rival.encounterId}`}
          >
            <h3 style={{ margin: '0 0 0.25rem' }}>{encounter.opponentName}</h3>
            <p>
              {encounter.title} · {encounter.tactic}
            </p>
            <p className="muted">{unlocked ? rival.blurb : `Unlocks after ${rival.unlockAfter}.`}</p>
            {held.length > 0 && (
              <p data-testid={`wager-held-${rival.encounterId}`}>
                They currently hold {held.length} of your {held.length === 1 ? 'card' : 'cards'}:{' '}
                {held.map((card) => card.displayName).join(', ')}.
              </p>
            )}
            {unlocked && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setOk((cur) => ({ ...cur, [rival.encounterId]: e.target.checked }))}
                  />{' '}
                  I understand a card may be lost to {encounter.opponentName}.
                </label>
                <p>
                  {confirmed ? (
                    <Link
                      className="btn"
                      to={`/play?mode=wager&wager=1&seed=${seed}&encounter=${rival.encounterId}`}
                    >
                      Confirm wager
                    </Link>
                  ) : (
                    <button className="btn" disabled>
                      Confirm wager
                    </button>
                  )}
                </p>
              </>
            )}
          </div>
        );
      })}
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
      <div className="replay-list">
        {[...save.replays].reverse().map((r, reverseIndex) => {
          const index = save.replays.length - 1 - reverseIndex;
          return (
            <Link className="replay-row" to={`/replay/${index}`} key={`${r.createdAt}-${index}`}>
              <span>
                <strong>{r.label ?? `Seed ${r.config.seed}`}</strong>
                <small>{r.mode ?? 'match'} · seed {r.config.seed}</small>
              </span>
              <span>{r.result ?? 'watch'} →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
