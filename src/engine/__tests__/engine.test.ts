import { describe, it, expect } from 'vitest';
import { applyAction, createGame, deserialize, drawEvent, serialize, EngineError } from '../engine';
import {
  assetValue,
  buildCost,
  clusterSizes,
  computeIncome,
  distributeTourists,
  findSlot,
  maxLevelsAt,
  rentMultiplier,
  seasonForRound,
  slotKey,
  structureAttraction,
  traitsAt,
  zoneAttractions,
} from '../selectors';
import { act, calmSeas, content, makePlayers, newGame, withCash, withTourists } from './helpers';
import type { GameState } from '../types';

const CAFE = 'cafe';
const KIOSK = 'ice-cream';
// Plain berths (no traits) used for baseline maths: see BERTH_TRAITS in content.
const PLAIN_BEACH = 2;
const PLAIN_BEACH_B = 5;
const PLAIN_NP = 1;
const PLAIN_NP_B = 4;
const PLAIN_PIER = 1;
const PLAIN_PIER_B = 3;

function build(state: GameState, defId: string, zone: string, slotIndex: number): GameState {
  return act(state, { type: 'BUILD', defId, zone, slotIndex });
}

function withDisaster(state: GameState, id: 'storm' | 'pollution' | 'seagulls' | 'fog' | 'heatwave'): GameState {
  const def = content.disasters.find((d) => d.id === id)!;
  return {
    ...state,
    activeEffects: [
      ...state.activeEffects,
      { sourceName: def.name, effect: { type: 'disasterActive', disaster: id }, remainingRounds: def.duration, icon: def.icon },
    ],
  };
}

/** Draw a specific card through the engine's real event pathway. */
function applyEventForTest(state: GameState, cardId: string): GameState {
  return drawEvent(content, { ...state, eventDeck: [cardId], eventDiscard: [] });
}

describe('game creation', () => {
  it('deals starting capital by player count (round-1 event may shift it slightly)', () => {
    expect(newGame(1, 2).players.every((p) => Math.abs(p.cash - 2600) <= 300)).toBe(true);
    expect(newGame(1, 3).players.every((p) => Math.abs(p.cash - 2300) <= 300)).toBe(true);
    expect(newGame(1, 4).players.every((p) => Math.abs(p.cash - 1800) <= 300)).toBe(true);
  });

  it('creates every zone slot (40 berths in the base game)', () => {
    const state = newGame();
    const total = content.zones.reduce((s, z) => s + z.slots, 0);
    expect(total).toBe(40);
    expect(state.slots).toHaveLength(total);
  });

  it('every trait on the board map exists in the trait table', () => {
    for (const [key, ids] of Object.entries(content.berthTraits)) {
      const [zone, idx] = key.split(':');
      const zoneDef = content.zones.find((z) => z.id === zone)!;
      expect(zoneDef, `zone for ${key}`).toBeDefined();
      expect(Number(idx)).toBeLessThan(zoneDef.slots);
      for (const id of ids) {
        expect(content.traits.some((t) => t.id === id), `trait ${id}`).toBe(true);
      }
    }
  });

  it('draws an opening event', () => {
    const state = newGame();
    expect(state.lastEvent).not.toBeNull();
    expect(state.eventDiscard).toHaveLength(1);
  });

  it('rejects invalid player counts', () => {
    expect(() => createGame(content, { seed: 1, players: makePlayers(1) })).toThrow(EngineError);
  });
});

