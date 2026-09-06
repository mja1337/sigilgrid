import React from 'react';
import { Link } from 'react-router-dom';
import { CHALLENGES } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { DeckReadout } from '../components/DeckReadout.tsx';
import { circuitFinished } from '../progress.ts';

export function ChallengesScreen() {
  const { save } = useGame();
  const open = circuitFinished(save);
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Challenge Rites</div>
      </div>
      <p>
        After the lantern, the circuit keeps three boards with no loot. First wins grant seals or
        cosmetics. Repeats pay a single seal.
      </p>
      <DeckReadout testId="challenge-deck-banner" />
      {!open && (
        <p className="warn-block" data-testid="challenges-locked">
          Finish the Ashfall Circuit to open these rites.
        </p>
      )}
      {CHALLENGES.map((encounter) => {
        const won = (save.campaign.challenges ?? []).includes(encounter.id);
        return (
          <div
            key={encounter.id}
            className="mode-card"
            style={{ marginBottom: 8, opacity: open ? 1 : 0.45 }}
            data-testid={`challenge-${encounter.id}`}
          >
            <h3 style={{ margin: '0 0 0.25rem' }}>{encounter.title}</h3>
            <p>
              {encounter.opponentName} · {encounter.tactic}
              {won ? ' · cleared' : ''}
            </p>
            {open && (
              <Link
                className="btn"
                to={`/play?mode=challenge&encounter=${encounter.id}&seed=${400 + encounter.index}`}
              >
                Enter
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
