import React from 'react';
import {
  bandLabel,
  cardCollectorShare,
  cardPower,
  collectorScore,
  formatHex,
  hiddenOf,
  HIDDEN_PER_PIP,
  HIDDEN_PER_WIN,
  nearestUpgrade,
  powerBand,
  remainingToPip,
  STAT_LABEL,
  winsToPip,
  type CardInstance,
  type CardHistoryEntry,
  type Direction,
  type PlayerId,
} from '@sigilgrid/core';
import { templateById } from '@sigilgrid/content';
import { CardArt } from './CardArt.tsx';

const LONG_PRESS_MS = 450;
const LONG_PRESS_SLOP = 10;

export function CardFace(props: {
  card: CardInstance;
  owner?: PlayerId;
  selected?: boolean;
  compact?: boolean;
  justPlaced?: boolean;
  justCaptured?: boolean;
  nudgeDir?: Direction | null;
  roll?: { kind: 'attack' | 'defense'; value: number; settled?: boolean } | null;
  dragging?: boolean;
  onSelect?: () => void;
  onInspect?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  // Touch has no double-click and no right-click, so inspect hangs off a
  // long press. A drag past the slop cancels it and stays a placement.
  const pressTimer = React.useRef<number | null>(null);
  const pressOrigin = React.useRef<{ x: number; y: number } | null>(null);
  const pressFired = React.useRef(false);

  const cancelPress = React.useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressOrigin.current = null;
  }, []);

  React.useEffect(() => cancelPress, [cancelPress]);

  return (
    <div
      className={`card-face ${props.owner ? `owner-${props.owner}` : ''} ${props.selected ? 'selected' : ''} ${props.compact ? 'compact' : ''} ${props.justPlaced ? 'just-placed' : ''} ${props.justCaptured ? 'just-captured' : ''} ${props.nudgeDir ? `nudge-${props.nudgeDir}` : ''} ${props.dragging ? 'dragging' : ''}`}
      role="button"
      tabIndex={0}
      data-testid={`card-${props.card.instanceId}`}
      title="Tap to select. Long-press, double-click or right-click to inspect."
      onClick={(e) => {
        if (pressFired.current) {
          pressFired.current = false;
          return;
        }
        if (e.detail > 1) return;
        props.onSelect?.();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onInspect?.();
      }}
      onPointerDown={(e) => {
        pressFired.current = false;
        props.onPointerDown?.(e);
        if (!props.onInspect) return;
        pressOrigin.current = { x: e.clientX, y: e.clientY };
        pressTimer.current = window.setTimeout(() => {
          pressTimer.current = null;
          pressOrigin.current = null;
          pressFired.current = true;
          props.onInspect?.();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        const origin = pressOrigin.current;
        if (!origin) return;
        if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > LONG_PRESS_SLOP) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect?.();
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          props.onInspect?.();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        cancelPress();
        if (pressFired.current) return;
        props.onInspect?.();
      }}
    >
      <div className="art-window">
        <CardArt templateId={props.card.templateId} />
      </div>
      <div className="arrows" aria-hidden>
        {props.card.arrows.map((d) => (
          <span key={d} className={`arrow dir-${d}`} data-dir={d}>
            <svg viewBox="0 0 12 14">
              <polygon points="6,1.2 11.2,12.4 0.8,12.4" />
            </svg>
          </span>
        ))}
      </div>
      <div className="card-hud">
        <div className="name">{props.card.displayName}</div>
        <div className="stat-strip" title="Attack Class Physical Magical">
          <span>{formatHex(props.card.attack)}</span>
          <span>{props.card.battleClass}</span>
          <span>{formatHex(props.card.physicalDefense)}</span>
          <span>{formatHex(props.card.magicalDefense)}</span>
        </div>
      </div>
      {props.roll && (
        <div className={`roll-pip ${props.roll.kind} ${props.roll.settled ? 'settled' : 'spinning'}`} data-testid={`roll-${props.roll.kind}`}>
          <span className="roll-label">{props.roll.kind === 'attack' ? 'ATK' : 'DEF'}</span>
          <strong>{props.roll.value}</strong>
        </div>
      )}
    </div>
  );
}