describe('determinism', () => {
  it('same seed produces identical games', () => {
    const a = newGame(123, 4);
    const b = newGame(123, 4);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('different seeds differ', () => {
    expect(serialize(newGame(1))).not.toBe(serialize(newGame(2)));
  });

  it('round-trips through serialization', () => {
    const state = newGame(7, 3);
    expect(deserialize(serialize(state))).toEqual(state);
  });
});

describe('building', () => {
  it('charges the cost and places the structure', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const cashBefore = state.players[0].cash;
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    expect(state.players[0].cash).toBe(cashBefore - 180);
    expect(findSlot(state, 'beach', PLAIN_BEACH)?.structure?.pieces).toEqual([KIOSK]);
    expect(findSlot(state, 'beach', PLAIN_BEACH)?.structure?.ownerId).toBe(0);
  });

  it('applies the Hotelier build discount to buildings', () => {
    // Player 0 in the helper roster is the hotelier (20% off buildings).
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const cashBefore = state.players[0].cash;
    state = build(state, CAFE, 'north-prom', PLAIN_NP);
    expect(state.players[0].cash).toBe(cashBefore - Math.round(450 * 0.8));
  });

  it('rejects occupied slots, wrong zones, and empty purses', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    expect(() => build(state, KIOSK, 'beach', PLAIN_BEACH)).toThrow(/occupied/);
    expect(() => build(state, CAFE, 'beach', PLAIN_BEACH_B)).toThrow(/cannot be placed/);
    const broke = withCash(state, 0, 10);
    expect(() => build(broke, KIOSK, 'beach', PLAIN_BEACH_B)).toThrow(/Not enough cash/);
  });

  it('rejects building outside the action phase', () => {
    const state = newGame();
    expect(state.phase).toBe('income');
    expect(() => build(state, KIOSK, 'beach', PLAIN_BEACH)).toThrow(/Action Phase/);
  });
});

describe('berth traits', () => {
  it('quiet ends are cheaper to build on', () => {
    // beach:0 is a Quiet End (cost ×0.75).
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const cashBefore = state.players[0].cash;
    state = build(state, KIOSK, 'beach', 0);
    expect(state.players[0].cash).toBe(cashBefore - Math.round(180 * 0.75));
  });

  it('postcard spots cost more', () => {
    // north-prom:5 is a Postcard Spot (cost ×1.3). Souvenirs have no character discount.
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const cashBefore = state.players[0].cash;
    state = build(state, 'souvenirs', 'north-prom', 5);
    expect(state.players[0].cash).toBe(cashBefore - Math.round(160 * 1.3));
  });

  it('prime corners raise attraction', () => {
    // beach:4 is a Prime Corner (attraction ×1.25); beach:2 is plain.
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    state = build(state, 'chippy', 'beach', 4 + 2); // beach:6 — keep them apart (no cluster)
    const clusters = clusterSizes(state);
    const plain = structureAttraction(content, state, findSlot(state, 'beach', PLAIN_BEACH)!, clusters);
    // Same kiosk on the corner berth, alone:
    let corner = calmSeas(act(newGame(7), { type: 'COLLECT_INCOME' }));
    corner = build(corner, KIOSK, 'beach', 4);
    const cornerA = structureAttraction(content, corner, findSlot(corner, 'beach', 4)!, clusterSizes(corner));
    expect(cornerA / plain).toBeCloseTo(1.25, 5);
  });

  it('sea views raise income', () => {
    // beach:1 is a Sea View (income ×1.2).
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 1);
    state = withTourists(state, { beach: 50 });
    const report = computeIncome(content, state, 0);
    expect(report.lines[0].gross).toBe(Math.round(50 * 1.6 * 1.2));
  });

  it('gull roosts raise upkeep', () => {
    // beach:7 is a Gull Roost (upkeep ×1.3).
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 7);
    const report = computeIncome(content, state, 0);
    expect(report.lines[0].maintenance).toBe(Math.ceil(16 * 1.3));
  });

  it('sheltered berths grant storm resistance', () => {
    // pier:2 is Sheltered (grants sturdy). Donuts are not storm-proof by themselves.
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, 'donuts', 'pier', PLAIN_PIER);
    state = build(state, 'donuts', 'pier', 2 + 2); // pier:4 is windswept; use pier:2 for sheltered below
    let sheltered = calmSeas(act(newGame(9), { type: 'COLLECT_INCOME' }));
    sheltered = build(sheltered, 'donuts', 'pier', 2);
    sheltered = withDisaster(sheltered, 'storm');
    state = withDisaster(state, 'storm');
    expect(structureAttraction(content, state, findSlot(state, 'pier', PLAIN_PIER)!, clusterSizes(state))).toBe(0);
    expect(structureAttraction(content, sheltered, findSlot(sheltered, 'pier', 2)!, clusterSizes(sheltered))).toBeGreaterThan(0);
  });

  it('subsiding ground blocks stacking', () => {
    // north-prom:6 is Subsiding Ground (max 1 level, cost ×0.85).
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, CAFE, 'north-prom', 6);
    expect(maxLevelsAt(content, 'north-prom', 6, content.establishments.find((e) => e.id === CAFE)!)).toBe(1);
    expect(() => act(state, { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: 6 })).toThrow(/cannot bear/);
  });

  it('traitsAt returns the printed traits', () => {
    expect(traitsAt(content, 'pier', 6).map((t) => t.id)).toEqual(['landmark']);
    expect(traitsAt(content, 'beach', PLAIN_BEACH)).toEqual([]);
  });
});

