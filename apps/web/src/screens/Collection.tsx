import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLLECTOR_MAX, collectorScore, discardImpact, type CardInstance } from '@sigilgrid/core';
import {
  COLLECTION_CAP,
  DECK_PRESETS,
  LORE,
  PACK_TIERS,
  resolvePresetDeck,
  templateById,
} from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { CardFace, InspectPanel } from '../components/CardFace.tsx';
import { PackArt } from '../components/PackArt.tsx';
import { PackOpening } from '../components/PackOpening.tsx';
import { buyPackTier, discardCard, freeSlots } from '../progress.ts';

type Tab = 'album' | 'deck' | 'shop';

export function CollectionScreen() {
  const { save, patch } = useGame();
  const [tab, setTab] = useState<Tab>('album');
  const [q, setQ] = useState('');
  const [klass, setKlass] = useState('');
  const [inspect, setInspect] = useState<string | null>(null);
  const [shopMsg, setShopMsg] = useState('');
  const [opening, setOpening] = useState<{ tierId: string; cards: CardInstance[]; fresh: Set<string> } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);

  const active = save.decks.find((d) => d.id === save.activeDeckId);
  const [deckIds, setDeckIds] = useState<string[]>(active?.instanceIds ?? []);

  useEffect(() => {
    setDeckIds(save.decks.find((d) => d.id === save.activeDeckId)?.instanceIds ?? []);
  }, [save.activeDeckId, save.decks]);

  const list = useMemo(
    () =>
      save.collection.filter((c) => {
        if (q && !c.displayName.toLowerCase().includes(q.toLowerCase())) return false;
        if (klass && c.battleClass !== klass) return false;
        return true;
      }),
    [save.collection, q, klass],
  );

  const rank = collectorScore(save.collection);
  const card = inspect ? save.collection.find((c) => c.instanceId === inspect) : null;
  const doomed = confirmDiscard ? save.collection.find((c) => c.instanceId === confirmDiscard) : null;
  const impact = doomed ? discardImpact(doomed, save.collection) : null;
  const slots = freeSlots(save);

  const deckCards = deckIds
    .map((id) => save.collection.find((c) => c.instanceId === id))
    .filter(Boolean) as CardInstance[];
  const dirty = JSON.stringify(deckIds) !== JSON.stringify(active?.instanceIds ?? []);

  function toggleDeck(instanceId: string) {
    setDeckIds((ids) => {
      if (ids.includes(instanceId)) return ids.filter((x) => x !== instanceId);
      if (ids.length >= 5) return ids;
      return [...ids, instanceId];
    });
  }

  function saveDeck() {
    patch((s) => ({
      ...s,
      decks: s.decks.map((d) => (d.id === s.activeDeckId ? { ...d, instanceIds: deckIds } : d)),
    }));
  }

  function buy(tierId: string) {
    const seed = save.collection.length * 31 + save.seals * 7 + tierId.length;
    const result = buyPackTier(save, tierId, seed);
    if (typeof result === 'string') {
      setShopMsg(result);
      return;
    }
    setShopMsg('');
    const owned = new Set(save.collection.map((c) => c.templateId));
    setOpening({
      tierId,
      cards: result.pulled,
      fresh: new Set(result.pulled.map((c) => c.templateId).filter((t) => !owned.has(t))),
    });
    patch(() => result.save);
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Workshop</div>
      </div>

      <div className="collector-hud" data-testid="collector-rank">
        <strong>{rank.title}</strong> {rank.points}/{COLLECTOR_MAX} collector points
        <div className="collector-track" aria-hidden>
          <span style={{ width: `${(rank.points / COLLECTOR_MAX) * 100}%` }} />
        </div>
        <span>
          {rank.uniqueTypes}/100 unique · {rank.uniqueArrows} arrow patterns · {rank.classA} A / {rank.classX} X ·{' '}
          <strong data-testid="seal-count">{save.seals}</strong> seals
        </span>
        <span className={slots === 0 ? 'album-full' : ''} data-testid="album-slots">
          Album {save.collection.length}/{COLLECTION_CAP}
          {slots === 0 ? ' — full, discard to make room' : ` · ${slots} free`}
        </span>
      </div>

      <div className="tabs" role="tablist">
        {(['album', 'deck', 'shop'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? 'on' : ''}`}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
          >
            {t === 'album' ? 'Album' : t === 'deck' ? `Deck ${deckIds.length}/5` : 'Shop'}
          </button>
        ))}
      </div>

      {tab === 'album' && (
        <>
          <div className="filters">
            <input placeholder="Filter name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by name" />
            <select value={klass} onChange={(e) => setKlass(e.target.value)} aria-label="Filter class">
              <option value="">All classes</option>
              {['P', 'M', 'X', 'A'].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </div>
          <p className="muted">{list.length} shown · long-press a card to inspect · discard to free album space</p>
          <div className="album">
            {list.map((c) => (
              <div key={c.instanceId} className="album-slot">
                <CardFace card={c} onSelect={() => setInspect(c.instanceId)} onInspect={() => setInspect(c.instanceId)} />
                <button
                  type="button"
                  className="discard-btn"
                  data-testid={`discard-${c.instanceId}`}
                  aria-label={`Discard ${c.displayName}`}
                  onClick={() => setConfirmDiscard(c.instanceId)}
                >
                  Discard
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'deck' && (
        <>
          <div className="deck-bar">
            <label>
              Deck{' '}
              <select
                aria-label="Active deck"
                value={save.activeDeckId}
                onChange={(e) => patch((s) => ({ ...s, activeDeckId: e.target.value }))}
              >
                {save.decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn ghost"
              type="button"
              data-testid="deck-new"
              onClick={() => {
                const id = `custom-${Date.now().toString(36)}`;
                patch((s) => ({
                  ...s,
                  decks: [...s.decks, { id, name: `Custom ${s.decks.length + 1}`, instanceIds: [] }],
                  activeDeckId: id,
                }));
              }}
            >
              New
            </button>
            <button
              className="btn ghost"
              type="button"
              data-testid="deck-clear"
              disabled={deckIds.length === 0}
              onClick={() => setDeckIds([])}
            >
              Clear
            </button>
          </div>

          {/* Five explicit slots, so it always reads as a deck rather than a filter. */}
          <div className="deck-slots" data-testid="deck-slots">
            {Array.from({ length: 5 }, (_, i) => {
              const c = deckCards[i];
              return c ? (
                <div key={c.instanceId} className="deck-slot filled">
                  <CardFace card={c} onSelect={() => toggleDeck(c.instanceId)} onInspect={() => setInspect(c.instanceId)} />
                  <button
                    type="button"
                    className="slot-remove"
                    aria-label={`Remove ${c.displayName} from deck`}
                    data-testid={`deck-remove-${c.instanceId}`}
                    onClick={() => toggleDeck(c.instanceId)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div key={`empty-${i}`} className="deck-slot empty" aria-label="Empty deck slot">
                  <span>{i + 1}</span>
                </div>
              );
            })}
          </div>

          <div className="deck-actions">
            <button className="btn" type="button" data-testid="deck-save" disabled={deckIds.length !== 5 || !dirty} onClick={saveDeck}>
              {dirty ? 'Save deck' : 'Saved'}
            </button>
            <span className="muted">
              {deckIds.length === 5 ? 'Ready to play' : `Pick ${5 - deckIds.length} more below`}
            </span>
          </div>

          <p className="muted">
            Presets{' '}
            {DECK_PRESETS.map((preset) => {
              const ready = Boolean(resolvePresetDeck(save.collection, preset.templates));
              return (
                <button
                  key={preset.id}
                  className="btn ghost small"
                  type="button"
                  disabled={!ready}
                  title={ready ? 'Fill the five slots from this list' : 'Own all five templates first'}
                  onClick={() => {
                    const ids = resolvePresetDeck(save.collection, preset.templates);
                    if (ids) setDeckIds(ids);
                  }}
                >
                  {preset.name}
                </button>
              );
            })}
          </p>

          <div className="filters">
            <input placeholder="Filter name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter deck candidates" />
          </div>
          <div className="album">
            {list.map((c) => (
              <CardFace
                key={c.instanceId}
                card={c}
                selected={deckIds.includes(c.instanceId)}
                onSelect={() => toggleDeck(c.instanceId)}
                onInspect={() => setInspect(c.instanceId)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'shop' && (
        <>
          <p className="muted">
            Seals buy sealed packs. Packs favour cards you do not own, but what you get is the luck of the draw.
          </p>
          <div className="pack-shelf">
            {PACK_TIERS.map((tier) => {
              const afford = save.seals >= tier.cost;
              const room = slots >= tier.size;
              return (
                <div key={tier.id} className={`pack-tile ${!afford || !room ? 'locked' : ''}`}>
                  <PackArt tierId={tier.id} />
                  <h3>{tier.name}</h3>
                  <p className="muted">{tier.blurb}</p>
                  <ul className="pack-odds">
                    <li>{tier.size} cards</li>
                    {(['common', 'uncommon', 'rare', 'relic'] as const)
                      .filter((r) => tier.weights[r])
                      .map((r) => (
                        <li key={r}>
                          {r} {tier.weights[r]}%
                        </li>
                      ))}
                    {tier.floor && <li className="guaranteed">{tier.floor}+ guaranteed</li>}
                  </ul>
                  <button
                    className="btn"
                    type="button"
                    data-testid={`buy-${tier.id}`}
                    disabled={!afford || !room}
                    onClick={() => buy(tier.id)}
                  >
                    {tier.cost} seals
                  </button>
                  {!room && afford && <p className="muted">Needs {tier.size} free slots</p>}
                </div>
              );
            })}
          </div>
          {shopMsg && (
            <p role="status" data-testid="shop-msg">
              {shopMsg}
            </p>
          )}
        </>
      )}

      <h3>Lore</h3>
      {save.loreIds.length === 0 && <p className="muted">Nothing recorded yet.</p>}
      {save.loreIds.map((id) => (
        <p key={id}>
          <strong>{LORE[id]?.title}</strong> — {LORE[id]?.body}
        </p>
      ))}

      {card && <InspectPanel card={card} collection={save.collection} onClose={() => setInspect(null)} />}

      {doomed && impact && (
        <div className="modal" role="dialog" aria-label="Confirm discard">
          <div className="modal-card" data-testid="discard-confirm">
            <h2>Discard {doomed.displayName}?</h2>
            {impact.points > 0 ? (
              <div className="warn-block" data-testid="discard-warning">
                <p>
                  <strong>This costs you {impact.points} collector points.</strong>
                </p>
                <ul>
                  {impact.reasons.map((r) => (
                    <li key={r}>It is {r}</li>
                  ))}
                </ul>
                <p className="muted">
                  {rank.points} → {rank.points - impact.points} · {rank.title}
                </p>
              </div>
            ) : (
              <p data-testid="discard-safe">
                A duplicate — no collector points lost. {safeRarity(doomed.templateId)} card.
              </p>
            )}
            <button
              className="btn"
              type="button"
              data-testid="discard-confirm-yes"
              onClick={() => {
                patch((s) => discardCard(s, doomed.instanceId));
                setConfirmDiscard(null);
              }}
            >
              Discard it
            </button>{' '}
            <button className="btn ghost" type="button" onClick={() => setConfirmDiscard(null)}>
              Keep it
            </button>
          </div>
        </div>
      )}

      {opening && (
        <PackOpening
          tier={PACK_TIERS.find((t) => t.id === opening.tierId)!}
          cards={opening.cards}
          newTemplateIds={opening.fresh}
          onClose={() => setOpening(null)}
        />
      )}
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
