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

Top-down stylised seafront, SVG, viewBox 1240×780, 40 berths. A living scene, not a static
diagram: the sun pulses gently, clouds drift the length of the sky, gulls wheel over the
promenade, wave crests slide, sailboats and buoys bob. All of it idles quietly under
`prefers-reduced-motion`.

- **Composition:** painted-facade town along the top under a sky band with sun and drifting
  clouds; the promenade runs the full width split into North (west, 9 berths) and South
  (east, 9) halves by the pier, which strikes out on timber legs (7 berths) past the shingle
  beach (9 pitches, five west / four east of the pier) into open water (6 moorings, three a
  side), ending in a pavilion-roofed pier head with a pennant.
- **Ground treatments:** paving-stone pattern with railings and lamp posts (promenades),
  plank pattern with legs and a coral pavilion finial (pier), gold shingle gradient with
  pebble stipple, scattered parasols and towels (beach), sea gradient with animated surf
  line, wave marks, boats and buoys (water). Zones are never label-only.
- **Berth traits:** every berth's printed traits render as small round badges pinned to its
  corner — cream ring for advantages, coral for disadvantages — with full names and effects
  in the tooltip, the berth-inspection sheet, and the build confirmation. Traits stay
  visible on empty berths so players can plan the board like a home map.
- **Slots ("berths"):** dashed ink outlines when empty (legible on every ground); during
  placement, valid berths fill sea-glass turquoise and brighten on hover/focus; empty berths
  remain tappable outside placement to study their ground.
- **Stacking:** each level draws as a physically offset storey with a `×n` pip — height reads
  at board scale without clicking.
- **Ownership:** a flag on every structure — player colour AND player shape (▲ ⚑ ■ ●), so
  colour is never the only channel.
- **Clusters:** bunting strung across the run plus a warm shared glow beneath.
- **Tourists:** per-zone chip — 👥 count, proportional meter bar, ★ on the preferred zone —
  now a button: tapping it opens the zone's full attraction/tourist-share breakdown.
- **Seasons:** a light wash over the whole scene (warm gold in High Summer, rust in Autumn,
  pale blue in Winter) plus the season chip in the top bar showing the current tide
  multiplier and the next season's icon — the planning cue.
- **Disasters:** hatched veil + dashed border over affected zones in a per-disaster colour
  (storm slate-blue, pollution olive, gulls coral, fog near-white, scorcher amber), with an
  icon chip showing name and remaining rounds; mirrored in the "In effect" side panel.
- **Mortgage:** structure greys, flag greys, MORTGAGED ribbon — a second signal beyond colour.

## Screens (all implemented)

1. Title & lobby — bunting, display title, player count/name/colour+shape, save-resume, rules entry
2. Character select — eight entrepreneurs with portrait emoji, name, title, bonus text; taken characters dim
3. Main game view — board + top bar (round, current player, season chip with next-season hint, rising-rents chip, phase stepper) + entrepreneurs panel + effects panel + colour-coded "Seafront gazette" log + phase action bar
4. Action Phase — build catalog → glowing-berth placement → trait-aware cost confirm listing the berth's traits; tap-structure sheet for stack/sell/mortgage/unmortgage (stack gated by ground traits); tap-empty-berth sheet for ground inspection; tap-zone chip for the zone's maths
5. Trade — two-party builder, both sides fully visible; propose → partner confirms on handoff; atomic execution
6. Tourist Phase — dice theatre: season line, tumble animation, volume + preference dice, verdict, then per-zone chips update
7. Event/disaster reveal — postcard-frame card flip; category bands now include economy cards (ochre) and windfalls (sea)
8. Income Phase — per-establishment table with factor chips spelling out every multiplier (cluster, storeys, traits, events, disasters), season/rent header line
9. Bankruptcy — debt banner, board-driven sell/mortgage recovery, declare-bankruptcy confirm
10. Victory — trophy, confetti fall, winner colours, full standings, play-again path
11. Rules reference — searchable, numbers pulled live from the content pack, with sections for traits, seasons and rising rents

## Motion spec

Ambient: sun pulse (8s), cloud drift (70/95s), gull glide (26/34s), wave slide (9/12s),
boat bob (5/6.5s), season wash (static tint). Orchestrated: dice tumble (~0.9s), event card
flip (0.5s), toast slide, trophy bob, confetti fall (~3s loop). Everything gated behind
`prefers-reduced-motion` (durations collapse to ~0).

## Responsive & accessibility

- Desktop-first; below 1100px the side column wraps under the board (tablet); below 640px a
  full-screen gate says the game needs a larger screen.
- Board berths (occupied AND empty) and zone chips are focusable buttons with Enter/Space
  activation and descriptive labels (traits included); 3px coral focus ring everywhere.
- Colour never carries meaning alone: flags have shapes, disasters have hatching + icons +
  text, mortgage has a ribbon, the preferred zone has a star, trait badges pair colour with
  distinct icons and are restated as text in every sheet.
- Cream-on-ink and ink-on-cream pairings meet WCAG AA.

## Handoff annex (tokens)

Implemented as CSS custom properties in `src/ui/theme.css`:
spacing `--sp-1…6` (4/8/12/16/24/32), radii 10/16, type scale `--fs-xs…hero`
(0.72rem → clamp(2.5–4.2rem)), shadows 2-level, full palette above. Breakpoints: 1100px
(stack side column), 700px (trade grid stacks), 640px (phone gate).
