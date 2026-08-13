import { describe, it, expect } from 'vitest';
import { applyAction, createGame, deserialize, drawEvent, serialize, EngineError } from '../engine';
import {
  assetValue,
  clusterSizes,
  computeIncome,
  distributeTourists,
  findSlot,
  slotKey,
  structureAttraction,
  zoneAttractions,
} from '../selectors';
import { act, calmSeas, content, makePlayers, newGame, withCash, withTourists } from './helpers';
import type { GameState } from '../types';

const CAFE = 'cafe';
const KIOSK = 'ice-cream';

function build(state: GameState, defId: string, zone: string, slotIndex: number): GameState {
  return act(state, { type: 'BUILD', defId, zone, slotIndex });
}

describe('game creation', () => {
  it('deals starting capital by player count (round-1 event may shift it slightly)', () => {
    expect(newGame(1, 2).players.every((p) => Math.abs(p.cash - 1800) <= 150)).toBe(true);
    expect(newGame(1, 3).players.every((p) => Math.abs(p.cash - 1500) <= 150)).toBe(true);
    expect(newGame(1, 4).players.every((p) => Math.abs(p.cash - 1300) <= 150)).toBe(true);
  });

  it('creates every zone slot', () => {
    const state = newGame();
    const total = content.zones.reduce((s, z) => s + z.slots, 0);
    expect(state.slots).toHaveLength(total);
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
    state = build(state, KIOSK, 'beach', 0);
    expect(state.players[0].cash).toBe(cashBefore - 100);
    expect(findSlot(state, 'beach', 0)?.structure?.pieces).toEqual([KIOSK]);
    expect(findSlot(state, 'beach', 0)?.structure?.ownerId).toBe(0);
  });

  it('applies the Hotelier build discount to buildings', () => {
    // Player 0 in the helper roster is the hotelier (15% off buildings).
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    const cashBefore = state.players[0].cash;
    state = build(state, CAFE, 'north-prom', 0);
    expect(state.players[0].cash).toBe(cashBefore - Math.round(250 * 0.85));
  });

  it('rejects occupied slots, wrong zones, and empty purses', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    expect(() => build(state, KIOSK, 'beach', 0)).toThrow(/occupied/);
    expect(() => build(state, CAFE, 'beach', 1)).toThrow(/cannot be placed/);
    const broke = withCash(state, 0, 10);
    expect(() => build(broke, KIOSK, 'beach', 1)).toThrow(/Not enough cash/);
  });

  it('rejects building outside the action phase', () => {
    const state = newGame();
    expect(state.phase).toBe('income');
    expect(() => build(state, KIOSK, 'beach', 0)).toThrow(/Action Phase/);
  });
});

describe('stacking', () => {
  function withCafe(): GameState {
    return build(calmSeas(act(newGame(), { type: 'COLLECT_INCOME' })), CAFE, 'north-prom', 0);
  }

  it('stacks a building and raises attraction by the level curve', () => {
    let state = withCafe();
    const clusters = clusterSizes(state);
    const level1 = structureAttraction(content, state, findSlot(state, 'north-prom', 0)!, clusters);
    state = act(state, { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: 0 });
    const slot = findSlot(state, 'north-prom', 0)!;
    expect(slot.structure?.pieces).toHaveLength(2);
    const level2 = structureAttraction(content, state, slot, clusterSizes(state));
    expect(level2 / level1).toBeCloseTo(1.6, 5); // levelMult[1] / levelMult[0]
  });

  it('enforces max height and ownership', () => {
    let state = withCafe();
    state = act(
      state,
      { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: 0 },
      { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: 0 },
    );
    expect(() => act(state, { type: 'STACK', defId: CAFE, zone: 'north-prom', slotIndex: 0 })).toThrow(/maximum height/);
  });

  it('kiosks and monuments cannot stack', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    expect(() => act(state, { type: 'STACK', defId: KIOSK, zone: 'beach', slotIndex: 0 })).toThrow(/Only buildings/);
  });
});

describe('clusters', () => {
  it('finds maximal adjacent runs within a zone', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 0);
    state = build(state, KIOSK, 'beach', 1);
    state = build(state, KIOSK, 'beach', 2);
    state = build(state, KIOSK, 'beach', 4); // gap at 3 — separate cluster
    const sizes = clusterSizes(state);
    expect(sizes.get(slotKey('beach', 0))).toBe(3);
    expect(sizes.get(slotKey('beach', 1))).toBe(3);
    expect(sizes.get(slotKey('beach', 2))).toBe(3);
    expect(sizes.get(slotKey('beach', 4))).toBe(1);
  });

  it('applies the exponential cluster multiplier to attraction', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 0);
    const solo = structureAttraction(content, state, findSlot(state, 'beach', 0)!, clusterSizes(state));
    state = build(state, KIOSK, 'beach', 1);
    const paired = structureAttraction(content, state, findSlot(state, 'beach', 0)!, clusterSizes(state));
    expect(paired / solo).toBeCloseTo(1.25, 5); // clusterBase^(2-1)
  });

  it('mortgaged structures break clusters and attract nothing', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 0);
    state = build(state, KIOSK, 'beach', 1);
    state = build(state, KIOSK, 'beach', 2);
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: 1 });
    const sizes = clusterSizes(state);
    expect(sizes.get(slotKey('beach', 0))).toBe(1);
    expect(sizes.get(slotKey('beach', 2))).toBe(1);
    expect(sizes.get(slotKey('beach', 1))).toBeUndefined();
    expect(structureAttraction(content, state, findSlot(state, 'beach', 1)!, sizes)).toBe(0);
  });
});

