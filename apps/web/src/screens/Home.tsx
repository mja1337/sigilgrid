import React from 'react';
import { Link } from 'react-router-dom';
import { COLLECTOR_MAX, collectorScore, cardPower, MASTERY_CAP } from '@sigilgrid/core';
import { COLLECTION_CAP } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { dailyChallenge, todayKey, visibleDailyStreak } from '../daily.ts';
import { circuitFinished } from '../progress.ts';

export function HomeScreen() {
  const { save } = useGame();
  const rank = collectorScore(save.collection);
  const today = todayKey();
  const daily = dailyChallenge(today);
  const dailyStreak = visibleDailyStreak(save.daily, today);
  const pct = Math.round((rank.points / COLLECTOR_MAX) * 100);
  const masteryPips = save.collection.reduce((n, c) => n + c.masteryLevel, 0);
  const masteryCeiling = save.collection.length * MASTERY_CAP;
  const best = save.collection.reduce<{ name: string; power: number }>(
    (acc, c) => {
      const power = cardPower(c);
      return power > acc.power ? { name: c.displayName, power } : acc;
    },
    { name: '—', power: 0 },
  );
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

      <section className="rank-panel" data-testid="home-rank" aria-label="Your progress">
        <div className="rank-head">
          <div>
            <span className="rank-title">{rank.title}</span>
            <span className="rank-points">
              {rank.points}<span className="muted"> / {COLLECTOR_MAX} collector points</span>
            </span>
          </div>
          <div className="rank-seals" data-testid="home-seals">
            <strong>{save.seals}</strong> seals
          </div>
        </div>
        <div className="rank-track" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <dl className="rank-stats">
          <div>
            <dt>Album</dt>
            <dd data-testid="home-album">
              {rank.uniqueTypes}/{COLLECTION_CAP}
            </dd>
          </div>
          <div>
            <dt>Arrow patterns</dt>
            <dd>{rank.uniqueArrows}</dd>
          </div>
          <div>
            <dt>Mastery pips</dt>
            <dd data-testid="home-mastery">
              {masteryPips}
              <span className="muted"> / {masteryCeiling}</span>
            </dd>
          </div>
          <div>
            <dt>Strongest sigil</dt>
            <dd>
              {best.name} <span className="muted">{best.power}</span>
            </dd>
          </div>
        </dl>
      </section>
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
          <p>{daily.name} · best {save.daily.date === today ? save.daily.bestScore ?? '—' : '—'} · {dailyStreak}-day streak</p>
        </Link>
        <Link className="mode-card" to="/collection" data-testid="mode-collection">
          <h2>Collection & Workshop</h2>
          <p>
            {save.collection.length}/{COLLECTION_CAP} sigils held · build decks, open packs, spend seals
          </p>
        </Link>
        {save.wagerUnlocked && (
          <Link className="mode-card" to="/wager" data-testid="mode-wager">
            <h2>Wager Rites</h2>
            <p>Named NPCs. Opt-in stakes, confirmation required.</p>
          </Link>
        )}
        {circuitFinished(save) && (
          <Link className="mode-card" to="/challenges" data-testid="mode-challenges">
            <h2>Challenge Rites</h2>
            <p>Three expert boards. No loot — seals and cosmetics on first clear.</p>
          </Link>
        )}
      </div>
    </div>
  );
}
