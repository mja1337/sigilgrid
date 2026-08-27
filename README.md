# Sigil Grid: Ashfall

A mobile-first, single-player collectible card game for the browser. Players are Wayfinders carrying engraved creature-and-relic sigils. City-states settle disputes on the Grid while the Ashfall unmakes conventional war.

Inspired by directional tactical card games. Original world, rules presentation, and art. No franchise names, characters, or assets appear in the product.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:5174` (this project uses 5174 so it does not collide with other Vite apps on 5173). Story Circuit starts with three tutorial rites, then the rest of the twelve-encounter campaign.

## Mobile

The play screen is sized to fit one phone screen with no scrolling in either
axis: card size is solved from whichever runs out first, five cards across the
hand or four board rows down, against `100dvh` so it adapts to browser chrome.
Landscape keeps the seats beside the board and lays the hand out two-wide.
Placement works by tap-to-select then tap-a-square, or by dragging a card onto
the grid; long-press a card anywhere to inspect its stats, arrows and mastery.

## Collecting

The album holds **100 cards**, matching the template count, so a perfect album
is exactly full. Cards arrive three ways: story rewards, spoils taken from an
opponent, and sealed packs bought with seals.

| Pack | Cost | Cards | Odds |
| --- | --- | --- | --- |
| Ashfall Wrap | 2 seals | 3 | common 70 / uncommon 25 / rare 5 |
| Ember Seal | 5 seals | 3 | common 40 / uncommon 35 / rare 20 / relic 5 |
| Black Lantern | 10 seals | 5 | uncommon 40 / rare 40 / relic 20, rare+ guaranteed |

Packs favour templates you do not own, but the draw is the draw — there is no
way to buy a specific card. Winning a story rite offers the opponent cards you
turned; take one or leave them.

Collector points come from unique types (10 each), unique arrow patterns (5)
and best class per template (X 1, A 2). Discarding is therefore not free: the
Workshop computes the exact cost before you confirm, warning when a card is
your only copy of its type, the only holder of its arrow pattern, or your best
class for that template.

## Saves

Progress is held in `localStorage` under `sigilgrid.save.v1`, so it is per-browser
and per-device. Settings offers **Export save** (downloads
`sigilgrid-save-YYYY-MM-DD.json`, falling back to the clipboard where a browser
blocks scripted downloads) and **Import save** (file picker, or paste the JSON).
Imports are shape-checked before anything is written, so a corrupt file is
refused rather than persisted, and an older save is reconciled against the
current content version on the way in.

## Stack

TypeScript monorepo:

- `packages/core` — deterministic rules, seeded RNG, AI strategies
- `packages/protocol` — `MatchTransport`, snapshots, local transport
- `packages/content` — 100 card templates, the twelve-encounter campaign, lore
- `apps/web` — React UI, localStorage saves, GitHub Pages build

The client never mutates board state. `reduce(state, action)` returns `{ nextState, events }`. Core never calls `Math.random()`.

## Test

```bash
npm test          # unit + rules suites across all workspaces
npm run test:e2e  # Playwright, chromium + mobile (iPhone 13) projects
```

The end-to-end suite needs browsers once per machine:

```bash
npx playwright install chromium
```

## GitHub Pages

```bash
VITE_BASE=/sigilgrid/ npm run build
```

Upload `apps/web/dist`. Set the Pages source to that folder (or configure your CI to publish it). `base` must match the repo subpath.

## Future multiplayer

`MatchTransport` is implemented locally. A later server should be authoritative: clients send placement and choice actions only; the server verifies turn, ownership, legal cells, deck identity, and seeded RNG; it emits append-only events. Do not trust client rolls. Replay stores seed, content/rules version, and the action sequence.

Hooks reserved (not built): async play, reconnect tokens, time controls, private hands, spectators, matchmaking, cosmetic-only monetisation, anti-cheat validation.
