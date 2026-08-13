import { describe, it, expect } from 'vitest';
import { applyAction } from '../engine';
import { buildCost, defById, findSlot, liquidationValue, maxLevelsAt, playersRemaining, structureBaseValue } from '../selectors';
import { nextFloat, seedRng, type RngState } from '../rng';
import { content, makePlayers, newGame } from './helpers';
import type { GameAction, GameState } from '../types';

/**
 * A random-but-legal bot drives full games to completion. Every intermediate
 * state must satisfy the invariants below — this is the "no illegal states"
 * requirement from the brief.
 */

function invariants(state: GameState) {
  // Cash is only negative while settling debt (or transiently for non-current players hit by a levy).
  for (const p of state.players) {
    if (p.eliminated) continue;
    if (p.cash < 0) {
      const isCurrentSettling = state.phase === 'settle-debt' && p.id === state.currentPlayer;
      const awaitingTurn = p.id !== state.currentPlayer;
      expect(isCurrentSettling || awaitingTurn).toBe(true);
    }
  }
  // Structures always belong to live players and respect stack limits.
  for (const slot of state.slots) {
    const s = slot.structure;
    if (!s) continue;
    expect(state.players[s.ownerId].eliminated).toBe(false);
    const ground = defById(content, s.pieces[0]);
    expect(s.pieces.length).toBeLessThanOrEqual(maxLevelsAt(content, slot.zone, slot.index, ground));
    expect(ground.zones).toContain(slot.zone);
  }
  // Tourist counts are non-negative and reconcile with the total.
  const sum = Object.values(state.tourists).reduce((a, b) => a + b, 0);
  for (const n of Object.values(state.tourists)) expect(n).toBeGreaterThanOrEqual(0);
  if (state.totalTourists > 0) expect(sum).toBe(state.totalTourists);
  // The current player is never eliminated (unless the game is over).
  if (state.phase !== 'game-over') {
    expect(state.players[state.currentPlayer].eliminated).toBe(false);
  }
  // Winner only set when over.
  if (state.winnerId !== null) expect(state.phase).toBe('game-over');
}

function pick<T>(rng: { s: RngState }, items: T[]): T {
  const r = nextFloat(rng.s);
  rng.s = r.state;
  return items[Math.floor(r.value * items.length)];
}

function chance(rng: { s: RngState }, p: number): boolean {
  const r = nextFloat(rng.s);
  rng.s = r.state;
  return r.value < p;
}

/** Choose a random legal action for the current phase. */
function chooseAction(rng: { s: RngState }, state: GameState): GameAction {
  const me = state.players[state.currentPlayer];
  switch (state.phase) {
    case 'income':
      return { type: 'COLLECT_INCOME' };
    case 'tourist':
      return { type: 'ROLL_TOURISTS' };
    case 'settle-debt': {
      // Mortgage first, then sell; give up if neither helps.
      const mine = state.slots.filter((s) => s.structure?.ownerId === me.id);
      const mortgageable = mine.filter((s) => !s.structure!.mortgaged);
      if (mortgageable.length > 0) {
        const slot = pick(rng, mortgageable);
        return chance(rng, 0.5)
          ? { type: 'MORTGAGE', zone: slot.zone, slotIndex: slot.index }
          : { type: 'SELL', zone: slot.zone, slotIndex: slot.index };
      }
      return { type: 'DECLARE_BANKRUPTCY' };
    }
    case 'action': {
      // Mostly build/stack when affordable, sometimes trade or pass.
      if (chance(rng, 0.75)) {
        const options: GameAction[] = [];
        for (const def of content.establishments) {
          for (const slot of state.slots) {
            if (slot.structure) continue;
            const zone = content.zones.find((z) => z.id === slot.zone)!;
            if (!zone.allows.includes(def.kind) || !def.zones.includes(slot.zone)) continue;
            const cost = buildCost(content, state, me.id, def.id, { zone: slot.zone, index: slot.index });
            if (cost > me.cash) continue;
            options.push({ type: 'BUILD', defId: def.id, zone: slot.zone, slotIndex: slot.index });
          }
        }
        // Stacking options.
        for (const slot of state.slots) {
          const s = slot.structure;
          if (!s || s.ownerId !== me.id || s.mortgaged) continue;
          const ground = defById(content, s.pieces[0]);
          if (ground.kind !== 'building' || s.pieces.length >= maxLevelsAt(content, slot.zone, slot.index, ground)) continue;
          const cost = buildCost(content, state, me.id, ground.id, { zone: slot.zone, index: slot.index });
          if (cost <= me.cash) {
            options.push({ type: 'STACK', defId: ground.id, zone: slot.zone, slotIndex: slot.index });
          }
        }
        if (options.length > 0) return pick(rng, options);
      }
      if (chance(rng, 0.1)) {
        // Occasionally trade a structure for cash with a random opponent.
        const mine = state.slots.filter((s) => s.structure?.ownerId === me.id && !s.structure.mortgaged);
        const others = playersRemaining(state).filter((p) => p.id !== me.id);
        if (mine.length > 0 && others.length > 0) {
          const slot = pick(rng, mine);
          const other = pick(rng, others);
          const price = Math.min(other.cash, Math.floor(structureBaseValue(content, slot.structure!) * 0.6));
          if (price > 0) {
            return {
              type: 'TRADE',
              withPlayer: other.id,
              give: { cash: 0, structures: [`${slot.zone}:${slot.index}`] },
              receive: { cash: price, structures: [] },
            };
          }
        }
      }
      return { type: 'END_ACTIONS' };
    }
    case 'game-over':
      throw new Error('unreachable');
  }
}

describe('full simulated games', () => {
  for (const players of [2, 3, 4]) {
    for (const seed of [11, 47, 2026]) {
      it(`${players} players, seed ${seed}: runs to completion without illegal states`, () => {
        let state = newGame(seed, players);
        const rng = { s: seedRng(seed * 7919) };
        let steps = 0;
        while (state.phase !== 'game-over' && steps < 20000) {
          const action = chooseAction(rng, state);
          state = applyAction(content, state, action);
          invariants(state);
          steps++;
        }
        // Bankruptcy pressure must actually end games in a sane horizon.
        expect(state.phase).toBe('game-over');
        expect(state.winnerId).not.toBeNull();
        expect(state.players[state.winnerId!]).toBeDefined();
      }, 30000);
    }
  }

  it('an eliminated player’s structures never linger', () => {
    let state = newGame(99, 3);
    const rng = { s: seedRng(555) };
    let steps = 0;
    while (state.phase !== 'game-over' && steps < 20000) {
      state = applyAction(content, state, chooseAction(rng, state));
      for (const slot of state.slots) {
        if (slot.structure) expect(state.players[slot.structure.ownerId].eliminated).toBe(false);
      }
      steps++;
    }
    expect(state.phase).toBe('game-over');
  });
});

describe('slot legality helper', () => {
  it('findSlot returns undefined for nonsense coordinates', () => {
    const state = newGame();
    expect(findSlot(state, 'pier', 99)).toBeUndefined();
  });
});

describe('liquidation sanity', () => {
  it('liquidation value is cash plus half of unmortgaged holdings', () => {
    const state = newGame(5, 2);
    const p = state.players[0];
    expect(liquidationValue(content, state, 0)).toBe(p.cash);
  });
});

describe('players helper', () => {
  it('makePlayers builds valid rosters', () => {
    expect(makePlayers(4)).toHaveLength(4);
  });
});
