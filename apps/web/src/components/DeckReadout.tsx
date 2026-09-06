import React from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../GameContext.tsx';
import { activeDeckSummary } from '../progress.ts';

export function DeckReadout({ testId = 'deck-readout' }: { testId?: string }) {
  const { save } = useGame();
  const deck = activeDeckSummary(save);
  return (
    <p className="deck-banner" data-testid={testId}>
      Taking in <strong>{deck.name}</strong>
      {deck.borrowed > 0 && ` · ${deck.borrowed} filled from your album`}
      {' · '}
      {deck.mix} · {deck.band} ({deck.power})
      . <Link to="/collection">Edit deck</Link>
    </p>
  );
}
