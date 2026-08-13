# Brighton Beach — digital edition

The seaside strategy board game, playable in the browser. Rival entrepreneurs build kiosks,
buildings and monuments across five zones of the Brighton seafront, chase the tourist tide,
trade and negotiate, weather storms, pollution and seagulls — until only one player is solvent.

**v1 scope:** the full base game, 2–4 players, local hotseat (pass-and-play), per the
[digital brief](#) and the Brighton Beach rulebook. Expansions and variants are out of scope
but the content system is built for them.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (dist/)
npm run preview    # serve the production build
npm test           # engine test suite
```

## How it's built

```
src/
  engine/            # pure, UI-independent game engine
    types.ts         #   state shape, content-pack schema, actions
    content.ts       #   ALL game content as data: zones, establishments,
                     #   events, disasters, characters, rule numbers
    rng.ts           #   seeded deterministic RNG (mulberry32)
    engine.ts        #   the state machine: createGame / applyAction
    selectors.ts     #   clusters, attraction, tourist flow, income math
    __tests__/       #   unit tests + full simulated games
  ui/                # React presentation layer (no rules logic)
  App.tsx            # screen routing, save/resume, action dispatch
```

Design decisions that matter:

- **Engine purity.** Every rule lives in `src/engine`, which never imports UI code. The UI
  dispatches `GameAction`s and renders the returned state. Illegal actions throw `EngineError`
  and surface as toasts. The engine can be moved server-side for online multiplayer without
  restructuring.
- **Determinism.** The RNG state lives inside the serializable `GameState`; a seed plus an
  action log reproduces any game exactly. The test suite relies on this.
- **Everything is data.** Establishments, event cards, disasters, characters, zones and every
  tunable number live in `content.ts` as a `ContentPack`. High Tide terrain or Festive's Party
  Island become new entries (a new zone id + establishments that list it), not engine changes.
- **Persistence.** State serializes to JSON; the app autosaves to `localStorage` after every
  action and the lobby offers resume.
- **Confirmation pattern.** Nothing irreversible — building, stacking, selling, mortgaging,
  trading, declaring bankruptcy — happens without an explicit confirm step.
- **Accessibility.** Keyboard-reachable board slots and controls with visible focus, ownership
  shown by flag *shape* as well as colour, reduced-motion respected, WCAG AA text contrast.

## Testing

`npm test` runs 52 engine tests: income math, cluster multipliers, stacking curves,
disaster effects and resistances, mortgage/sell/trade rules, bankruptcy edge cases including
the simultaneous-bankruptcy tie rule (8.4), serialization round-trips, and full simulated
2/3/4-player games driven by a random-but-legal bot that asserts board invariants on every
intermediate state and requires each game to reach a winner.

## Balancing

The rulebook defines systems, not numbers. Every number in play is proposed in
[BALANCING.md](./BALANCING.md) — the worksheet awaiting sign-off — and implemented in
`src/engine/content.ts` so tuning is a data edit.

## Design

The visual direction ("Painted Seafront"), tokens, and the interaction/motion specs are in
[DESIGN.md](./DESIGN.md).
