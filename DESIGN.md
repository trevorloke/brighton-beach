# Design direction — "Painted Seafront"

Phase 1 direction statement, tokens and interaction/motion specs, derived from the brief's
creative direction, the board mockup, and the piece concepts.
(Note: the shared Claude Design link could not be accessed from the build environment; this
document records the design system as implemented, structured as the brief's Phase 1
deliverables so it can be diffed against the Design project when reconnected.)

## Direction statement

Ground everything in the real Brighton seafront vernacular: Victorian pier timber, striped
deckchairs, postcard type, painted-facade terraces, bunting. Warm and characterful, never
corporate — but charm always serves legibility, because five zones of money, dice and
disaster state share the screen.

- **Palette ("Painted Seafront", from the mockup):**
  - Ink `#1F3A4D` — text and linework
  - Sea `#16A5B8` (bright `#37C4D6`) — water, primary actions
  - Deep Sea `#0C6272` / Deepest `#08424E` — header, board surround
  - Shingle `#E7B85C` — beach, active phase
  - Cream `#FBF3E0` / Paper `#FFFAF0` — postcard panels and cards
  - Coral `#E8604C` — accents, warnings, disasters
- **Type pairing:** Lilita One (display — rounded seaside-poster warmth) over Nunito
  (workhorse body). Loaded from Google Fonts with system fallbacks.
- **Signature element: bunting.** Strung across the header, the victory screen — and, as the
  cluster indicator, across any run of adjacent establishments on the board. The game's most
  important spatial mechanic wears its most festive mark.

## The board

Top-down stylised seafront, SVG, viewBox 1100×690. Painted-facade town backdrop; the
promenade runs the full width split into North (west) and South (east) halves by the pier,
which strikes out on timber legs across the shingle into open water.

- **Ground treatments:** paving-stone pattern (promenades), plank pattern with legs and a
  coral pier-head finial (pier), gold shingle gradient with pebble stipple (beach), sea
  gradient with surf line and wave marks (water). Zones are never label-only.
- **Slots ("berths"):** dashed ghost outlines when empty; during placement, valid berths fill
  sea-glass turquoise and brighten on hover/focus; occupied berths render the structure.
- **Stacking:** each level draws as a physically offset storey with a `×n` pip — height reads
  at board scale without clicking.
- **Ownership:** a flag on every structure — player colour AND player shape (▲ ⚑ ■ ●), so
  colour is never the only channel.
- **Clusters:** bunting strung across the run plus a warm shared glow beneath.
- **Tourists:** per-zone chip — 👥 count, proportional meter bar, ★ on the preferred zone.
- **Disasters:** hatched veil + dashed coral border over affected zones, with an icon chip
  showing name and remaining rounds; mirrored in the "In effect" side panel.
- **Mortgage:** structure greys, flag greys, MORTGAGED ribbon — a second signal beyond colour.

## Screens (all implemented)

1. Title & lobby — bunting, display title, player count/name/colour+shape, save-resume, rules entry
2. Character select — six entrepreneurs with portrait emoji, name, title, bonus text; taken characters dim
3. Main game view — board + top bar (round, current player, phase stepper) + entrepreneurs panel (cash, assets, holdings) + effects panel + scrolling "Seafront gazette" log + phase action bar
4. Action Phase — build catalog → glowing-berth placement → cost confirm; tap-structure popover for stack/sell/mortgage/unmortgage, each with confirm
5. Trade — two-party builder, both sides fully visible (cash + establishments), propose → partner confirms on handoff; atomic execution
6. Tourist Phase — dice theatre: tumble animation, volume + preference dice, verdict line, then per-zone chips update
7. Event/disaster reveal — postcard-frame card flip, category band (coral for disasters), lasting effects pinned in the side panel until expiry
8. Income Phase — per-establishment table: tourists captured, takings, upkeep, character bonus, net
9. Bankruptcy — debt banner with amount, board-driven sell/mortgage recovery, declare-bankruptcy confirm, elimination in the log and roster
10. Victory — trophy, winner colours, full standings with final assets and fate, play-again path
11. Rules reference — searchable in-game condensation of the rulebook, numbers pulled live from the content pack

## Motion spec

Four orchestrated moments, everything else quiet: dice tumble (~0.9s), event card flip
(0.5s), toast slide, trophy bob. All gated behind `prefers-reduced-motion` (durations
collapse to ~0).

## Responsive & accessibility

- Desktop-first; below 1100px the side column wraps under the board (tablet); below 640px a
  full-screen gate says the game needs a larger screen (the brief asked for an explicit call:
  this is it).
- Board slots are focusable with Enter/Space activation; 3px coral focus ring everywhere.
- Colour never carries meaning alone: flags have shapes, disasters have hatching + icons +
  text, mortgage has a ribbon, the preferred zone has a star.
- Cream-on-ink and ink-on-cream pairings meet WCAG AA.

## Handoff annex (tokens)

Implemented as CSS custom properties in `src/ui/theme.css`:
spacing `--sp-1…6` (4/8/12/16/24/32), radii 10/16, type scale `--fs-xs…hero`
(0.72rem → clamp(2.5–4.2rem)), shadows 2-level, full palette above. Breakpoints: 1100px
(stack side column), 700px (trade grid stacks), 640px (phone gate).
