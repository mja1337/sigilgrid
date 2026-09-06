import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  applyActions,
  claimImpact,
  concludeIfOver,
  createMatch,
  legalCells,
  previewPlacement,
  reduce,
  scoreBoard,
  STAT_LABEL,
  strategyByName,
  type ClaimImpact,
  type GameAction,
  type MatchEvent,
  type CardInstance,
  type MatchConfig,
  type MatchState,
  type PlacementPreview,
} from '@sigilgrid/core';
import { COLLECTION_CAP, CONTENT_VERSION, encounterById, instantiateId, LORE } from '@sigilgrid/content';
import { StoredReplay } from '@sigilgrid/protocol';
import { useGame } from '../GameContext.tsx';
import {
  activeDeckSummary,
  applyMatchToSave,
  circuitFinished,
  claimLoot,
  deckCardsForMatch,
  heldCardsForMatch,
  isReclaimableLoot,
  lootCandidates,
} from '../progress.ts';
import { ROLL_SETTLE_MS } from '../components/rollTiming.ts';
import { BoardView } from '../components/Board.tsx';
import { CardBack } from '../components/CardBack.tsx';
import { CardFace, InspectPanel } from '../components/CardFace.tsx';
import { CombatOverlay } from '../components/CombatOverlay.tsx';
import { dailyChallenge, todayKey } from '../daily.ts';

/** Matches the card-capture flip in theme.css, with a beat of slack. */
const CAPTURE_SETTLE_MS = 600;

function cardsFromTemplates(ids: string[], seed: number, prefix: string) {
  return ids.map((id, i) => instantiateId(id, seed + i * 31, prefix === 'p' ? 'starter' : 'event', `${prefix}-${id}-${i}`));
}