describe('tourist distribution', () => {
  it('splits tourists proportionally to zone attraction and reconciles the total', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 0);
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

describe('income', () => {
  it('computes gross from routed tourists and subtracts maintenance', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0); // sole structure on the beach
    state = withTourists(state, { beach: 50 });
    const report = computeIncome(content, state, 0);
    const line = report.lines[0];
    // Sole structure receives all 50 beach tourists at £1 each, £10 upkeep.
    expect(line.tourists).toBe(50);
    expect(line.gross).toBe(50);
    expect(line.maintenance).toBe(10);
    expect(report.net).toBe(40);
  });

  it('splits zone tourists across structures by attraction', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'beach', 0); // attraction 3
    state = build(state, 'deckchairs', 'beach', 3); // attraction 2, non-adjacent
    state = withTourists(state, { beach: 100 });
    const report = computeIncome(content, state, 0);
    const iceCream = report.lines.find((l) => l.slotKey === 'beach:0')!;
    const chairs = report.lines.find((l) => l.slotKey === 'beach:3')!;
    expect(iceCream.tourists).toBe(60);
    expect(chairs.tourists).toBe(40);
  });

  it('mortgaged structures earn nothing but still owe half upkeep', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: 0 });
    state = withTourists(state, { beach: 50 });
    const report = computeIncome(content, state, 0);
    expect(report.lines[0].gross).toBe(0);
    expect(report.lines[0].maintenance).toBe(5);
  });

  it('the Banker collects a flat bonus; the Kiosk Queen skips kiosk upkeep', () => {
    let state = calmSeas(act(newGame(1, 4), { type: 'COLLECT_INCOME' }));
    // Player 3 is the banker in the helper roster.
    const banker = computeIncome(content, state, 3);
    expect(banker.characterBonus).toBe(40);
    // Player 2 is the kiosk queen: give her a kiosk.
    state = { ...state, currentPlayer: 2, phase: 'action' };
    state = build(state, KIOSK, 'beach', 0);
    const queen = computeIncome(content, state, 2);
    expect(queen.lines[0].maintenance).toBe(0);
  });
});

describe('disasters', () => {
  function stormState(): GameState {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, 'donuts', 'pier', 0); // not storm-resistant
    state = build(state, 'pavilion', 'pier', 2); // sturdy
    return state;
  }

  function withDisaster(state: GameState, id: 'storm' | 'pollution' | 'seagulls'): GameState {
    const def = content.disasters.find((d) => d.id === id)!;
    return {
      ...state,
      activeEffects: [
        ...state.activeEffects,
        { sourceName: def.name, effect: { type: 'disasterActive', disaster: id }, remainingRounds: def.duration, icon: def.icon },
      ],
    };
  }

  it('a storm zeroes non-resistant pier structures but spares sturdy ones', () => {
    let state = stormState();
    state = withDisaster(state, 'storm');
    const clusters = clusterSizes(state);
    expect(structureAttraction(content, state, findSlot(state, 'pier', 0)!, clusters)).toBe(0);
    expect(structureAttraction(content, state, findSlot(state, 'pier', 2)!, clusters)).toBeGreaterThan(0);
  });

  it('storm suppresses income on affected structures', () => {
    let state = stormState();
    state = withDisaster(state, 'storm');
    state = withTourists(state, { pier: 60 });
    const report = computeIncome(content, state, 0);
    const donuts = report.lines.find((l) => l.slotKey === 'pier:0')!;
    const pavilion = report.lines.find((l) => l.slotKey === 'pier:2')!;
    expect(donuts.gross).toBe(0);
    expect(pavilion.gross).toBeGreaterThan(0);
  });

  it('seagulls only hit kiosks', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 10000);
    state = build(state, KIOSK, 'north-prom', 0); // kiosk, unprotected
    state = build(state, CAFE, 'north-prom', 2); // building — gulls don't care
    const before = clusterSizes(state);
    const kioskBefore = structureAttraction(content, state, findSlot(state, 'north-prom', 0)!, before);
    const cafeBefore = structureAttraction(content, state, findSlot(state, 'north-prom', 2)!, before);
    state = withDisaster(state, 'seagulls');
    const after = clusterSizes(state);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', 0)!, after)).toBeCloseTo(kioskBefore * 0.75, 5);
    expect(structureAttraction(content, state, findSlot(state, 'north-prom', 2)!, after)).toBeCloseTo(cafeBefore, 5);
  });

  it('the Engineer resists storms', () => {
    let state = calmSeas(act(newGame(1, 4), { type: 'COLLECT_INCOME' }));
    // Player 3 would be banker; engineer isn't in the default roster — build one.
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 0 ? { ...p, characterId: 'engineer' } : p)),
    };
    state = withCash(state, 0, 10000);
    state = build(state, 'donuts', 'pier', 0);
    state = withDisaster(state, 'storm');
    expect(structureAttraction(content, state, findSlot(state, 'pier', 0)!, clusterSizes(state))).toBeGreaterThan(0);
  });

  it('disasters expire after their duration', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withDisaster(state, 'seagulls'); // duration 1
    // Complete the round: P1 acts+rolls, P2 income/act/rolls -> new round.
    state = act(state, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
    state = act(state, { type: 'COLLECT_INCOME' }, { type: 'END_ACTIONS' }, { type: 'ROLL_TOURISTS' });
    expect(state.activeEffects.filter((e) => e.effect.type === 'disasterActive' && e.effect.disaster === 'seagulls')).toHaveLength(0);
  });
});

