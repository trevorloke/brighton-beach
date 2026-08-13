# Balancing worksheet — proposed defaults awaiting sign-off

The rulebook defines systems but not numbers. Per the brief, nothing here was invented
silently: this is the explicit worksheet of every open decision, the proposed default now
implemented in `src/engine/content.ts`, and the reasoning. All of it is data — tuning any
value is a one-line change and the test suite re-validates the economy.

**Status: PROPOSED. Flagged for Trevor's sign-off. Playtest, then tune.**

## 1. Starting capital by player count

| Players | Capital |
| ------- | ------- |
| 2 | £1,800 |
| 3 | £1,500 |
| 4 | £1,300 |

Reasoning: more players means clusters form faster and tourist income concentrates, so later
seats need less runway. Amounts buy roughly 3–4 mid-tier establishments.

## 2. Zones and berths

27 berths total: North Promenade 6, South Promenade 6, Pier 5, Main Beach 6, Water 4.
Buildings need firm ground (promenades, pier); beach and water take kiosks and monuments.
Zone base attraction (footfall an empty zone still gets): proms 2, pier 3, beach 3, water 1.

## 3. Establishment roster

16 establishments (6 kiosks / 6 buildings / 4 monuments). Full table in `content.ts`;
headline numbers:

| Type | Cost range | Income/tourist | Upkeep/round | Stacks |
| ---- | ---------- | -------------- | ------------ | ------ |
| Kiosks | £80–120 | £0.8–1.2 | £8–12 | no |
| Buildings | £250–450 | £1.8–2.8 | £25–45 per level | to 2–3 |
| Monuments | £600–800 | £1.6–2.0 | £45–60 | no |

Monuments earn less per tourist than their attraction suggests — they're gravity, not tills.
Resistance tags: `sturdy` (storm), `clean` (pollution), `netted` (seagulls).

## 4. Tourist dice

- Volume: 2d6 × **10** tourists (20–120 per round).
- Preference die: 6 faces → one of the five zones (attraction ×**1.5** that round) or an even spread.
- Double sixes: surge, +20 tourists. Double ones: a random disaster strikes.

## 5. Income formula and cluster curve

- Zone attraction = base + Σ structure attraction; tourists split across zones
  proportionally, then across a zone's structures proportionally.
- Structure income = its tourists × income-per-tourist (× event/disaster multipliers).
- **Cluster multiplier: 1.25^(n−1), capped ×2.5** (n = adjacent occupied berths). This is the
  concrete reading of the rulebook's "exponentially more tourists" — steep enough to reward
  placement, capped so a full promenade doesn't runaway.
- **Stack multiplier: ×1 / ×1.6 / ×2.3** by level, applied to attraction.

## 6. Maintenance (the bankruptcy pressure)

Charged every Income Phase on everything owned, roughly 10% of build cost per round
(per level for buildings). Mortgaged structures still owe **50%** upkeep. Simulated games
confirm this pressure ends 2–4 player games in a sane horizon.

## 7. Event deck (20 cards)

5 booms (+15…+30 tourists), 6 shifts (zone crazes ×1.5–×2, kiosk market day, dreary lulls),
3 windfalls (£80–150), 3 levies (£80–120 — these do the killing), 3 disaster cards.
Full text in `content.ts`.

## 8. Disasters

| | Zones | Effect | Duration | Resisted by |
|---|---|---|---|---|
| Storm | Pier, Water | attraction & income ×0 | 2 rounds | `sturdy` |
| Pollution | Beach, Water | ×0.25 | 2 rounds | `clean` |
| Seagulls | all but Water | kiosks only: attraction ×0.75, income ×0.5 | 1 round | `netted` |

A repeat strike refreshes duration rather than stacking.

## 9. Characters (6)

Ada Fairweather (buildings −15% cost) · Reg Marvello (monuments +30% attraction) ·
Priya Shore (kiosk upkeep £0) · Marcus Sterling (+£40/Income Phase) ·
Sofia Trestle (storm-immune structures) · Tommy Flyer (clusters count +1).

## 10. Mortgage and sale

Mortgage advances **40%** of invested cost; lifting it costs **50%**; selling to the bank
returns **50%**. Mortgaged structures earn nothing, attract nobody, break their cluster,
lose their flag, and can't be traded — but keep the asset. Sell for liquidity, mortgage to hold.

## 11. Hotseat vs AI

Per Trevor's call in the brief: **v1 ships hotseat**; AI opponents remain a stretch goal.
The engine's action interface is exactly what a bot (or a server) would consume — the
simulation bot in the test suite is a proof of that seam.

## 12. Deferred with intent

- **Card hands** (rulebook 3.5 deals a "starting hand"): the base rulebook never defines what
  held cards do, so v1 has no hidden hands; events resolve on draw and trading covers cash +
  establishments. Revisit when an expansion gives hands a job.
- Variants (Alliances, Silent Auction, Development Freeze) and all four expansions: out of
  scope for v1 by the brief; the content-pack structure is their landing pad.