export function PlayScreen() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { save, patch } = useGame();
  const mode = params.get('mode') ?? 'practice';
  const encounterParam = params.get('encounter');
  const encounterId = encounterParam ?? (mode === 'story' ? 't1' : '');
  const seed = Number(params.get('seed') ?? String(Date.now() % 100000));
  const wager = params.get('wager') === '1';
  const encounter = encounterId ? encounterById(encounterId) : undefined;
  const scriptedBoard = Boolean(encounter && (mode === 'story' || mode === 'wager' || mode === 'challenge'));
  const dailyDate = params.get('date') ?? todayKey();
  const daily = mode === 'daily' ? dailyChallenge(dailyDate) : null;

  const [dialogue, setDialogue] = useState<'pre' | 'play' | 'post' | 'loot' | 'epilogue'>('pre');
  const [lootTaken, setLootTaken] = useState<string | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focusCell, setFocusCell] = useState(0);
  const [inspect, setInspect] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [orderPick, setOrderPick] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [showKickoff, setShowKickoff] = useState(true);
  const [boardSettled, setBoardSettled] = useState(false);
  const [tutorialSkipped, setTutorialSkipped] = useState(false);
  const [combatEvents, setCombatEvents] = useState<MatchEvent[] | null>(null);
  const [fx, setFx] = useState<{ placed?: number; captured?: number[] }>({});
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragOrigin = useRef<{ id: string; x: number; y: number } | null>(null);
  const placingRef = useRef(false);
  const aiGen = useRef(0);
  const combatDone = useRef<(() => void) | null>(null);
  const initialConfig = useRef<MatchConfig | null>(null);

  const playerCards = useMemo(() => {
    if (encounter?.playerTemplates) return cardsFromTemplates(encounter.playerTemplates, seed, 'p');
    return deckCardsForMatch(save);
  }, [encounter, save, seed]);
  const deckSummary = useMemo(() => activeDeckSummary(save), [save]);

  function startMatch() {
    const regularOpp = cardsFromTemplates(
      encounter?.opponentTemplates ?? daily?.opponentTemplates ?? ['goblin', 'fang', 'skeleton', 'flan', 'bomb'],
      seed + 99,
      'o',
    );
    const returning = wager && encounter
      ? heldCardsForMatch(save, encounter.id, seed)
      : [];
    const opp = [...returning, ...regularOpp].slice(0, 5);
    const p = encounter?.playerTemplates ? cardsFromTemplates(encounter.playerTemplates, seed, 'p') : playerCards;
    const config: MatchConfig = {
      seed,
      playerCards: p.slice(0, 5),
      opponentCards: opp.slice(0, 5),
      blockedCells: scriptedBoard ? encounter!.blockedCells : daily?.blockedCells,
      firstPlayer: scriptedBoard ? encounter!.firstPlayer : daily?.firstPlayer,
      stakes: wager ? 'wager' : 'safe',
      contentVersion: CONTENT_VERSION,
      matchId: `local-${seed}-${encounterId || mode}`,
    };
    initialConfig.current = config;
    const match = createMatch(config);
    setState(match);
    setActions([]);
    setShowKickoff(true);
    setTutorialSkipped(false);
    setDialogue('play');
  }

  function dismissKickoff() {
    if (!state) return;
    setShowKickoff(false);
    if (state.currentPlayer === 'opponent') {
      void runAi(state, []);
    }
  }

  function sleep(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
  }

  function timing() {
    const m = save.settings.animationSpeed === 'slow' ? 1.35 : save.settings.animationSpeed === 'fast' ? 0.55 : 1;
    const f = save.settings.fastResolve ? 0.55 : 1;
    return {
      think: Math.round(720 * m * f),
      place: Math.round(520 * m * f),
      // Never shorter than the roll, or the overlay would close mid-spin.
      combat: Math.max(ROLL_SETTLE_MS + 700, Math.round(2400 * m * f)),
    };
  }

  function playCombat(events: MatchEvent[]): Promise<void> {
    // Board FX still flash for unopposed captures; only a clash or a combo is
    // worth stopping the turn for.
    const interesting = events.filter((e) => e.kind === 'battle' || e.kind === 'combo');
    if (!interesting.length) {
      setFx((cur) => ({
        ...cur,
        captured: events.filter((e) => e.kind === 'unopposed').map((e) => e.cell),
      }));
      return Promise.resolve();
    }
    const captured = [
      ...events.filter((e) => e.kind === 'unopposed').map((e) => e.cell),
      ...events.filter((e) => e.kind === 'combo').flatMap((e) => e.convertedCells),
      ...events.filter((e) => e.kind === 'battle').map((e) => (e.winner === 'player' || e.winner === 'opponent' ? e.targetCell : e.placedCell)),
    ];
    setFx((cur) => ({ ...cur, captured }));
    return new Promise((resolve) => {
      combatDone.current = resolve;
      setCombatEvents(events);
    });
  }

  function finishCombat() {
    setCombatEvents(null);
    combatDone.current?.();
    combatDone.current = null;
  }

  async function runAi(from: MatchState, prev: GameAction[]) {
    const token = ++aiGen.current;
    if (from.currentPlayer !== 'opponent') return;
    if (from.phase === 'ended' || from.phase === 'masteryChoice') return;
    setBusy(true);
    const ai = strategyByName(encounter?.ai ?? daily?.ai ?? (params.get('ai') as 'easy' | 'standard' | 'expert') ?? 'standard');
    const d = timing();
    let cur = from;
    let acts = [...prev];
    let guard = 8;
    try {
      while (cur.currentPlayer === 'opponent' && cur.phase !== 'ended' && cur.phase !== 'masteryChoice' && guard-- > 0) {
        if (token !== aiGen.current) return;
        if (cur.phase === 'placing') {
          const open = legalCells(cur);
          if (open.length === 0 || cur.hands.opponent.length === 0) {
            cur = concludeIfOver(cur).nextState;
            break;
          }
          await sleep(d.think);
          if (token !== aiGen.current) return;
        }
        const action = ai.choose(cur, encounter?.personality);
        const { nextState, events } = reduce(cur, action);
        if (events.some((e) => e.kind === 'illegal')) {
          cur = concludeIfOver(cur).nextState;
          break;
        }
        acts.push(action);
        cur = nextState;
        const placed = events.find((e) => e.kind === 'place');
        setFx({
          placed: placed && placed.kind === 'place' ? placed.cell : undefined,
          captured: [],
        });
        setActions(acts);
        setState(cur);
        if (placed) await sleep(d.place);
        if (token !== aiGen.current) return;
        await playCombat(events);
        if (token !== aiGen.current) return;
      }
      setActions(acts);
      setState(cur);
    } finally {
      // An abandoned turn must still release the board, or nothing downstream
      // of `busy` — the result screen included — ever runs again.
      if (token === aiGen.current) setBusy(false);
    }
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y);
    const cell = el?.closest<HTMLElement>('[data-testid^="cell-"]');
    if (!cell) return null;
    const n = Number(cell.dataset.testid?.replace('cell-', ''));
    return Number.isInteger(n) ? n : null;
  }

  function tryPlace(instanceId: string, cell: number) {
    if (!state || busy || showKickoff || combatEvents) return;
    if (state.currentPlayer !== 'player' || state.phase !== 'placing') return;
    if (!legalCells(state).includes(cell)) return;
    if (placingRef.current) return;
    placingRef.current = true;
    void commit({ type: 'place', instanceId, cell });
  }

  function onHandPointerDown(e: React.PointerEvent, instanceId: string) {
    if (busy || showKickoff || combatEvents) return;
    if (state?.currentPlayer !== 'player') return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer already released or retargeted; the window listeners still
      // drive the drag, so this is not worth throwing over.
    }
    setSelected(instanceId);
    setPreview(null);
    dragOrigin.current = { id: instanceId, x: e.clientX, y: e.clientY };
  }

  function onHandPointerUp(e: React.PointerEvent | PointerEvent) {
    const origin = dragOrigin.current;
    const wasDrag = Boolean(drag);
    dragOrigin.current = null;
    setDrag(null);
    const cell = cellFromPoint(e.clientX, e.clientY);
    setHoverCell(null);
    if (wasDrag && origin && cell !== null) {
      tryPlace(origin.id, cell);
    }
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      const origin = dragOrigin.current;
      if (!origin) return;
      const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
      if (dist < 10 && !drag) return;
      setDrag({ id: origin.id, x: e.clientX, y: e.clientY });
      const cell = cellFromPoint(e.clientX, e.clientY);
      setHoverCell(cell);
      if (cell !== null && state) {
        const nextPrev = previewPlacement(state, origin.id, cell);
        if (nextPrev) setPreview(nextPrev);
      }
    }
    function up(e: PointerEvent) {
      onHandPointerUp(e);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });

  async function commit(action: GameAction) {
    if (!state || busy || showKickoff || combatEvents) {
      placingRef.current = false;
      return;
    }
    const { nextState, events } = reduce(state, action);
    if (events.some((e) => e.kind === 'illegal')) {
      placingRef.current = false;
      return;
    }
    const nextActs = [...actions, action];
    setActions(nextActs);
    setSelected(null);
    setPreview(null);
    setHoverCell(null);
    setDrag(null);
    setOrderPick([]);
    const placed = events.find((e) => e.kind === 'place');
    setFx({
      placed: placed && placed.kind === 'place' ? placed.cell : undefined,
      captured: [],
    });
    setState(nextState);
    await playCombat(events);
    placingRef.current = false;
    if (nextState.currentPlayer === 'opponent' && nextState.phase !== 'ended' && nextState.phase !== 'masteryChoice') {
      void runAi(nextState, nextActs);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (dialogue !== 'play' || !state) return;
      if (e.key === 'Escape') {
        setSelected(null);
        setPreview(null);
        return;
      }
      const map: Record<string, number> = { ArrowUp: -4, ArrowDown: 4, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in map) {
        e.preventDefault();
        setFocusCell((c) => {
          const n = c + map[e.key]!;
          return n >= 0 && n < 16 ? n : c;
        });
      }
      if (e.key === 'Enter' && selected && !showKickoff) {
        commit({ type: 'place', instanceId: selected, cell: focusCell });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const matchKey = `${mode}:${encounterId}:${seed}:${wager ? 1 : 0}`;

  useEffect(() => {
    setState(null);
    setActions([]);
    setSelected(null);
    setPreview(null);
    setOrderPick([]);
    setCombatEvents(null);
    setShowKickoff(true);
    initialConfig.current = null;
    aiGen.current += 1;
    setDialogue(scriptedBoard ? 'pre' : 'play');
  }, [matchKey, mode, scriptedBoard]);

  useEffect(() => {
    if (scriptedBoard) return;
    if (dialogue !== 'play' || state) return;
    startMatch();
  }, [matchKey, dialogue, state, scriptedBoard]);

  useEffect(() => {
    if (!state || busy || showKickoff || combatEvents) return;
    if (state.phase !== 'placing') return;
    if (legalCells(state).length === 0 || state.placementsDone >= 10) {
      const { nextState } = concludeIfOver(state);
      if (nextState.phase !== 'placing') setState(nextState);
    }
  }, [state, busy, showKickoff, combatEvents]);

  const matchOver = Boolean(
    state && (state.phase === 'ended' || (state.phase === 'masteryChoice' && state.pendingMastery.length === 0)),
  );

  /**
   * The result screen waits for the turn to finish playing out: the opponent's
   * last placement, any combat overlay, and the capture flip that follows it.
   * Otherwise it lands mid-animation and cards keep moving behind it.
   */
  useEffect(() => {
    if (!matchOver || busy || combatEvents) {
      setBoardSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setBoardSettled(true), CAPTURE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [matchOver, busy, combatEvents]);

  const score = state ? scoreBoard(state) : { player: 0, opponent: 0 };
  const hand = state ? state.hands.player.map((id) => state.cards[id]!) : [];
  const playerPlacements = state
    ? state.eventLog.filter((event) => event.kind === 'place' && event.player === 'player').length
    : 0;
  const tutorialStep = playerPlacements > 0 ? 2 : selected ? 1 : 0;
  const tutorialHint = tutorialSkipped ? undefined : encounter?.tutorial?.[tutorialStep];
  const ghost = encounter?.id === 't1' && state && tutorialStep === 1
    ? suggestUnopposed(state, selected)
    : undefined;
  const wagerCard = wager
    ? save.collection.find(
        (card) =>
          card.instanceId ===
          save.decks.find((deck) => deck.id === save.activeDeckId)?.instanceIds[0],
      )
    : undefined;

  function afterMatchPath() {
    if (mode === 'story') return '/story';
    if (mode === 'wager') return '/wager';
    if (mode === 'challenge') return '/challenges';
    if (mode === 'daily') return '/daily';
    return '/';
  }

  function finishToSave(
    resultState: MatchState,
    epilogue?: 'seal' | 'use',
    loot?: CardInstance | null,
  ) {
    const replay: StoredReplay | null = initialConfig.current
      ? {
          protocolVersion: 1,
          config: initialConfig.current,
          actions,
          createdAt: new Date().toISOString(),
          mode,
          label: encounter?.title ?? daily?.name ?? `${mode} match`,
          result: resultState.winner ?? undefined,
        }
      : null;
    patch((s) => {
      let next = applyMatchToSave(s, {
        mode,
        encounter,
        result: resultState,
        seed,
        wager,
        epilogue,
        dailyDate: mode === 'daily' ? dailyDate : undefined,
      });
      if (loot && encounter) next = claimLoot(next, loot, encounter.id);
      return replay ? { ...next, replays: [...next.replays, replay].slice(-30) } : next;
    });
  }

  if (mode === 'challenge' && (!circuitFinished(save) || !encounter)) {
    return (
      <div className="app-shell">
        <p data-testid="challenge-locked">Finish the Ashfall Circuit before these rites open.</p>
        <Link className="btn" to="/">Home</Link>
      </div>
    );
  }

  if (scriptedBoard && encounter && dialogue === 'pre') {
    return (
      <div className="modal">
        <div className="modal-card" data-testid="dialogue-pre">
          <p style={{ color: 'var(--gold)' }}>{encounter.opponentName} · {encounter.opponentTitle}</p>
          <h2 style={{ fontFamily: 'var(--font)' }}>{encounter.title}</h2>
          {encounter.pre.map((l, i) => (
            <p key={i}><strong>{l.speaker}:</strong> {l.text}</p>
          ))}
          {wager && <p>Wager Rites: one card from your active deck is at stake if you lose.</p>}
          <p className="deck-note" data-testid="pre-deck-note">
            {encounter.playerTemplates ? (
              <>This lesson deals you a set hand of five. Your own deck returns after the tutorials.</>
            ) : (
              <>
                Taking in <strong>{deckSummary.name}</strong>
                {deckSummary.borrowed > 0 && ` · ${deckSummary.borrowed} filled from your album`}
                {' · '}
                {deckSummary.mix} · {deckSummary.band} ({deckSummary.power}).{' '}
                <Link to="/collection">Change deck</Link>
              </>
            )}
          </p>
          <button className="btn" data-testid="dialogue-continue" onClick={startMatch}>
            Begin rite
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="app-shell">
        <p>Preparing board…</p>
        <button className="btn" onClick={startMatch}>Start</button>
      </div>
    );
  }

  if (dialogue === 'post' && encounter) {
    return (
      <div className="modal">
        <div className="modal-card" data-testid="dialogue-post">
          <h2>Result: {state.winner}</h2>
          {encounter.post.map((l, i) => (
            <p key={i}><strong>{l.speaker}:</strong> {l.text}</p>
          ))}
          {encounter.id === 'a4-r3' && (
            <div>
              <button className="btn" onClick={() => { finishToSave(state, 'seal'); setDialogue('epilogue'); }}>Seal the source</button>
              <button className="btn ghost" onClick={() => { finishToSave(state, 'use'); setDialogue('epilogue'); }}>Use the source</button>
            </div>
          )}
          {encounter.id !== 'a4-r3' && (
            <button
              className="btn"
              data-testid="post-continue"
              onClick={() => {
                if (mode === 'challenge') {
                  finishToSave(state);
                  nav('/challenges');
                  return;
                }
                if (state.winner === 'player' && lootCandidates(state).length > 0) {
                  setDialogue('loot');
                  return;
                }
                finishToSave(state);
                nav('/story');
              }}
            >
              {mode === 'challenge' ? 'Return to rites' : 'Continue circuit'}
            </button>
          )}
          {encounter.practiceRematch && <Link className="btn ghost" to={`/play?mode=story&encounter=${encounter.id}&seed=${seed + 1}`}>Practice rematch</Link>}
        </div>
      </div>
    );
  }

  if (dialogue === 'loot' && encounter) {
    const spoils = lootCandidates(state);
    // First-win packs land in the same save write as the spoil, so ownership
    // has to be judged against the album after those rewards, not before.
    const album = applyMatchToSave(save, {
      mode,
      encounter,
      result: state,
      seed,
      wager,
    }).collection;
    const full = album.length >= COLLECTION_CAP;
    const picked = spoils.find((c) => c.instanceId === lootTaken);
    return (
      <div className="modal">
        <div className="modal-card loot-picker" data-testid="dialogue-loot">
          <h2>Spoils of the rite</h2>
          <p>
            You turned {spoils.length}{' '}
            {spoils.length === 1 ? 'sigil' : 'sigils'} of {encounter.opponentName}&rsquo;s.{' '}
            {spoils.length === 1 ? 'Take it — or leave it.' : 'Take one — or leave them all.'}
          </p>
          {full && (
            <p className="warn-block" data-testid="loot-full">
              Your album is full at {COLLECTION_CAP}. Discard something in the Workshop before you can take a spoil.
            </p>
          )}
          <div className="loot-row">
            {spoils.map((c) => {
              const insight = claimImpact(c, album);
              const reclaimable = isReclaimableLoot(save, c, encounter.id);
              return (
                <button
                  key={c.instanceId}
                  type="button"
                  className={`loot-option ${lootTaken === c.instanceId ? 'chosen' : ''}`}
                  data-testid={`loot-${c.templateId}`}
                  disabled={full}
                  onClick={() => setLootTaken(lootTaken === c.instanceId ? null : c.instanceId)}
                >
                  <CardFace card={c} />
                  <span className="loot-tags" data-testid={`loot-owned-${c.instanceId}`}>
                    {reclaimable && <span className="loot-tag reclaim">Yours to reclaim</span>}
                    <span className={`loot-tag ${insight.newType ? 'new' : 'have'}`}>
                      {insight.newType ? 'New card' : 'Have this card'}
                    </span>
                    <span className={`loot-tag ${insight.newArrows ? 'new' : 'have'}`}>
                      {insight.newArrows ? 'New pattern' : 'Have this pattern'}
                    </span>
                    {insight.classGain > 0 && (
                      <span className="loot-tag gain">Better class</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="muted" data-testid="loot-choice">
            {picked
              ? `Taking ${picked.displayName} — ${lootSummary(claimImpact(picked, album))}`
              : 'Nothing selected'}
          </p>
          <button
            className="btn"
            data-testid="loot-confirm"
            onClick={() => {
              const prize = spoils.find((c) => c.instanceId === lootTaken) ?? null;
              finishToSave(state, undefined, prize);
              nav(afterMatchPath());
            }}
          >
            {lootTaken ? 'Take it and continue' : 'Take nothing'}
          </button>
        </div>
      </div>
    );
  }

  if (dialogue === 'epilogue') {
    const key = save.campaign.epilogue ?? 'seal';
    return (
      <div className="modal">
        <div className="modal-card">
          <h2>{key === 'seal' ? 'Sealed' : 'Used'}</h2>
          <p>{LORE.ending.body}</p>
          <p>This choice is narrative and cosmetic. The grid’s balance is unchanged.</p>
          <Link className="btn" to="/">Return</Link>
        </div>
      </div>
    );
  }

  const inspectCard = inspect ? state.cards[inspect] : null;

  return (
    <div className="app-shell play-shell">
      <div className="topbar">
        <Link to="/" className="brand">Sigil Grid<small>Ashfall</small></Link>
        <div>
          {daily ? `${daily.name} · ` : ''}{mode} · seed {seed} · {score.player}:{score.opponent}
        </div>
      </div>
      {tutorialHint && (
        <aside className="tutorial-coach" data-testid="tutorial-hint" aria-live="polite">
          <span>{tutorialHint.message}</span>
          <button className="btn ghost small" type="button" onClick={() => setTutorialSkipped(true)}>
            Skip guidance
          </button>
        </aside>
      )}
      <div className={`play-layout play-table turn-${state.currentPlayer} ${busy ? 'busy' : ''} ${selected ? 'has-pick' : ''}`}>
        <aside className={`opp-hand ${state.currentPlayer === 'opponent' ? 'active-seat' : ''}`} aria-label="Opponent hand">
          <div className="name-plate">{encounter?.opponentName ?? 'Opponent'}</div>
          <div className="hand-stack">
            {state.hands.opponent.map((id) => (
              <CardBack key={id} variant={save.backId} label="Facedown card" />
            ))}
          </div>
        </aside>
        <div className="play-main">
          <div
            className={`turn-banner turn-${state.currentPlayer}`}
            data-testid={`turn-${state.currentPlayer}`}
            aria-live="polite"
          >
            <span className="turn-kicker">
              {state.firstPlayer === 'player' ? 'You won the coin toss' : 'Opponent won the coin toss'}
            </span>
            {state.currentPlayer === 'player'
              ? selected
                ? 'Tap a square — or drag the card onto it'
                : 'Pick a card, then place it'
              : `${encounter?.opponentName ?? 'Opponent'} is placing…`}
          </div>
          <div className="board-frame">
          <BoardView
            state={state}
            selectedId={selected}
            focusCell={focusCell}
            preview={save.settings.tacticalPreview ? preview : null}
            ghostCell={ghost}
            placedCell={fx.placed}
            capturedCells={fx.captured}
            hoverCell={hoverCell}
            combatEvents={combatEvents}
            onCellEnter={(i) => {
              if (!selected || showKickoff || combatEvents) return;
              if (state.currentPlayer !== 'player') return;
              const nextPrev = previewPlacement(state, selected, i);
              if (nextPrev) setPreview(nextPrev);
              setHoverCell(i);
            }}
            onCell={(i) => {
              if (showKickoff || combatEvents || (state.currentPlayer !== 'player' && state.phase === 'placing')) return;
              setFocusCell(i);
              if (state.phase === 'chooseBattleOrder' && state.pendingBattle?.contestedCells.includes(i)) {
                setOrderPick((o) => (o.includes(i) ? o : [...o, i]));
                return;
              }
              if (!selected) return;
              tryPlace(selected, i);
            }}
          />
          </div>
          {state.phase === 'chooseBattleOrder' && state.pendingBattle && (
            <div>
              <p>Choose battle order (tap contested cells), then confirm. This is a tactical decision.</p>
              <button
                className="btn"
                data-testid="battle-order-confirm"
                onClick={() =>
                  commit({
                    type: 'chooseBattleOrder',
                    order: orderPick.length === state.pendingBattle!.contestedCells.length
                      ? orderPick
                      : state.pendingBattle!.contestedCells,
                  })
                }
              >
                Resolve battles
              </button>
            </div>
          )}
        </div>
        <aside className={`player-hand ${state.currentPlayer === 'player' ? 'active-seat' : ''}`}>
          <div
            className="hand-row hand-column"
            aria-label="Your hand"
            onPointerLeave={() => {
              if (!drag) setHoverCell(null);
            }}
          >
            {hand.map((c) => (
              <CardFace
                key={c.instanceId}
                card={c}
                owner="player"
                selected={selected === c.instanceId}
                dragging={drag?.id === c.instanceId}
                onSelect={() => {
                  setSelected(c.instanceId);
                  setPreview(null);
                }}
                onInspect={() => setInspect(c.instanceId)}
                onPointerDown={(e) => onHandPointerDown(e, c.instanceId)}
              />
            ))}
          </div>
        </aside>
      </div>
      {drag && state.cards[drag.id] && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardFace card={state.cards[drag.id]!} owner="player" compact />
        </div>
      )}
      {!combatEvents && state.phase === 'masteryChoice' && state.pendingMastery[0] && (
        <div className="modal">
          <div className="modal-card">
            <h2>Mastery choice</h2>
            {state.pendingMastery[0].options.map((o, i) => (
              <button
                key={i}
                className="btn"
                data-testid={`mastery-${i}`}
                onClick={() =>
                  commit({
                    type: 'chooseMasteryUpgrade',
                    instanceId: state.pendingMastery[0]!.instanceId,
                    optionIndex: i as 0 | 1,
                  })
                }
              >
                {STAT_LABEL[o.stat]} +1 pip
              </button>
            ))}
          </div>
        </div>
      )}
      {boardSettled && !combatEvents && matchOver && dialogue === 'play' && (
        <div className="modal">
          <div className="modal-card" data-testid="match-over">
            <h2>Match {state.winner}</h2>
            <p>
              {score.player} to {score.opponent}
            </p>
            {wager && state.winner === 'opponent' && wagerCard && (
              <p className="warn-block" data-testid="wager-forfeit">
                {encounter?.opponentName ?? 'Your opponent'} takes {wagerCard.displayName}.
                They are likely to play it in your next wager, so you can win it back.
              </p>
            )}
            <button
              className="btn"
              data-testid="match-continue"
              onClick={() => {
                if ((mode === 'story' || mode === 'challenge') && encounter && state.winner === 'player') {
                  setDialogue('post');
                } else if (
                  mode === 'wager' &&
                  encounter &&
                  state.winner === 'player' &&
                  lootCandidates(state).length > 0
                ) {
                  setDialogue('loot');
                } else {
                  finishToSave(state);
                  nav(afterMatchPath());
                }
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {combatEvents && state && (
        <CombatOverlay
          events={combatEvents}
          state={state}
          autoMs={timing().combat}
          onDone={finishCombat}
        />
      )}
      {showKickoff && state.placementsDone === 0 && state.phase === 'placing' && (
        <div className="modal" role="dialog" aria-label="Who places first">
          <div className="modal-card" data-testid="kickoff">
            <div className="kickoff-coin" aria-hidden>◉</div>
            <p style={{ color: 'var(--gold)', letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              The coin is cast
            </p>
            <h2 style={{ fontFamily: 'var(--font)', margin: '0.2rem 0 0.6rem' }}>
              {state.firstPlayer === 'player' ? 'You place first' : `${encounter?.opponentName ?? 'Opponent'} places first`}
            </h2>
            <p>
              {state.board.filter((c) => c.blocked).length} closed spaces on the grid.
              Last placement is an advantage — the coin decides who claims it.
            </p>
            <button className="btn" data-testid="kickoff-continue" onClick={dismissKickoff}>
              To the grid
            </button>
          </div>
        </div>
      )}
      {inspectCard && (
        <InspectPanel card={inspectCard} collection={save.collection} onClose={() => setInspect(null)} />
      )}
    </div>
  );
}

function lootSummary(insight: ClaimImpact): string {
  const bits = [
    insight.newType ? 'new card' : 'have this card',
    insight.newArrows ? 'new pattern' : 'have this pattern',
  ];
  if (insight.classGain > 0) bits.push('better class');
  if (insight.points > 0) bits.push(`+${insight.points}`);
  else bits.push('no collector gain');
  return bits.join(' · ');
}

function suggestUnopposed(state: MatchState, selected: string | null): number | undefined {
  const id = selected ?? state.hands.player[0];
  if (!id) return undefined;
  for (const cell of legalCells(state)) {
    const p = previewPlacement(state, id, cell);
    if (p && p.unopposed.length) return cell;
  }
  return legalCells(state)[0];
}

void applyActions;
