# Balancing worksheet — proposed defaults awaiting sign-off

The rulebook defines systems but not numbers. Per the brief, nothing here was invented
silently: this is the explicit worksheet of every open decision, the proposed default now
implemented in `src/engine/content.ts`, and the reasoning. All of it is data — tuning any
value is a one-line change and the test suite re-validates the economy.

**Status: PROPOSED. Flagged for Trevor's sign-off.** This revision was tuned empirically:
hundreds of full games were simulated with a random-but-legal bot, character win rates and
game horizons measured, and the numbers below adjusted until every character sat in a
playable band (9–31% vs a 25% baseline in a 4-seat field) and games resolved in
**10–28 rounds (median ~18)** across 2–4 players. Human playtesting comes next; every
knob is one line.

## 1. Starting capital by player count

| Players | Capital |
| ------- | ------- |
| 2 | £2,600 |
| 3 | £2,300 |
| 4 | £1,800 |

More players → clusters form faster, tourist income concentrates, and rounds pass quicker
per seat, so later seats need less runway. Buys roughly 3–5 opening pieces.

## 2. Zones and berths — a bigger board

**40 berths** (up from 27): North Promenade 9 · South Promenade 9 · Pier 7 ·
Main Beach 9 · Water 6. Buildings need firm ground (promenades, pier); beach and water
take kiosks and monuments. Zone base attraction: proms 5, pier 7, beach 7, water 3.

## 3. Berth traits — every square has its own character

Twelve traits, printed on 30 of the 40 berths as a fixed designed map (players learn the
board like a home table). Traits apply to whatever stands there, by anyone:

| Trait | Effect |
|---|---|
| ★ Prime Corner | attraction ×1.25 |
| 🌅 Sea View | income ×1.2 |
| 👣 Thoroughfare | attraction ×1.15, upkeep ×1.2 |
| 🌿 Quiet End | attraction ×0.8, build cost ×0.75 |
| 🛡️ Sheltered | grants `sturdy` (storm-proof) |
| 💧 Fresh Springs | grants `clean` (pollution-proof) |
| 🪶 Gull Roost | upkeep ×1.3 |
| ⚠️ Subsiding Ground | build cost ×0.85, **no stacking** |
| 📮 Postcard Spot | attraction ×1.2, build cost ×1.3 |
| 🏛️ Landmark Plot | attraction ×1.3, upkeep ×1.15 (the pier head) |
| 🌬️ Windswept | attraction ×0.85, upkeep ×0.85 |
| 🏮 Lamplit Row | grants `lit` (fog-proof), upkeep ×1.1 |

Sales and mortgages pay out on the price **actually paid** (tracked per structure), so
discounted ground can never be flipped to the bank at a profit.

## 4. Establishment roster

19 establishments (7 kiosks / 7 buildings / 5 monuments) — full table in `content.ts`:

| Type | Cost range | Income/tourist | Upkeep/round | Stacks |
| ---- | ---------- | -------------- | ------------ | ------ |
| Kiosks | £140–220 | £1.5–1.9 | £12–20 | no |
| Buildings | £450–820 | £2.8–4.0 | £40–82 per level | to 2–3 |
| Monuments | £980–1,450 | £2.4–3.2 | £72–105 | no |

Earning-power-per-pound is deliberately flat across the roster (~0.022–0.040) so no single
purchase is strictly dominant; monuments trade efficiency for gravity. Resistance tags:
`sturdy` (storm), `clean` (pollution), `netted` (gulls), `lit` (fog), `food` (scorcher).

## 5. Seasons — the wheel that shapes a year

The season turns every round: 🌸 Spring ×1.0 → ☀️ High Summer ×1.35 → 🍂 Autumn ×0.95 →
❄️ Winter ×0.6, applied to the whole tourist tide. Build ahead of the boom, bank ahead of
the freeze; the top bar shows what arrives next round. Measured: the first winter is
comfortably survivable on starting capital; late winters are the killer.

## 6. Tourist dice

- Volume: **150 + 2d6 × 25** tourists, × season (≈ 120–600 per round; ~330 typical).
- Preference die: 6 faces → one of the five zones (attraction ×**1.5**) or an even spread.
- Double sixes: surge, +100 (season-scaled). Double ones: a random disaster strikes.

## 7. Income formula and cluster curve

- Zone attraction = base + Σ structure attraction (traits, stacks, characters, disasters
  included); tourists split across zones proportionally, then across a zone's structures.
- Structure income = its tourists × income-per-tourist × berth traits × events/disasters.
- **Cluster multiplier: 1.3^(n−1), capped ×2.8.** The rulebook's "exponentially more
  tourists", steep enough to fight over, capped so a full promenade doesn't runaway.
