import React from 'react';
import { Link } from 'react-router-dom';
import { ENCOUNTERS } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';

const ACTS = ['Ember Market', 'Glasswater Road', 'The Clockwork Archive', 'The Black Lantern Rite'];

export function StoryScreen() {
  const { save } = useGame();
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">The Ashfall Circuit</div>
      </div>
      {([1, 2, 3, 4] as const).map((act) => (
        <section key={act}>
          <h2 style={{ fontFamily: 'var(--font)', color: 'var(--gold)' }}>
            Act {act} — {ACTS[act - 1]}
          </h2>
          {ENCOUNTERS.filter((e) => e.act === act).map((e) => {
            const unlocked =
              e.id === 't1' || save.campaign.completed.includes(e.id) || save.campaign.nextId === e.id ||
              ENCOUNTERS.findIndex((x) => x.id === e.id) <= save.campaign.completed.length;
            return (
              <div key={e.id} className="mode-card" style={{ marginBottom: 8, opacity: unlocked ? 1 : 0.45 }}>
                <h3 style={{ margin: '0 0 0.25rem' }}>{e.title}</h3>
                <p>
                  {e.opponentName} · {e.tactic}
                </p>
                {unlocked && (
                  <Link className="btn" to={`/play?mode=story&encounter=${e.id}&seed=${40 + e.index}`} data-testid={`encounter-${e.id}`}>
                    Enter
                  </Link>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