describe('stacking', () => {
  function withCafe(): GameState {
    return build(calmSeas(act(newGame(), { type: 'COLLECT_INCOME' })), CAFE, 'north-prom', PLAIN_NP);
  }

  it('stacks a building and raises attraction by the level curve', () => {
    let state = withCafe();
    const clusters = clusterSizes(state);
    const level1 = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, clusters);
    state = act(state, { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: PLAIN_NP });
    const slot = findSlot(state, 'north-prom', PLAIN_NP)!;
    expect(slot.structure?.pieces).toHaveLength(2);
    const level2 = structureAttraction(content, state, slot, clusterSizes(state));
    expect(level2 / level1).toBeCloseTo(1.7, 5); // levelMult[1] / levelMult[0]
  });

  it('enforces max height and ownership', () => {
    let state = withCafe();
    state = act(
      state,
      { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: PLAIN_NP },
      { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: PLAIN_NP },
    );
    expect(() => act(state, { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: PLAIN_NP })).toThrow(/maximum height/);
  });

  it('kiosks and monuments cannot stack', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    expect(() => act(state, { type: 'STACK', defId: KIOSK, zone: 'beach', slotIndex: PLAIN_BEACH })).toThrow(/Only buildings/);
  });
});

describe('clusters', () => {
  it('finds maximal adjacent runs within a zone', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 2);
    state = build(state, KIOSK, 'beach', 3);
    state = build(state, KIOSK, 'beach', 4);
    state = build(state, KIOSK, 'beach', 6); // gap at 5 — separate cluster
    const sizes = clusterSizes(state);
    expect(sizes.get(slotKey('beach', 2))).toBe(3);
    expect(sizes.get(slotKey('beach', 3))).toBe(3);
    expect(sizes.get(slotKey('beach', 4))).toBe(3);
    expect(sizes.get(slotKey('beach', 6))).toBe(1);
  });

  it('applies the exponential cluster multiplier to attraction', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const solo = structureAttraction(content, state, findSlot(state, 'beach', PLAIN_BEACH)!, clusterSizes(state));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH + 1);
    const paired = structureAttraction(content, state, findSlot(state, 'beach', PLAIN_BEACH)!, clusterSizes(state));
    expect(paired / solo).toBeCloseTo(1.3, 5); // clusterBase^(2-1)
  });

  it('mortgaged structures break clusters and attract nothing', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 2);
    state = build(state, KIOSK, 'beach', 3);
    state = build(state, KIOSK, 'beach', 4);
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: 3 });
    const sizes = clusterSizes(state);
    expect(sizes.get(slotKey('beach', 2))).toBe(1);
    expect(sizes.get(slotKey('beach', 4))).toBe(1);
    expect(sizes.get(slotKey('beach', 3))).toBeUndefined();
    expect(structureAttraction(content, state, findSlot(state, 'beach', 3)!, sizes)).toBe(0);
  });
});

describe('tourist distribution', () => {
  it('splits tourists proportionally to zone attraction and reconciles the total', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const byZone = distributeTourists(content, state, 100, 'spread');
    const total = Object.values(byZone).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    expect(byZone['beach']).toBeGreaterThan(byZone['water']);
  });

  it('the preference die boosts the preferred zone', () => {
    const state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const spread = distributeTourists(content, state, 100, 'spread');
    const pier = distributeTourists(content, state, 100, 'pier');
    expect(pier['pier']).toBeGreaterThan(spread['pier']);
  });
});

