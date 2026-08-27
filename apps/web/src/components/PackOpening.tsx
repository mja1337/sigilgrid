import React, { useEffect, useState } from 'react';
import type { CardInstance } from '@sigilgrid/core';
import { templateById, type PackTier } from '@sigilgrid/content';
import { CardFace } from './CardFace.tsx';
import { PackArt } from './PackArt.tsx';

type Phase = 'sealed' | 'tearing' | 'revealing';

/**
 * Tear-open sequence for a purchased pack. Cards are already committed to the
 * save by this point — this is presentation, so it stays skippable and can be
 * closed at any moment without losing the pull.
 */
export function PackOpening({
  tier,
  cards,
  newTemplateIds,
  onClose,
}: {
  tier: PackTier;
  cards: CardInstance[];
  newTemplateIds: Set<string>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('sealed');
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (phase !== 'tearing') return;
    const t = window.setTimeout(() => setPhase('revealing'), 620);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revealing' || revealed >= cards.length) return;
    const t = window.setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 180 : 420);
    return () => window.clearTimeout(t);
  }, [phase, revealed, cards.length]);

  const done = phase === 'revealing' && revealed >= cards.length;

  function skip() {
    setPhase('revealing');
    setRevealed(cards.length);
  }

  return (
    <div className="modal pack-modal" role="dialog" aria-label={`Opening ${tier.name}`}>
      <div className="modal-card pack-open" data-testid="pack-opening">
        <h2 className="pack-title">{tier.name}</h2>

        {phase !== 'revealing' && (
          <>
            <button
              type="button"
              className={`pack-stage ${phase === 'tearing' ? 'tearing' : ''}`}
              data-testid="pack-tear"
              onClick={() => phase === 'sealed' && setPhase('tearing')}
              aria-label="Tear the pack open"
            >
              <PackArt tierId={tier.id} torn={phase === 'tearing'} />
            </button>
            <p className="pack-hint">{phase === 'sealed' ? 'Tap to tear it open' : 'Opening…'}</p>
          </>
        )}

        {phase === 'revealing' && (
          <>
            <div className="pack-reveal" data-testid="pack-reveal">
              {cards.map((c, i) => {
                const rarity = safeRarity(c.templateId);
                return (
                  <div
                    key={c.instanceId}
                    className={`pack-card ${i < revealed ? 'in' : ''} rarity-${rarity}`}
                    style={{ transitionDelay: `${Math.min(i, 4) * 40}ms` }}
                  >
                    <CardFace card={c} />
                    {newTemplateIds.has(c.templateId) && <span className="pack-new">NEW</span>}
                    <span className="pack-rarity">{rarity}</span>
                  </div>
                );
              })}
            </div>
            <p className="pack-hint" role="status">
              {done
                ? `${countNew(cards, newTemplateIds)} new of ${cards.length}`
                : 'Revealing…'}
            </p>
          </>
        )}

        <div className="pack-actions">
          {!done && (
            <button className="btn ghost" type="button" data-testid="pack-skip" onClick={skip}>
              Skip
            </button>
          )}
          {done && (
            <button className="btn" type="button" data-testid="pack-done" onClick={onClose}>
              Add to album
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function safeRarity(templateId: string): string {
  try {
    return templateById(templateId).rarity;
  } catch {
    return 'common';
  }
}

function countNew(cards: CardInstance[], newTemplateIds: Set<string>): number {
  return cards.filter((c) => newTemplateIds.has(c.templateId)).length;
}
