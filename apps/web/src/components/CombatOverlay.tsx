import React, { useEffect, useRef, useState } from 'react';
import { type MatchEvent, type MatchState } from '@sigilgrid/core';
import { ROLL_SETTLE_MS } from './rollTiming.ts';

const TICK_MS = 70;

export function CombatOverlay(props: {
  events: MatchEvent[];
  state: MatchState;
  autoMs: number;
  onDone: () => void;
}) {
  const battles = props.events.filter((e) => e.kind === 'battle');
  const combos = props.events.filter((e) => e.kind === 'combo');
  const [tick, setTick] = useState(0);

  const onDoneRef = useRef(props.onDone);
  onDoneRef.current = props.onDone;

  useEffect(() => {
    const t = window.setTimeout(() => onDoneRef.current(), props.autoMs);
    return () => window.clearTimeout(t);
  }, [props.autoMs]);

  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTick(n);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const battle = battles[0];
  // Only a real clash earns a caption. Unopposed captures used to raise one and
  // it interrupted the turn to announce something the board already shows.
  const caption =
    battle && battle.kind === 'battle'
      ? tick * TICK_MS >= ROLL_SETTLE_MS
        ? `${battle.winner === 'player' ? 'You' : 'Opponent'} win the clash  ${battle.detail.attackFinal} vs ${battle.detail.defenseFinal}`
        : 'Rolling…'
      : combos.length
        ? 'Combo!'
        : '';

  return (
    <div className="combat-hud" role="status" aria-label="Card battle">
      <p className="combat-caption" data-testid="combat-overlay">
        {caption}
        {combos.map((c) =>
          c.kind === 'combo' ? (
            <span key={c.id}> · Combo +{c.convertedCells.length}</span>
          ) : null,
        )}
      </p>
      <button className="btn" data-testid="resolve-close" onClick={props.onDone}>
        Continue
      </button>
    </div>
  );
}
