import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LORE } from '@sigilgrid/content';
import { useGame } from '../GameContext.tsx';
import { CardFace, InspectPanel } from '../components/CardFace.tsx';

export function CollectionScreen() {
  const { save, patch } = useGame();
  const [q, setQ] = useState('');
  const [klass, setKlass] = useState('');
  const [inspect, setInspect] = useState<string | null>(null);
  const [deckIds, setDeckIds] = useState<string[]>(save.decks.find((d) => d.id === save.activeDeckId)?.instanceIds ?? []);

  const list = useMemo(() => {
    return save.collection.filter((c) => {
      if (q && !c.displayName.toLowerCase().includes(q.toLowerCase())) return false;
      if (klass && c.battleClass !== klass) return false;
      return true;
    });
  }, [save.collection, q, klass]);

  const card = inspect ? save.collection.find((c) => c.instanceId === inspect) : null;

  return (
    <div className="app-shell">
      <div className="topbar">
        <Link to="/">Home</Link>
        <div className="brand">Workshop</div>
      </div>
      <div className="filters">
        <input placeholder="Filter name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by name" />
        <select value={klass} onChange={(e) => setKlass(e.target.value)} aria-label="Filter class">
          <option value="">All classes</option>
          {['P', 'M', 'X', 'A'].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <span>{list.length} shown · arrows/mastery/provenance on inspect</span>
      </div>
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
      <p>Deck ({deckIds.length}/5)</p>
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
      <h3>Lore</h3>
      {save.loreIds.map((id) => (
        <p key={id}>
          <strong>{LORE[id]?.title}</strong> — {LORE[id]?.body}
        </p>
      ))}
      {card && <InspectPanel card={card} onClose={() => setInspect(null)} />}
    </div>
  );
}
