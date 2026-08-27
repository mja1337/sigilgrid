import React from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../GameContext.tsx';

export function HomeScreen() {
  const { save } = useGame();
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          Sigil Grid
          <small>ASHFALL</small>
        </div>
        <Link to="/settings">Settings</Link>
      </header>
      <p style={{ maxWidth: 640, color: 'var(--parchment-dim)' }}>
        Wayfinders carry engraved creature-and-relic sigils. City-states settle disputes on the Grid while the Ashfall unmakes conventional war. A directional tactical card game for one player.
      </p>
      <div className="home-grid">
        <Link className="mode-card" to="/story" data-testid="mode-story">
          <h2>Story Circuit</h2>
          <p>Twelve encounters. Next: {save.campaign.nextId}. Completed {save.campaign.completed.length}/12.</p>
        </Link>
        <Link className="mode-card" to="/practice" data-testid="mode-practice">
          <h2>Practice Table</h2>
          <p>Choose seed, deck, and opponent. No stakes.</p>
        </Link>
        <Link className="mode-card" to="/daily" data-testid="mode-daily">
          <h2>Daily Rift</h2>
          <p>Local best {save.daily.bestScore ?? '—'}</p>
        </Link>
        <Link className="mode-card" to="/collection" data-testid="mode-collection">
          <h2>Collection & Workshop</h2>
          <p>{save.collection.length} sigils · {save.seals} seals</p>
        </Link>
        {save.wagerUnlocked && (
          <Link className="mode-card" to="/wager" data-testid="mode-wager">
            <h2>Wager Rites</h2>
            <p>Opt-in stakes against an NPC. Confirmation required.</p>
          </Link>
        )}
      </div>
    </div>
  );
}
