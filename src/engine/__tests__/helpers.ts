import { BASE_CONTENT } from '../content';
import { createGame, applyAction } from '../engine';
import type { GameAction, GameConfig, GameState, SetupPlayer } from '../types';

export const content = BASE_CONTENT;

export function makePlayers(n: number): SetupPlayer[] {
  const colors = ['#E8604C', '#1B9AAA', '#E9B44C', '#7768AE'];
  const shapes = ['triangle', 'swallowtail', 'square', 'circle'] as const;
  const chars = ['hotelier', 'showman', 'kiosk-queen', 'banker'];
  return Array.from({ length: n }, (_, i) => ({
    name: `Player ${i + 1}`,
    color: colors[i],
    flagShape: shapes[i],
    characterId: chars[i],
  }));
}

export function newGame(seed = 42, players = 2, config?: Partial<GameConfig>): GameState {
  return createGame(content, { seed, players: makePlayers(players), ...config });
}

export function act(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, a) => applyAction(content, s, a), state);
}

/** Give a player cash directly (test setup only). */
export function withCash(state: GameState, playerId: number, cash: number): GameState {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? { ...p, cash } : p)) };
}

/** Force a specific tourist distribution (test setup only). */
export function withTourists(state: GameState, byZone: Record<string, number>): GameState {
  const tourists = { ...state.tourists, ...byZone };
  return { ...state, tourists, totalTourists: Object.values(tourists).reduce((a, b) => a + b, 0) };
}

/** Clear all active effects (test setup only — removes the round-1 event). */
export function calmSeas(state: GameState): GameState {
  return { ...state, activeEffects: [] };
}