describe('seasons', () => {
  it('the wheel cycles spring → summer → autumn → winter', () => {
    expect(seasonForRound(content, 1).id).toBe('spring');
    expect(seasonForRound(content, 2).id).toBe('summer');
    expect(seasonForRound(content, 4).id).toBe('winter');
    expect(seasonForRound(content, 5).id).toBe('spring');
  });

  it('the season multiplier scales the tourist tide', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = { ...state, phase: 'tourist', round: 2 }; // High Summer, ×1.35
    state = act(state, { type: 'ROLL_TOURISTS' });
    const dice = state.lastDice!;
    expect(dice.seasonMult).toBe(1.35);
    const raw = 150 + (dice.volume[0] + dice.volume[1]) * 25 + (dice.surge ? 100 : 0);
    expect(dice.tourists).toBe(Math.round(raw * 1.35));
  });
});

describe('rising rents', () => {
  it('escalates every three rounds, up to the cap', () => {
    expect(rentMultiplier(content, 1)).toBe(1);
    expect(rentMultiplier(content, 3)).toBe(1);
    expect(rentMultiplier(content, 4)).toBeCloseTo(1.2, 5);
    expect(rentMultiplier(content, 7)).toBeCloseTo(1.44, 5);
    // 1.2^6 ≈ 2.99 would apply from round 19 — the ×2.5 ceiling holds instead.
    expect(rentMultiplier(content, 19)).toBe(2.5);
    expect(rentMultiplier(content, 40)).toBe(2.5);
  });

  it('raises maintenance in the income report', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    state = { ...state, round: 5 };
    state = withTourists(state, { beach: 50 });
    const report = computeIncome(content, state, 0);
    expect(report.rentMult).toBeCloseTo(1.2, 5);
    expect(report.lines[0].maintenance).toBe(Math.ceil(16 * 1.2));
  });
});

describe('income', () => {
  it('computes gross from routed tourists and subtracts maintenance', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH); // sole structure on the beach
    state = withTourists(state, { beach: 50 });
    const report = computeIncome(content, state, 0);
    const line = report.lines[0];
    // Sole structure receives all 50 beach tourists at £1.60 each, £16 upkeep.
    expect(line.tourists).toBe(50);
    expect(line.gross).toBe(80);
    expect(line.maintenance).toBe(16);
    expect(report.net).toBe(64);
  });

  it('splits zone tourists across structures by attraction', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH); // attraction 3
    state = build(state, 'deckchairs', 'beach', PLAIN_BEACH_B); // attraction 2, non-adjacent
    state = withTourists(state, { beach: 100 });
    const report = computeIncome(content, state, 0);
    const iceCream = report.lines.find((l) => l.slotKey === `beach:${PLAIN_BEACH}`)!;
    const chairs = report.lines.find((l) => l.slotKey === `beach:${PLAIN_BEACH_B}`)!;
    expect(iceCream.tourists).toBe(60);
    expect(chairs.tourists).toBe(40);
  });

  it('mortgaged structures earn nothing but still owe half upkeep', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: PLAIN_BEACH });
    state = withTourists(state, { beach: 50 });
    const report = computeIncome(content, state, 0);
    expect(report.lines[0].gross).toBe(0);
    expect(report.lines[0].maintenance).toBe(8);
  });

  it('the Banker collects a flat bonus; the Kiosk Queen pays half kiosk upkeep', () => {
    let state = calmSeas(act(newGame(1, 4), { type: 'COLLECT_INCOME' }));
    // Player 3 is the banker in the helper roster.
    const banker = computeIncome(content, state, 3);
    expect(banker.characterBonus).toBe(35);
    // Player 2 is the kiosk queen: give her a kiosk.
    state = { ...state, currentPlayer: 2, phase: 'action' };
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const queen = computeIncome(content, state, 2);
    expect(queen.lines[0].maintenance).toBe(Math.ceil(16 * 0.7));
  });

  it('the Restaurateur earns extra building income', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 0 ? { ...p, characterId: 'restaurateur' } : p)),
    };
    state = build(state, CAFE, 'north-prom', PLAIN_NP);
    state = withTourists(state, { 'north-prom': 50 });
    const report = computeIncome(content, state, 0);
    expect(report.lines[0].gross).toBe(Math.round(50 * 2.8 * 1.2));
  });
});

