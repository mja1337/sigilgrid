import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLLECTOR_MAX, collectorScore } from '@sigilgrid/core';
import {
  DECK_PRESETS,
  LORE,
  PACK_SIZE,
  SEAL_PACK_COST,
  resolvePresetDeck,
  sealCost,
  unownedTemplates,
} from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { CardFace, InspectPanel } from '../components/CardFace.tsx';
import { buyPack, buyTemplate } from '../progress.ts';

export function CollectionScreen() {
  const { save, patch } = useGame();
  const [q, setQ] = useState('');
  const [klass, setKlass] = useState('');
  const [inspect, setInspect] = useState<string | null>(null);
  const [deckIds, setDeckIds] = useState<string[]>(save.decks.find((d) => d.id === save.activeDeckId)?.instanceIds ?? []);
  const [shopMsg, setShopMsg] = useState('');

  useEffect(() => {
    setDeckIds(save.decks.find((d) => d.id === save.activeDeckId)?.instanceIds ?? []);
  }, [save.activeDeckId]);

  const list = useMemo(() => {
    return save.collection.filter((c) => {
      if (q && !c.displayName.toLowerCase().includes(q.toLowerCase())) return false;
      if (klass && c.battleClass !== klass) return false;
      return true;
    });
  }, [save.collection, q, klass]);

  const card = inspect ? save.collection.find((c) => c.instanceId === inspect) : null;
  const rank = collectorScore(save.collection);
  const missing = unownedTemplates(save.collection);
  const active = save.decks.find((d) => d.id === save.activeDeckId);

  function applyShop(next: ReturnType<typeof buyPack>) {
    if (typeof next === 'string') {
      setShopMsg(next);
      return;
    }
    setShopMsg('');
    patch(() => next);
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Workshop</div>
      </div>
      <div className="collector-hud" data-testid="collector-rank">
        <strong>{rank.title}</strong>
        {' '}
        {rank.points}/{COLLECTOR_MAX} collector points
        <div className="collector-track" aria-hidden>
          <span style={{ width: `${(rank.points / COLLECTOR_MAX) * 100}%` }} />
        </div>
        <span>
          {rank.uniqueTypes}/100 unique cards · {rank.uniqueArrows} arrow patterns · {rank.classA} A / {rank.classX} X
          {' · '}
          {save.seals} seals
        </span>
      </div>
      <div className="filters">
        <input placeholder="Filter name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by name" />
        <select value={klass} onChange={(e) => setKlass(e.target.value)} aria-label="Filter class">
          <option value="">All classes</option>
          {['P', 'M', 'X', 'A'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <span>{list.length} shown · long-press or double-click a card to inspect stats and XP</span>
      </div>
      <p>
        Active deck{' '}
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
        {' '}
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            const id = `custom-${save.decks.length + 1}`;
            const instanceIds = deckIds.length === 5 ? deckIds : save.collection.slice(0, 5).map((c) => c.instanceId);
            patch((s) => ({
              ...s,
              decks: [...s.decks, { id, name: `Custom ${s.decks.length + 1}`, instanceIds }],
              activeDeckId: id,
            }));
          }}
        >
          New deck
        </button>
      </p>
      <p>
        Presets{' '}
        {DECK_PRESETS.map((preset) => {
          const ready = Boolean(resolvePresetDeck(save.collection, preset.templates));
          return (
            <button
              key={preset.id}
              className="btn ghost"
              type="button"
              disabled={!ready}
              title={ready ? 'Apply this five-card list' : 'Own all five templates first'}
              onClick={() => {
                const instanceIds = resolvePresetDeck(save.collection, preset.templates);
                if (!instanceIds) return;
                patch((s) => {
                  const exists = s.decks.some((d) => d.id === preset.id);
                  const decks = exists
                    ? s.decks.map((d) => (d.id === preset.id ? { ...d, name: preset.name, instanceIds } : d))
                    : [...s.decks, { id: preset.id, name: preset.name, instanceIds }];
                  return { ...s, decks, activeDeckId: preset.id };
                });
              }}
            >
              {preset.name}
            </button>
          );
        })}
      </p>
      <div className="album">
        {list.map((c) => (
          <CardFace
            key={c.instanceId}
            card={c}
            selected={deckIds.includes(c.instanceId)}
            onSelect={() => {
              setDeckIds((ids) => {
                if (ids.includes(c.instanceId)) return ids.filter((x) => x !== c.instanceId);
                if (ids.length >= 5) return ids;
                return [...ids, c.instanceId];
              });
            }}
            onInspect={() => setInspect(c.instanceId)}
          />
        ))}
      </div>
      <p>Deck ({deckIds.length}/5){active ? ` · ${active.name}` : ''}</p>
      <button
        className="btn"
        disabled={deckIds.length !== 5}
        onClick={() =>
          patch((s) => ({
            ...s,
            decks: s.decks.map((d) => (d.id === s.activeDeckId ? { ...d, instanceIds: deckIds } : d)),
          }))
        }
      >
        Save active deck
      </button>
      <h3>Seal shop</h3>
      <p>Seals are spent here. A pack prefers cards you do not yet own.</p>
      <button
        className="btn"
        type="button"
        data-testid="buy-pack"
        onClick={() => applyShop(buyPack(save, save.collection.length * 17 + save.seals))}
      >
        Buy pack of {PACK_SIZE} ({SEAL_PACK_COST} seals)
      </button>
      {shopMsg && <p role="status">{shopMsg}</p>}
      <div className="album">
        {missing.map((t) => (
          <button
            key={t.templateId}
            className="btn ghost"
            type="button"
            data-testid={`buy-${t.templateId}`}
            onClick={() => applyShop(buyTemplate(save, t.templateId))}
          >
            {t.displayName} · {t.rarity} · {sealCost(t.rarity)} {sealCost(t.rarity) === 1 ? 'seal' : 'seals'}
          </button>
        ))}
      </div>
      <h3>Lore</h3>
      {save.loreIds.map((id) => (
        <p key={id}>
          <strong>{LORE[id]?.title}</strong> — {LORE[id]?.body}
        </p>
      ))}
      {card && <InspectPanel card={card} collection={save.collection} onClose={() => setInspect(null)} />}
    </div>
  );
}