- **Stack multiplier: ×1 / ×1.7 / ×2.5** by level, applied to attraction.

## 8. Maintenance and rising rents (the bankruptcy pressure)

Charged every Income Phase (~9% of build cost per round, per level), modified by berth
traits; mortgaged structures owe **50%**. **Rising rents: all upkeep ×1.2 every 3 rounds,
compounding** (×1.44 by round 7, ×2.07 by round 13, ×2.99 by round 19). This is the clock
that guarantees an endgame — measured horizons 10–28 rounds, no simulated game stalling.
The escalator is deliberately gentle enough that efficient portfolios stay meaningfully
ahead of weak ones deep into the game.

## 9. Event deck (34 cards)

7 booms (+60…+120 tourists, some multi-round) · 9 shifts (zone crazes ×1.6–×2, kiosk
market day ×2, building gala ×1.5, monument open day ×1.5, drizzles) · 4 windfalls
(£120–250, plus £40-per-monument Heritage Fund) · 5 levies (£150–220 flat, £30 per
establishment Safety Inspection, richest-pays-poorest Charity Gala) · 3 economy swings
(builds ×0.7 for a round, builds ×1.3 for two, a full maintenance holiday) · 5 disaster
cards · 1 quiet Tuesday. Full text in `content.ts`.

## 10. Disasters (5)

| | Zones | Effect | Duration | Resisted by |
|---|---|---|---|---|
| 🌩️ Storm | Pier, Water | attraction & income ×0 | 2 rounds | `sturdy` |
| 🛢️ Pollution | Beach, Water | ×0.25 | 2 rounds | `clean` |
| 🕊️ Seagulls | all but Water | kiosks: attraction ×0.75, income ×0.5 | 1 round | `netted` |
| 🌫️ Sea Fog | everywhere | attraction ×0.6, income ×0.8 | 1 round | `lit` |
| 🥵 Scorcher | proms + pier | attraction ×0.7, income ×0.85 (its card also boosts beach & water ×1.4) | 2 rounds | `food` |

A repeat strike refreshes duration rather than stacking. Berth traits can grant the
resistance tags (Sheltered → sturdy, Fresh Springs → clean, Lamplit Row → lit).

## 11. Characters (8) — empirically levelled

Measured win rates, each character seated in a field of three Bankers (25% = fair):

Ada Fairweather, Hotelier (buildings −20% cost) 22% · Reg Marvello, Showman (monuments
+40% attraction) 28% · Priya Shore, Kiosk Queen (kiosk upkeep −30%) 31% · Marcus
Sterling, Banker (+£35/Income Phase) · Sofia Trestle, Engineer (immune to all disasters)
9% · Tommy Flyer, Promoter (clusters count +2) 13% · Edie Lanes, Dealmaker (bank sales
return 75%) 25% · Vera Bright, Restaurateur (buildings +20% income) 16%.

Earlier drafts measured Kiosk Queen at **80%** (full upkeep immunity made her immune to
the rent escalator — the game-ending mechanism) and a £75 Banker at ~95% vs percentage
characters; both were cut down and the percentage characters raised. The engineer and
promoter read weak to a random bot but reward deliberate play (disaster timing, cluster
planning) — flagged for human playtest attention.

## 12. Mortgage and sale

Mortgage advances **40%** of invested cost; lifting it costs **50%**; selling to the bank
returns **50%** (75% for the Dealmaker). All fractions of the price actually paid.
Mortgaged structures earn nothing, attract nobody, break their cluster, grey their flag,
and can't be traded — but keep the asset. If a round-start levy sinks you before your
Income Phase, settling your debts returns you to collect your takings — the levy never
eats your income.

## 13. Hotseat vs AI

Per Trevor's call in the brief: **v1 ships hotseat**; AI opponents remain a stretch goal.
The engine's action interface is exactly what a bot (or a server) would consume — the
simulation bot in the test suite is a proof of that seam.

## 14. Deferred with intent

- **Card hands** (rulebook 3.5): the base rulebook never defines what held cards do, so v1
  has no hidden hands; events resolve on draw. Revisit when an expansion gives hands a job.
- A dice-triggered duration-1 disaster rolled by the round's last player skews that one
  tourist distribution and then blows over at the round boundary — ruled acceptable
  ("strikes as the crowds arrive") rather than special-cased.
- Variants (Alliances, Silent Auction, Development Freeze) and all four expansions: out of
  scope for v1 by the brief; the content-pack structure (zones, traits, events, disasters,
  characters all as data) is their landing pad.
