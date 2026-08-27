# Sigil Grid: Ashfall

A mobile-first, single-player collectible card game for the browser. Players are Wayfinders carrying engraved creature-and-relic sigils. City-states settle disputes on the Grid while the Ashfall unmakes conventional war.

Inspired by directional tactical card games. Original world, rules presentation, and art. No franchise names, characters, or assets appear in the product.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:5174` (this project uses 5174 so it does not collide with other Vite apps on 5173). Story Circuit starts with three tutorial rites, then the rest of the twelve-encounter campaign.

## Stack

TypeScript monorepo:

- `packages/core` — deterministic rules, seeded RNG, AI strategies
- `packages/protocol` — `MatchTransport`, snapshots, local transport
- `packages/content` — 36 templates, campaign, lore
- `apps/web` — React UI, localStorage saves, GitHub Pages build

The client never mutates board state. `reduce(state, action)` returns `{ nextState, events }`. Core never calls `Math.random()`.

## Test

```bash
npm test
npm run test:e2e
```

## GitHub Pages

```bash
VITE_BASE=/sigilgrid/ npm run build
```

Upload `apps/web/dist`. Set the Pages source to that folder (or configure your CI to publish it). `base` must match the repo subpath.

## Future multiplayer

`MatchTransport` is implemented locally. A later server should be authoritative: clients send placement and choice actions only; the server verifies turn, ownership, legal cells, deck identity, and seeded RNG; it emits append-only events. Do not trust client rolls. Replay stores seed, content/rules version, and the action sequence.

Hooks reserved (not built): async play, reconnect tokens, time controls, private hands, spectators, matchmaking, cosmetic-only monetisation, anti-cheat validation.