describe('disasters', () => {
  function stormState(): GameState {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, 'donuts', 'pier', PLAIN_PIER); // not storm-resistant
    state = build(state, 'pavilion', 'pier', PLAIN_PIER_B); // sturdy
    return state;
  }

  it('a storm zeroes non-resistant pier structures but spares sturdy ones', () => {
    let state = stormState();
    state = withDisaster(state, 'storm');
    const clusters = clusterSizes(state);
    expect(structureAttraction(content, state, findSlot(state, 'pier', PLAIN_PIER)!, clusters)).toBe(0);
    expect(structureAttraction(content, state, findSlot(state, 'pier', PLAIN_PIER_B)!, clusters)).toBeGreaterThan(0);
  });

  it('storm suppresses income on affected structures', () => {
    let state = stormState();
    state = withDisaster(state, 'storm');
    state = withTourists(state, { pier: 60 });
    const report = computeIncome(content, state, 0);
    const donuts = report.lines.find((l) => l.slotKey === `pier:${PLAIN_PIER}`)!;
    const pavilion = report.lines.find((l) => l.slotKey === `pier:${PLAIN_PIER_B}`)!;
    expect(donuts.gross).toBe(0);
    expect(pavilion.gross).toBeGreaterThan(0);
  });

  it('seagulls only hit kiosks', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'north-prom', PLAIN_NP); // kiosk, unprotected
    state = build(state, CAFE, 'north-prom', PLAIN_NP_B); // building — gulls don't care
    const before = clusterSizes(state);
    const kioskBefore = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, before);
    const cafeBefore = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP_B)!, before);
    state = withDisaster(state, 'seagulls');
    const after = clusterSizes(state);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, after)).toBeCloseTo(kioskBefore * 0.75, 5);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP_B)!, after)).toBeCloseTo(cafeBefore, 5);
  });

  it('sea fog dims everything except lit structures', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'north-prom', PLAIN_NP); // unlit
    state = build(state, 'arcade', 'north-prom', PLAIN_NP_B); // lit (neon!)
    const before = clusterSizes(state);
    const kioskBefore = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, before);
    const arcadeBefore = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP_B)!, before);
    state = withDisaster(state, 'fog');
    const after = clusterSizes(state);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, after)).toBeCloseTo(kioskBefore * 0.6, 5);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP_B)!, after)).toBeCloseTo(arcadeBefore, 5);
  });

  it('a lamplit berth shines through the fog', () => {
    // pier:5 is Lamplit Row — grants the lit tag to whatever stands there.
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, 'donuts', 'pier', 5);
    const before = structureAttraction(content, state, findSlot(state, 'pier', 5)!, clusterSizes(state));
    state = withDisaster(state, 'fog');
    expect(structureAttraction(content, state, findSlot(state, 'pier', 5)!, clusterSizes(state))).toBeCloseTo(before, 5);
  });

  it('a scorcher empties the pavements but food stalls thrive', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, 'souvenirs', 'north-prom', PLAIN_NP); // not food
    state = build(state, KIOSK, 'north-prom', PLAIN_NP_B); // ice cream: food
    const before = clusterSizes(state);
    const souvBefore = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, before);
    const iceBefore = structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP_B)!, before);
    state = withDisaster(state, 'heatwave');
    const after = clusterSizes(state);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP)!, after)).toBeCloseTo(souvBefore * 0.7, 5);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', PLAIN_NP_B)!, after)).toBeCloseTo(iceBefore, 5);
  });

  it('the Engineer resists storms', () => {
    let state = calmSeas(act(newGame(1, 4), { type: 'COLLECT_INCOME' }));
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 0 ? { ...p, characterId: 'engineer' } : p)),
    };
    state = withCash(state, 0, 10000);
    state = build(state, 'donuts', 'pier', PLAIN_PIER);
    state = withDisaster(state, 'storm');
    expect(structureAttraction(content, state, findSlot(state, 'pier', PLAIN_PIER)!, clusterSizes(state))).toBeGreaterThan(0);
  });

  it('a dice-triggered disaster on the round-closing roll still bites the next round', () => {
    // Hunt a seed where the SECOND player's roll comes up double ones: their
    // roll wraps the round, which used to expire a 1-round disaster before
    // any income phase felt it.
    for (let seed = 1; seed < 5000; seed++) {
      let state = calmSeas(act(newGame(seed), { type: 'COLLECT_INCOME' }));
      state = act(state, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
      if (state.phase === 'game-over') continue;
      state = calmSeas(state); // clear player 1's inherited effects, keep determinism
      state = act(state, { type: 'COLLECT_INCOME' }, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
      const dice = state.lastDice!;
      if (!dice.triggeredDisaster) continue;
      // Round wrapped; the freshly triggered disaster must still be active.
      expect(state.round).toBe(2);
      expect(
        state.activeEffects.some(
          (e) => e.effect.type === 'disasterActive' && e.effect.disaster === dice.triggeredDisaster,
        ),
      ).toBe(true);
      return;
    }
    throw new Error('no double-ones seed found in range');
  });

  it('disasters expire after their duration', () => {
    // Find a seed whose two rolls trigger no dice disaster of their own, so
    // only the injected seagulls are in play.
    for (let seed = 1; seed < 200; seed++) {
      let state = calmSeas(act(newGame(seed), { type: 'COLLECT_INCOME' }));
      state = withDisaster(state, 'seagulls'); // duration 1
      // Complete the round: P1 acts+rolls, P2 income/act/rolls -> new round.
      state = act(state, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
      if (state.phase === 'game-over' || state.lastDice?.triggeredDisaster) continue;
      state = act(state, { type: 'COLLECT_INCOME' }, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
      if (state.lastDice?.triggeredDisaster) continue;
      expect(state.activeEffects.filter((e) => e.effect.type === 'disasterActive' && e.effect.disaster === 'seagulls')).toHaveLength(0);
      return;
    }
    throw new Error('no quiet seed found');
  });
});

describe('event cards', () => {
  it('per-establishment levies scale with holdings', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH_B);
    const p0Before = state.players[0].cash;
    const p1Before = state.players[1].cash;
    const after = applyEventForTest(state, 'safety-inspection'); // −£30 per establishment
    expect(after.players[0].cash).toBe(p0Before - 60);
    expect(after.players[1].cash).toBe(p1Before);
  });

  it('the Heritage Fund pays per monument only', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = {
      ...state,
      slots: state.slots.map((s) =>
        s.zone === 'beach' && s.index === PLAIN_BEACH
          ? { ...s, structure: { pieces: ['lighthouse'], ownerId: 0, mortgaged: false, invested: 980 } }
          : s.zone === 'beach' && s.index === PLAIN_BEACH_B
            ? { ...s, structure: { pieces: [KIOSK], ownerId: 1, mortgaged: false, invested: 180 } }
            : s,
      ),
    };
    const p0Before = state.players[0].cash;
    const p1Before = state.players[1].cash;
    const after = applyEventForTest(state, 'heritage-fund'); // +£40 per monument
    expect(after.players[0].cash).toBe(p0Before + 40);
    expect(after.players[1].cash).toBe(p1Before);
  });

  it('the Charity Gala moves cash from richest to poorest', () => {
    let state = calmSeas(act(newGame(1, 3), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 1000);
    state = withCash(state, 1, 300);
    state = withCash(state, 2, 500);
    const after = applyEventForTest(state, 'charity-gala');
    expect(after.players[0].cash).toBe(850);
    expect(after.players[1].cash).toBe(450);
    expect(after.players[2].cash).toBe(500);
  });

  it('economy cards swing build costs', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const base = buildCost(content, state, 0, 'souvenirs'); // no discount applies
    expect(base).toBe(160);
    const grant = applyEventForTest(state, 'planning-grant');
    expect(buildCost(content, grant, 0, 'souvenirs')).toBe(Math.round(160 * 0.7));
    const shortage = applyEventForTest(state, 'materials-shortage');
    expect(buildCost(content, shortage, 0, 'souvenirs')).toBe(Math.round(160 * 1.3));
  });

  it('a maintenance holiday waives upkeep for the round', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const holiday = applyEventForTest(state, 'maintenance-holiday');
    const report = computeIncome(content, holiday, 0);
    expect(report.lines[0].maintenance).toBe(0);
  });
});

