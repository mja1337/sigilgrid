import React from 'react';
import { formatHex, type CardInstance, type Direction, type PlayerId } from '@sigilgrid/core';
import { CardArt } from './CardArt.tsx';

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
  return (
    <div
      className={`card-face ${props.owner ? `owner-${props.owner}` : ''} ${props.selected ? 'selected' : ''} ${props.compact ? 'compact' : ''} ${props.justPlaced ? 'just-placed' : ''} ${props.justCaptured ? 'just-captured' : ''} ${props.nudgeDir ? `nudge-${props.nudgeDir}` : ''} ${props.dragging ? 'dragging' : ''}`}
      role="button"
      tabIndex={0}
      data-testid={`card-${props.card.instanceId}`}
      onClick={props.onSelect}
      onPointerDown={props.onPointerDown}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onSelect?.();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        props.onInspect?.();
      }}
    >
      <div className="name">{props.card.displayName}</div>
      <div className="art-window">
        <CardArt templateId={props.card.templateId} />
      </div>
      <div className="arrows" aria-hidden>
        {props.card.arrows.map((d) => (
          <span key={d} className={`arrow on dir-${d}`} data-dir={d} />
        ))}
      </div>
      <div className="stat-strip" title="Attack Class Physical Magical">
        <span>{formatHex(props.card.attack)}</span>
        <span>{props.card.battleClass}</span>
        <span>{formatHex(props.card.physicalDefense)}</span>
        <span>{formatHex(props.card.magicalDefense)}</span>
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

export function InspectPanel({ card, onClose }: { card: CardInstance; onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-label="Card inspect">
      <div className="modal-card">
        <div className="inspect-art">
          <CardFace card={card} />
        </div>
        <h2 style={{ fontFamily: 'var(--font)', marginTop: 0 }}>{card.displayName}</h2>
        <p>
          {card.battleClass} · {card.rarity} · mastery {card.masteryLevel} ({card.masteryXp} xp)
        </p>
        <p>
          Attack {formatHex(card.attack)} = {card.attack * 16}–{card.attack * 16 + 15} power band
        </p>
        <p>
          Physical {formatHex(card.physicalDefense)} = {card.physicalDefense * 16}–{card.physicalDefense * 16 + 15} power band
        </p>
        <p>
          Magical {formatHex(card.magicalDefense)} = {card.magicalDefense * 16}–{card.magicalDefense * 16 + 15} power band
        </p>
        <p>Arrows: {card.arrows.join(', ') || 'none'}</p>
        <p>Provenance: {card.provenance} · victories {card.victories}</p>
        <h3>History</h3>
        <ul>
          {card.history.length === 0 && <li>No recorded changes yet.</li>}
          {card.history.map((h, i) => (
            <li key={i}>{JSON.stringify(h)}</li>
          ))}
        </ul>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
