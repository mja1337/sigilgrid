import React from 'react';
import { Link } from 'react-router-dom';
import { ENCOUNTERS } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { activeDeckSummary } from '../progress.ts';

const ACTS = ['Ember Market', 'Glasswater Road', 'The Clockwork Archive', 'The Black Lantern Rite'];

export function StoryScreen() {
  const { save } = useGame();
  const deck = activeDeckSummary(save);
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">The Ashfall Circuit</div>
      </div>
      <p className="deck-banner" data-testid="story-deck-banner">
        Taking in <strong>{deck.name}</strong>
        {deck.borrowed > 0 && ` · ${deck.borrowed} filled from your album`}.{' '}
        <Link to="/collection">Edit deck</Link>
      </p>
      {([1, 2, 3, 4] as const).map((act) => (
        <section key={act}>
          <h2 style={{ fontFamily: 'var(--font)', color: 'var(--gold)' }}>
            Act {act} — {ACTS[act - 1]}
          </h2>
          {ENCOUNTERS.filter((e) => e.act === act).map((e) => {
            const idx = ENCOUNTERS.findIndex((x) => x.id === e.id);
            const previous = idx > 0 ? ENCOUNTERS[idx - 1] : undefined;
            const unlocked = e.id === 't1' || save.campaign.completed.includes(e.id) || Boolean(previous && save.campaign.completed.includes(previous.id));
            return (
              <div key={e.id} className="mode-card" style={{ marginBottom: 8, opacity: unlocked ? 1 : 0.45 }}>
                <h3 style={{ margin: '0 0 0.25rem' }}>{e.title}</h3>
                <p>
                  {e.opponentName} · {e.tactic}
                </p>
                {e.playerTemplates && <p className="muted">Lesson hand provided — your deck sits this one out.</p>}
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