describe('sell, mortgage, trade', () => {
  it('selling returns half the invested cost', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const cashBefore = state.players[0].cash;
    state = act(state, { type: 'SELL', zone: 'beach', slotIndex: PLAIN_BEACH });
    expect(state.players[0].cash).toBe(cashBefore + 90);
    expect(findSlot(state, 'beach', PLAIN_BEACH)?.structure).toBeNull();
  });

  it('sales pay out on the price actually paid, so discounted builds cannot mint money', () => {
    // beach:0 is a Quiet End (cost ×0.75): the kiosk costs 135, not 180.
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    expect(findSlot(state, 'beach', 0)?.structure?.invested).toBe(Math.round(180 * 0.75));
    const cashBefore = state.players[0].cash;
    state = act(state, { type: 'SELL', zone: 'beach', slotIndex: 0 });
    // Half of the £135 paid — strictly less than the £135 build cost.
    expect(state.players[0].cash).toBe(cashBefore + Math.floor(135 * 0.5));
  });

  it('the Dealmaker sells at 75%', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 0 ? { ...p, characterId: 'dealmaker' } : p)),
    };
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const cashBefore = state.players[0].cash;
    state = act(state, { type: 'SELL', zone: 'beach', slotIndex: PLAIN_BEACH });
    expect(state.players[0].cash).toBe(cashBefore + Math.floor(180 * 0.75));
  });

  it('mortgage pays 40%, unmortgage costs 50%', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    let cash = state.players[0].cash;
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: PLAIN_BEACH });
    expect(state.players[0].cash).toBe(cash + 72);
    cash = state.players[0].cash;
    state = act(state, { type: 'UNMORTGAGE', zone: 'beach', slotIndex: PLAIN_BEACH });
    expect(state.players[0].cash).toBe(cash - 90);
    expect(findSlot(state, 'beach', PLAIN_BEACH)?.structure?.mortgaged).toBe(false);
  });

  it('executes an atomic two-sided trade', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    const p0Cash = state.players[0].cash;
    const p1Cash = state.players[1].cash;
    state = act(state, {
      type: 'TRADE',
      withPlayer: 1,
      give: { cash: 0, structures: [`beach:${PLAIN_BEACH}`] },
      receive: { cash: 200, structures: [] },
    });
    expect(findSlot(state, 'beach', PLAIN_BEACH)?.structure?.ownerId).toBe(1);
    expect(state.players[0].cash).toBe(p0Cash + 200);
    expect(state.players[1].cash).toBe(p1Cash - 200);
  });

  it('rejects trading structures you do not own and cash you do not have', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    expect(() =>
      act(state, { type: 'TRADE', withPlayer: 1, give: { cash: 0, structures: [] }, receive: { cash: 0, structures: [`beach:${PLAIN_BEACH}`] } }),
    ).toThrow(/not theirs/);
    expect(() =>
      act(state, { type: 'TRADE', withPlayer: 1, give: { cash: 99999, structures: [] }, receive: { cash: 0, structures: [] } }),
    ).toThrow(/cannot offer/);
  });
});