describe('sell, mortgage, trade', () => {
  it('selling returns half the invested cost', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    const cashBefore = state.players[0].cash;
    state = act(state, { type: 'SELL', zone: 'beach', slotIndex: 0 });
    expect(state.players[0].cash).toBe(cashBefore + 50);
    expect(findSlot(state, 'beach', 0)?.structure).toBeNull();
  });

  it('mortgage pays 40%, unmortgage costs 50%', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    let cash = state.players[0].cash;
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: 0 });
    expect(state.players[0].cash).toBe(cash + 40);
    cash = state.players[0].cash;
    state = act(state, { type: 'UNMORTGAGE', zone: 'beach', slotIndex: 0 });
    expect(state.players[0].cash).toBe(cash - 50);
    expect(findSlot(state, 'beach', 0)?.structure?.mortgaged).toBe(false);
  });

  it('executes an atomic two-sided trade', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    const p0Cash = state.players[0].cash;
    const p1Cash = state.players[1].cash;
    state = act(state, {
      type: 'TRADE',
      withPlayer: 1,
      give: { cash: 0, structures: ['beach:0'] },
      receive: { cash: 200, structures: [] },
    });
    expect(findSlot(state, 'beach', 0)?.structure?.ownerId).toBe(1);
    expect(state.players[0].cash).toBe(p0Cash + 200);
    expect(state.players[1].cash).toBe(p1Cash - 200);
  });

  it('rejects trading structures you do not own and cash you do not have', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    expect(() =>
      act(state, { type: 'TRADE', withPlayer: 1, give: { cash: 0, structures: [] }, receive: { cash: 0, structures: ['beach:0'] } }),
    ).toThrow(/not theirs/);
    expect(() =>
      act(state, { type: 'TRADE', withPlayer: 1, give: { cash: 99999, structures: [] }, receive: { cash: 0, structures: [] } }),
    ).toThrow(/cannot offer/);
  });
});

describe('bankruptcy and elimination', () => {
  it('a player who cannot cover upkeep enters settle-debt and recovers by selling', () => {
    let state = calmSeas(act(newGame(), { type: 'COLLECT_INCOME' }));
    state = withCash(state, 0, 460);
    state = build(state, 'hotel', 'north-prom', 0); // hotelier price 383, upkeep 45
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
    state = act(state, { type: 'SELL', zone: 'north-prom', slotIndex: 0 });
    expect(state.phase).toBe('action');
    expect(state.players[0].cash).toBeGreaterThanOrEqual(0);
  });

  it('declaring bankruptcy eliminates the player and frees their slots', () => {
    let state = calmSeas(act(newGame(1, 3), { type: 'COLLECT_INCOME' }));
    state = build(state, KIOSK, 'beach', 0);
    state = { ...state, phase: 'settle-debt', debt: 500, players: state.players.map((p) => (p.id === 0 ? { ...p, cash: -500 } : p)) };
    state = applyAction(content, state, { type: 'DECLARE_BANKRUPTCY' });
    expect(state.players[0].eliminated).toBe(true);
    expect(findSlot(state, 'beach', 0)?.structure).toBeNull();
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
        s.zone === 'beach' && s.index === 0 ? { ...s, structure: { pieces: [KIOSK], ownerId: 1, mortgaged: false } } : s,
      ),
    };
    // Apply a £120 levy via the engine's event pathway.
    const levy = content.events.find((e) => e.id === 'council-rates')!;
    const applied = applyEventForTest(state, levy.id);
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

/** Draw a specific card through the engine's real event pathway. */
function applyEventForTest(state: GameState, cardId: string): GameState {
  return drawEvent(content, { ...state, eventDeck: [cardId], eventDiscard: [] });
}

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
    state = build(state, KIOSK, 'beach', 0); // cost 100 -> cash 900, assets 1000
    expect(assetValue(content, state, 0)).toBe(1000);
    state = act(state, { type: 'MORTGAGE', zone: 'beach', slotIndex: 0 });
    expect(assetValue(content, state, 0)).toBe(940); // 900 + 40 mortgage cash, kiosk excluded
  });
});
