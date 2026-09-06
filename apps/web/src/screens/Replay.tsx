import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createMatch,
  reduce,
  scoreBoard,
  type GameAction,
  type MatchState,
} from '@sigilgrid/core';
import type { StoredReplay } from '@sigilgrid/protocol';
import { useGame } from '../GameContext.tsx';
import { BoardView } from '../components/Board.tsx';
import { CardFace } from '../components/CardFace.tsx';

export function replayStates(record: StoredReplay): MatchState[] {
  const states = [createMatch(record.config)];
  for (const action of record.actions) {
    const result = reduce(states.at(-1)!, action);
    const illegal = result.events.find((event) => event.kind === 'illegal');
    if (illegal?.kind === 'illegal') throw new Error(illegal.reason);
    states.push(result.nextState);
  }
  return states;
}

function actionLabel(action: GameAction | undefined, state: MatchState): string {
  if (!action) return 'The coin is cast';
  if (action.type === 'place') {
    const card = state.cards[action.instanceId];
    return `${card?.displayName ?? 'Card'} placed on space ${action.cell + 1}`;
  }
  if (action.type === 'chooseBattleOrder') return 'Battle order chosen';
  return 'Mastery upgrade chosen';
}

export function ReplayScreen() {
  const { save } = useGame();
  const { replayId } = useParams();
  const index = Number(replayId);
  const record = Number.isInteger(index) ? save.replays[index] : undefined;
  const built = useMemo(() => {
    if (!record) return { states: null, error: 'Replay not found.' };
    try {
      return { states: replayStates(record), error: '' };
    } catch {
      return {
        states: null,
        error: 'This replay was recorded before full playback data was available.',
      };
    }
  }, [record]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const max = built.states ? built.states.length - 1 : 0;
  const state = built.states?.[Math.min(step, max)];

  useEffect(() => {
    if (!playing) return;
    if (step >= max) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((value) => Math.min(max, value + 1)), 900 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, step, max, speed]);

  if (!record || !state) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <Link to="/settings">Back</Link>
          <div className="brand">Replay Theatre</div>
        </div>
        <section className="replay-error">
          <h2>Playback unavailable</h2>
          <p>{built.error}</p>
          <Link className="btn" to="/settings">Return to replays</Link>
        </section>
      </div>
    );
  }

  const score = scoreBoard(state);
  const action = step > 0 ? record.actions[step - 1] : undefined;

  return (
    <div className="app-shell replay-shell">
      <div className="topbar">
        <Link to="/settings">Back</Link>
        <div className="brand">Replay Theatre</div>
      </div>
      <div className="replay-heading">
        <div>
          <p className="muted">{record.mode ?? 'match'} · seed {record.config.seed}</p>
          <h2>{record.label ?? 'Recorded rite'}</h2>
        </div>
        <strong>{score.player}:{score.opponent}</strong>
      </div>

      <div className="replay-hand" aria-label="Opponent cards remaining">
        {state.hands.opponent.map((id) => (
          <CardFace key={id} card={state.cards[id]!} owner="opponent" compact />
        ))}
      </div>
      <div className="replay-board">
        <BoardView
          state={state}
          selectedId={null}
          focusCell={-1}
          preview={null}
          onCell={() => undefined}
        />
      </div>
      <div className="replay-hand" aria-label="Player cards remaining">
        {state.hands.player.map((id) => (
          <CardFace key={id} card={state.cards[id]!} owner="player" compact />
        ))}
      </div>

      <section className="replay-controls" aria-label="Replay controls">
        <p aria-live="polite" data-testid="replay-action">
          <strong>{step}/{max}</strong> · {actionLabel(action, state)}
        </p>
        <input
          aria-label="Replay position"
          type="range"
          min={0}
          max={max}
          value={step}
          onChange={(event) => {
            setPlaying(false);
            setStep(Number(event.target.value));
          }}
        />
        <div>
          <button className="btn ghost" type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
            Previous
          </button>{' '}
          <button
            className="btn"
            type="button"
            data-testid="replay-play"
            onClick={() => {
              if (step >= max) setStep(0);
              setPlaying((value) => !value);
            }}
          >
            {playing ? 'Pause' : step >= max ? 'Replay' : 'Play'}
          </button>{' '}
          <button className="btn ghost" type="button" disabled={step >= max} onClick={() => setStep((value) => value + 1)}>
            Next
          </button>{' '}
          <label>
            Speed{' '}
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
