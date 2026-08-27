import React, { useEffect, useState } from 'react';
import {
  DIRECTIONS,
  OFFSET,
  cellToRc,
  legalCells,
  type Direction,
  type MatchEvent,
  type MatchState,
  type PlacementPreview,
} from '@sigilgrid/core';
import { CardFace } from './CardFace.tsx';
import blockStone from '../assets/block-stone.png';

function dirBetween(from: number, to: number): Direction | null {
  const [r0, c0] = cellToRc(from);
  const [r1, c1] = cellToRc(to);
  const dr = Math.sign(r1 - r0);
  const dc = Math.sign(c1 - c0);
  return DIRECTIONS.find((d) => OFFSET[d][0] === dr && OFFSET[d][1] === dc) ?? null;
}

function jitter(final: number, tick: number): number {
  if (tick > 14) return final;
  const span = Math.max(12, Math.abs(final) + 8);
  return Math.abs((final * 17 + tick * 31) % span);
}

export function BoardView(props: {
  state: MatchState;
  selectedId: string | null;
  focusCell: number;
  preview: PlacementPreview | null;
  ghostCell?: number;
  placedCell?: number | null;
  capturedCells?: number[];
  hoverCell?: number | null;
  combatEvents?: MatchEvent[] | null;
  onCell: (i: number) => void;
  onCellEnter?: (i: number) => void;
}) {
  const legal = new Set(legalCells(props.state));
  const captured = new Set(props.capturedCells ?? []);
  const battle = props.combatEvents?.find((e) => e.kind === 'battle');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!props.combatEvents) {
      setTick(0);
      return;
    }
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTick(n);
    }, 55);
    return () => window.clearInterval(id);
  }, [props.combatEvents]);

  const nudgeDir =
    battle && battle.kind === 'battle' && tick < 16 ? dirBetween(battle.placedCell, battle.targetCell) : null;
  const showRolls = Boolean(battle && battle.kind === 'battle');

  return (
    <div className="board" role="grid" aria-label="Tetra Master grid">
      <div className="board-crest" aria-hidden />
      {props.state.board.map((cell, i) => {
        const occ = cell.occupant;
        const card = occ ? props.state.cards[occ.instanceId] : null;
        const isAttacker = battle && battle.kind === 'battle' && i === battle.placedCell;
        const isDefender = battle && battle.kind === 'battle' && i === battle.targetCell;
        const roll = showRolls && battle && battle.kind === 'battle'
          ? isAttacker
            ? { kind: 'attack' as const, value: jitter(battle.detail.attackFinal, tick), settled: tick > 14 }
            : isDefender
              ? { kind: 'defense' as const, value: jitter(battle.detail.defenseFinal, tick), settled: tick > 14 }
              : null
          : null;
        return (
          <div
            key={i}
            role="gridcell"
            data-testid={`cell-${i}`}
            className={`cell ${cell.blocked ? 'blocked' : ''} ${legal.has(i) && props.selectedId ? 'legal' : ''} ${
              props.preview?.cell === i ? 'preview' : ''
            } ${props.ghostCell === i ? 'ghost' : ''} ${props.focusCell === i ? 'focused' : ''} ${
              props.hoverCell === i ? 'drop-hover' : ''
            }`}
            tabIndex={cell.blocked ? -1 : 0}
            onClick={() => props.onCell(i)}
            onPointerEnter={() => props.onCellEnter?.(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onCell(i);
            }}
          >
            {cell.blocked && (
              <div className="block-plug" aria-label="Blocked space" data-testid={`blocked-${i}`}>
                <img src={blockStone} alt="" draggable={false} />
              </div>
            )}
            {card && occ && (
              <CardFace
                card={card}
                owner={occ.owner}
                compact
                justPlaced={props.placedCell === i}
                justCaptured={captured.has(i)}
                nudgeDir={isAttacker ? nudgeDir : null}
                roll={roll}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