function historyLine(h: CardHistoryEntry): string {
  if (h.kind === 'created') return `Created (${h.note})`;
  if (h.kind === 'stat') return `${STAT_LABEL[h.stat]} ${formatHex(h.from)} → ${formatHex(h.to)} (${h.source})`;
  if (h.kind === 'class') return `Class ${h.from} → ${h.to}`;
  return `Match ${h.result}`;
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="stat-meter" aria-label={label}>
      <div className="stat-meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function InspectPanel({
  card,
  collection = [],
  onClose,
}: {
  card: CardInstance;
  collection?: CardInstance[];
  onClose: () => void;
}) {
  let baseAtk = card.attack;
  let baseP = card.physicalDefense;
  let baseM = card.magicalDefense;
  let lore = '';
  try {
    const t = templateById(card.templateId);
    baseAtk = t.attack;
    baseP = t.physicalDefense;
    baseM = t.magicalDefense;
    lore = t.lore;
  } catch {
    /* test cards */
  }

  const power = cardPower(card);
  const basePower = cardPower({
    ...card,
    attack: baseAtk,
    physicalDefense: baseP,
    magicalDefense: baseM,
    attackFine: 0,
    physicalFine: 0,
    magicalFine: 0,
    battleClass: card.battleClass === 'X' || card.battleClass === 'A' ? 'P' : card.battleClass,
  });
  const next = nearestUpgrade(card);
  const share = collection.length ? cardCollectorShare(card, collection) : null;
  const rank = collection.length ? collectorScore(collection) : null;
  const stats = [
    { key: 'attack' as const, shown: card.attack, base: baseAtk, fine: card.attackFine ?? 0 },
    { key: 'physicalDefense' as const, shown: card.physicalDefense, base: baseP, fine: card.physicalFine ?? 0 },
    { key: 'magicalDefense' as const, shown: card.magicalDefense, base: baseM, fine: card.magicalFine ?? 0 },
  ];

  return (
    <div className="modal" role="dialog" aria-label="Card inspect">
      <div className="modal-card inspect-panel">
        <div className="inspect-art">
          <CardFace card={card} />
        </div>
        <h2 style={{ fontFamily: 'var(--font)', marginTop: 0 }}>{card.displayName}</h2>
        <p className="inspect-lead">
          {powerBand(power)} · power {power}
          {power !== basePower ? ` (${power - basePower >= 0 ? '+' : ''}${power - basePower} vs printed)` : ' · printed strength'}
        </p>
        {lore && <p className="inspect-lore">{lore}</p>}
        <table className="inspect-stats" data-testid="inspect-stats">
          <thead>
            <tr>
              <th>Stat</th>
              <th>Shown</th>
              <th>Underlying</th>
              <th>Next pip</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const under = hiddenOf(card, s.key);
              const rem = remainingToPip(card, s.key);
              const wins = winsToPip(card, s.key);
              const delta = s.shown - s.base;
              return (
                <tr key={s.key}>
                  <td>{STAT_LABEL[s.key]}</td>
                  <td>
                    {formatHex(s.shown)}
                    {delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}
                    <div className="inspect-band">{bandLabel(s.shown)}</div>
                  </td>
                  <td>
                    {under}/{s.shown >= 15 ? 255 : (s.shown + 1) * HIDDEN_PER_PIP}
                    <Meter value={s.fine} max={HIDDEN_PER_PIP} label={`${STAT_LABEL[s.key]} hidden ${s.fine} of ${HIDDEN_PER_PIP}`} />
                    <span className="inspect-fine">{s.fine}/{HIDDEN_PER_PIP} hidden</span>
                  </td>
                  <td>{rem === 0 ? 'Maxed' : `${rem} pts · ${wins} win${wins === 1 ? '' : 's'} if rolled`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p>
          Class <strong>{card.battleClass}</strong>
          {card.battleClass === 'P' || card.battleClass === 'M'
            ? ' · 1/64 chance to become X after a won card battle'
            : card.battleClass === 'X'
              ? ' · 1/128 chance to become A after a won card battle'
              : ' · peak class'}
        </p>
        {next ? (
          <p data-testid="inspect-upgrade">
            Next visible pip: {STAT_LABEL[next.stat]} in {next.remaining} hidden points.
            A won match grants {HIDDEN_PER_WIN} hidden points to a random open stat
            {' '}({next.winsIfChosen} wins if that stat is chosen, about {next.expectedWins} wins on average).
          </p>
        ) : (
          <p>All displayed stats are maxed at F.</p>
        )}
        <p>
          Arrows: {card.arrows.join(', ') || 'none'} · {card.arrows.length}/8 · mastery {card.masteryLevel}
        </p>
        <p>
          Record: {card.victories} victories · {card.battleHistory.wins} battle wins / {card.battleHistory.losses} losses ·{' '}
          {card.battleHistory.placements} placements · {card.provenance} · {card.rarity}
        </p>
        {rank && share && (
          <p data-testid="inspect-collector">
            Collector share {share.total} pts (type {share.type}, arrows {share.arrows}, class {share.cls}).
            Album rank <strong>{rank.title}</strong> {rank.points}/{1700}.
          </p>
        )}
        <h3>History</h3>
        <ul>
          {card.history.length === 0 && <li>No recorded changes yet.</li>}
          {card.history.map((h, i) => (
            <li key={i}>{historyLine(h)}</li>
          ))}
        </ul>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