describe('bankruptcy and elimination', () => {
  it('a player who cannot cover upkeep enters settle-debt and recovers by selling', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 700);
    state = build(state, 'hotel', 'north-prom', PLAIN_NP); // hotelier price 656, upkeep 82
    state = act(state, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
    // Player 2's turn — pass through quickly.
    state = calmSeas(state);
    state = act(state, { type: 'COLLECT_INCOME' }, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
    // Back to player 0 with almost no cash; zero out tourists so upkeep bites.
    // (Force the phase in case the round-2 event already pushed them into debt.)
    state = calmSeas({ ...state, tourists: Object.fromEntries(Object.keys(state.tourists).map((z) => [z, 0])), phase: 'income', debt: 0 });
    state = withCash(state, 0, 10);
    state = act(state, { type: 'COLLECT_INCOME' });
    expect(state.phase).toBe('settle-debt');
    expect(state.debt).toBeGreaterThan(0);
    state = act(state, { type: 'SELL', zone: 'north-prom', slotIndex: PLAIN_NP });
    expect(state.phase).toBe('action');
    expect(state.players[0].cash).toBeGreaterThanOrEqual(0);
  });

  it('a round-start levy sends the player to settle-debt but returns them to their Income Phase', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    // Contrive the post-levy position: in debt before income was collected.
    state = {
      ...state,
      phase: 'settle-debt',
      settleReturn: 'income',
      debt: 80,
      players: state.players.map((p) => (p.id === 0 ? { ...p, cash: -80 } : p)),
    };
    state = applyAction(content, state, { type: 'SELL', zone: 'beach', slotIndex: PLAIN_BEACH });
    expect(state.players[0].cash).toBeGreaterThanOrEqual(0);
    expect(state.phase).toBe('income'); // the takings were not forfeited
  });

  it('declaring bankruptcy eliminates the player and frees their slots', () => {
    let state = calmSeas(act(newGame(1, 3), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', PLAIN_BEACH);
    state = { ...state, phase: 'settle-debt', debt: 500, players: state.players.map((p) => (p.id === 0 ? { ...p, cash: -500 } : p)) };
    state = applyAction(content, state, { type: 'DECLARE_BANKRUPTCY' });
    expect(state.players[0].eliminated).toBe(true);
    expect(findSlot(state, 'beach', PLAIN_BEACH)?.structure).toBeNull();
    expect(state.currentPlayer).toBe(1);
    expect(state.winnerId).toBeNull(); // two players remain
  });

  it('last solvent player wins', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = { ...state, phase: 'settle-debt', debt: 500, players: state.players.map((p) => (p.id === 0 ? { ...p, cash: -500 } : p)) };
    state = applyAction(content, state, { type: 'DECLARE_BANKRUPTCY' });
    expect(state.phase).toBe('game-over');
    expect(state.winnerId).toBe(1);
  });

  it('simultaneous bankruptcy from a levy is decided by pre-levy asset value (rule 8.4)', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    // Both players broke, player 1 holds a kiosk (higher asset value).
    state = withCash(state, 0, 5);
    state = withCash(state, 1, 5);
    state = {
      ...state,
      slots: state.slots.map((s) =>
        s.zone === 'beach' && s.index === PLAIN_BEACH ? { ...s, structure: { pieces: [KIOSK], ownerId: 1, mortgaged: false, invested: 180 } } : s,
      ),
    };
    // Apply a £220 levy via the engine's event pathway.
    const applied = applyEventForTest(state, 'council-rates');
    expect(applied.phase).toBe('game-over');
    expect(applied.winnerId).toBe(1); // kiosk owner had more assets before obligations
  });

  it('a player whose liquidation cannot cover debt is eliminated automatically', () => {
    let s2 = calmSeas(act(newGame(2, 3), { type: 'COLLECT_INCOME' }));
    s2 = withCash(s2, 0, -99999);
    s2 = { ...s2, phase: 'income' };
    const after = applyAction(content, s2, { type: 'COLLECT_INCOME' });
    expect(after.players[0].eliminated).toBe(true);
    expect(after.currentPlayer).not.toBe(0);
  });
});

describe('zone attraction sanity', () => {
  it('preferred zones and boosts raise attraction', () => {
    const state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const plain = zoneAttractions(content, state, 'spread').find((z) => z.zone === 'pier')!;
    const preferred = zoneAttractions(content, state, 'pier').find((z) => z.zone === 'pier')!;
    expect(preferred.total).toBeCloseTo(plain.total * 1.5, 5);
  });
});

describe('asset value', () => {
  it('counts cash plus unmortgaged structure value', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 1000);
    state = build(state, KIOSK, 'beach', PLAIN_BEACH); // cost 180 -> cash 820, assets 1000
    expect(assetValue(content, state, 0)).toBe(1000);
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: PLAIN_BEACH });
    expect(assetValue(content, state, 0)).toBe(892); // 820 + 72 mortgage cash, kiosk excluded
  });
});
