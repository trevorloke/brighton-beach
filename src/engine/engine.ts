import { nextInt, seedRng, shuffle } from './rng';
import type {
  ActiveEffect,
  ContentPack,
  DisasterId,
  EventCardDef,
  GameAction,
  GameConfig,
  GameState,
  LogEntry,
  Phase,
  Slot,
  TradeSide,
  ZoneId,
} from './types';
import {
  assetValue,
  buildCost,
  computeIncome,
  defById,
  distributeTourists,
  findSlot,
  liquidationValue,
  maxLevelsAt,
  playersRemaining,
  rentMultiplier,
  seasonForRound,
  sellPctFor,
  slotKey,
  structureBaseValue,
} from './selectors';

/**
 * The Brighton Beach engine: a pure state machine. `createGame` builds the
 * initial state; `applyAction` validates an action against the current phase
 * and returns the next state (throwing EngineError on illegal moves). No UI
 * concerns, no side effects, deterministic given the seed — ready to move
 * server-side for online play.
 */

export class EngineError extends Error {}

function assertEngine(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new EngineError(msg);
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export function createGame(content: ContentPack, config: GameConfig): GameState {
  assertEngine(config.players.length >= 2 && config.players.length <= 4, 'Brighton Beach seats 2–4 players');
  const capital = content.rules.startingCapital[config.players.length];
  assertEngine(capital !== undefined, `No starting capital defined for ${config.players.length} players`);

  let rng = seedRng(config.seed);
  const deckShuffle = shuffle(rng, content.events.map((e) => e.id));
  rng = deckShuffle.state;

  const slots: Slot[] = [];
  for (const zone of content.zones) {
    for (let i = 0; i < zone.slots; i++) slots.push({ zone: zone.id, index: i, structure: null });
  }

  const state: GameState = {
    schemaVersion: 2,
    seed: config.seed,
    rng,
    players: config.players.map((p, id) => ({
      id,
      name: p.name,
      color: p.color,
      flagShape: p.flagShape,
      characterId: p.characterId,
      cash: capital,
      eliminated: false,
      eliminatedRound: null,
      assetValueAtElimination: null,
    })),
    slots,
    round: 1,
    currentPlayer: 0,
    phase: 'income',
    tourists: Object.fromEntries(content.zones.map((z) => [z.id, 0])),
    totalTourists: 0,
    preferredZone: 'spread',
    eventDeck: deckShuffle.value,
    eventDiscard: [],
    activeEffects: [],
    lastEvent: null,
    lastDice: null,
    lastIncome: null,
    debt: 0,
    settleReturn: 'action',
    winnerId: null,
    log: [],
  };

  let opened = log(state, 'info', `The season opens on Brighton Beach. Each entrepreneur starts with £${capital}.`);
  const season = seasonForRound(content, 1);
  opened = log(opened, 'season', `${season.icon} ${season.name}. ${season.blurb}`);
  // Round 1 begins with an event draw, like every round.
  return drawEvent(content, opened);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function log(state: GameState, kind: LogEntry['kind'], text: string): GameState {
  return { ...state, log: [...state.log, { round: state.round, text, kind }] };
}

function withPlayerCash(state: GameState, playerId: number, delta: number): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, cash: p.cash + delta } : p)),
  };
}

function currentName(state: GameState): string {
  return state.players[state.currentPlayer].name;
}

function activePlayerIdsFrom(state: GameState, afterId: number): number[] {
  const n = state.players.length;
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    const id = (afterId + i) % n;
    if (!state.players[id].eliminated) out.push(id);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Events and disasters                                                */
/* ------------------------------------------------------------------ */

function triggerDisaster(content: ContentPack, state: GameState, id: DisasterId, source: string): GameState {
  const def = content.disasters.find((d) => d.id === id);
  assertEngine(def, `Unknown disaster ${id}`);
  // A repeat strike refreshes the duration rather than stacking the penalty.
  const existing = state.activeEffects.find(
    (e) => e.effect.type === 'disasterActive' && e.effect.disaster === id,
  );
  let effects: ActiveEffect[];
  if (existing) {
    effects = state.activeEffects.map((e) =>
      e === existing ? { ...e, remainingRounds: def.duration } : e,
    );
  } else {
    effects = [
      ...state.activeEffects,
      { sourceName: def.name, effect: { type: 'disasterActive', disaster: id }, remainingRounds: def.duration, icon: def.icon },
    ];
  }
  let next = { ...state, activeEffects: effects };
  next = log(next, 'disaster', `${def.icon} ${def.name}! ${def.description} (${source}, ${def.duration} round${def.duration > 1 ? 's' : ''})`);
  return next;
}

/**
 * Apply a cash change to every remaining player at once (levies, grants,
 * per-structure charges). Handles rule 8.4: if a shared levy sinks every
 * remaining player beyond recovery, they all go under together and the
 * highest asset value before the obligation wins.
 */
function applyGroupCash(
  content: ContentPack,
  state: GameState,
  deltaFor: (playerId: number) => number,
  cardName: string,
): GameState {
  let next = state;
  const before = new Map(playersRemaining(next).map((p) => [p.id, assetValue(content, next, p.id)]));
  let anyCharge = false;
  for (const p of playersRemaining(next)) {
    const delta = deltaFor(p.id);
    if (delta === 0) continue;
    if (delta < 0) anyCharge = true;
    next = withPlayerCash(next, p.id, delta);
  }
  if (anyCharge) {
    const remaining = playersRemaining(next);
    const allSunk = remaining.every((p) => liquidationValue(content, next, p.id) < 0);
    if (allSunk && remaining.length > 0) {
      // Simultaneous bankruptcy: everyone goes under together.
      next = {
        ...next,
        players: next.players.map((p) =>
          p.eliminated
            ? p
            : { ...p, eliminated: true, eliminatedRound: next.round, assetValueAtElimination: before.get(p.id) ?? 0, cash: 0 },
        ),
        slots: next.slots.map((s) => ({ ...s, structure: null })),
      };
      next = log(next, 'elimination', `💸 ${cardName} bankrupts every remaining player at once.`);
      next = checkVictory(content, next);
    }
  }
  return next;
}

function applyEventCard(content: ContentPack, state: GameState, card: EventCardDef): GameState {
  let next = state;
  for (const effect of card.effects) {
    if (next.phase === 'game-over') return next;
    switch (effect.type) {
      case 'touristDelta':
      case 'zoneBoost':
      case 'kindBoost':
      case 'globalMult':
        next = {
          ...next,
          activeEffects: [
            ...next.activeEffects,
            { sourceName: card.name, effect, remainingRounds: effect.duration, icon: iconFor(card) },
          ],
        };
        break;
      case 'cashAll': {
        const verb = effect.amount >= 0 ? 'receives' : 'pays';
        next = applyGroupCash(content, next, () => effect.amount, card.name);
        next = log(next, 'money', `Every player ${verb} £${Math.abs(effect.amount)} (${card.name}).`);
        break;
      }
      case 'perStructureCash': {
        const counts = new Map<number, number>();
        for (const slot of next.slots) {
          const s = slot.structure;
          if (!s) continue;
          if (effect.kind && defById(content, s.pieces[0]).kind !== effect.kind) continue;
          counts.set(s.ownerId, (counts.get(s.ownerId) ?? 0) + 1);
        }
        const verb = effect.amount >= 0 ? 'receives' : 'pays';
        const what = effect.kind ? `${effect.kind}` : 'establishment';
        next = applyGroupCash(content, next, (id) => (counts.get(id) ?? 0) * effect.amount, card.name);
        next = log(next, 'money', `Every player ${verb} £${Math.abs(effect.amount)} per ${what} (${card.name}).`);
        break;
      }
      case 'transferRichPoor': {
        const remaining = playersRemaining(next);
        if (remaining.length < 2) break;
        const richest = [...remaining].sort((a, b) => b.cash - a.cash || a.id - b.id)[0];
        const poorest = [...remaining].sort((a, b) => a.cash - b.cash || a.id - b.id)[0];
        if (richest.id === poorest.id) break;
        next = withPlayerCash(next, richest.id, -effect.amount);
        next = withPlayerCash(next, poorest.id, effect.amount);
        next = log(next, 'money', `${richest.name} donates £${effect.amount} to ${poorest.name} (${card.name}).`);
        break;
      }
      case 'cashCurrent': {
        next = withPlayerCash(next, next.currentPlayer, effect.amount);
        const verb = effect.amount >= 0 ? 'receives' : 'pays';
        next = log(next, 'money', `${currentName(next)} ${verb} £${Math.abs(effect.amount)} (${card.name}).`);
        break;
      }
      case 'disaster':
        next = triggerDisaster(content, next, effect.disaster, card.name);
        break;
    }
  }
  return next;
}

function iconFor(card: EventCardDef): string {
  switch (card.category) {
    case 'boom': return '☀️';
    case 'shift': return '🎠';
    case 'windfall': return '💷';
    case 'levy': return '🧾';
    case 'economy': return '🏗️';
    case 'disaster': return '⚠️';
  }
}

export function drawEvent(content: ContentPack, state: GameState): GameState {
  let deck = state.eventDeck;
  let discard = state.eventDiscard;
  let rng = state.rng;
  if (deck.length === 0) {
    const re = shuffle(rng, discard);
    deck = re.value;
    discard = [];
    rng = re.state;
  }
  const [cardId, ...rest] = deck;
  const card = content.events.find((e) => e.id === cardId)!;
  let next: GameState = { ...state, rng, eventDeck: rest, eventDiscard: [...discard, cardId], lastEvent: cardId };
  next = log(next, 'event', `Event: ${card.name} — ${card.description}`);
  next = applyEventCard(content, next, card);
  // A levy can push players under immediately; anyone who cannot possibly pay
  // is handled when their income phase begins (settle-debt), but if the CURRENT
  // player is now negative they must settle before acting.
  return next;
}

/** Tick down durations at the end of a full round. */
function expireEffects(state: GameState): GameState {
  const kept: ActiveEffect[] = [];
  let next = state;
  for (const eff of state.activeEffects) {
    if (eff.remainingRounds > 1) kept.push({ ...eff, remainingRounds: eff.remainingRounds - 1 });
    else next = log(next, 'info', `${eff.icon} ${eff.sourceName} has passed.`);
  }
  return { ...next, activeEffects: kept };
}

/* ------------------------------------------------------------------ */
/* Bankruptcy                                                          */
/* ------------------------------------------------------------------ */

function eliminate(content: ContentPack, state: GameState, playerId: number, reason: string): GameState {
  const value = assetValue(content, state, playerId);
  let next: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, eliminated: true, eliminatedRound: state.round, assetValueAtElimination: value, cash: 0 }
        : p,
    ),
    // Establishments of a bankrupt player return to the bank (slots reopen).
    slots: state.slots.map((s) =>
      s.structure?.ownerId === playerId ? { ...s, structure: null } : s,
    ),
    debt: playerId === state.currentPlayer ? 0 : state.debt,
  };
  next = log(next, 'elimination', `💸 ${state.players[playerId].name} is bankrupt and leaves the seafront. ${reason}`);
  return checkVictory(content, next);
}

function checkVictory(_content: ContentPack, state: GameState): GameState {
  const remaining = playersRemaining(state);
  if (remaining.length === 1) {
    let next: GameState = { ...state, phase: 'game-over', winnerId: remaining[0].id };
    return log(next, 'info', `🏆 ${remaining[0].name} is the last solvent entrepreneur. Brighton Beach is theirs!`);
  }
  if (remaining.length === 0) {
    // Simultaneous bankruptcy (rule 8.4): among players who went under in the
    // final round, highest asset value before obligations wins.
    const finalRound = Math.max(...state.players.map((p) => p.eliminatedRound ?? 0));
    const candidates = state.players.filter((p) => p.eliminatedRound === finalRound);
    const best = [...candidates].sort(
      (a, b) => (b.assetValueAtElimination ?? 0) - (a.assetValueAtElimination ?? 0),
    )[0];
    let next: GameState = { ...state, phase: 'game-over', winnerId: best.id };
    return log(next, 'info', `🏆 All players went under together — ${best.name} wins on assets (£${best.assetValueAtElimination}).`);
  }
  return state;
}

/**
 * Called when the current player's cash is negative. Either enters settle-debt
 * (they can still raise the money) or eliminates them outright.
 */
function enforceSolvency(content: ContentPack, state: GameState): GameState {
  const player = state.players[state.currentPlayer];
  if (player.eliminated || player.cash >= 0) return state;
  const shortfall = -player.cash;
  if (liquidationValue(content, state, player.id) < 0) {
    const next = eliminate(content, state, player.id, 'Even selling everything could not cover the debt.');
    if (next.phase === 'game-over') return next;
    return advanceToNextPlayer(content, next);
  }
  // A levy that strikes before the Income Phase must not cost the player
  // their takings: remember where to resume once they are solvent.
  const settleReturn = state.phase === 'income' ? 'income' : 'action';
  let next: GameState = { ...state, phase: 'settle-debt', debt: shortfall, settleReturn };
  return log(next, 'money', `${player.name} is £${shortfall} short and must sell or mortgage to stay in the game.`);
}

/* ------------------------------------------------------------------ */
/* Turn flow                                                           */
/* ------------------------------------------------------------------ */

function advanceToNextPlayer(content: ContentPack, state: GameState): GameState {
  const order = activePlayerIdsFrom(state, state.currentPlayer);
  assertEngine(order.length > 0, 'No active players left');
  const nextId = order[0];
  let next = state;
  const wrapped = nextId <= state.currentPlayer;
  if (wrapped) {
    next = expireEffects(next);
    next = { ...next, round: next.round + 1 };
    next = log(next, 'phase', `— Round ${next.round} —`);
    const season = seasonForRound(content, next.round);
    next = log(next, 'season', `${season.icon} ${season.name}. ${season.blurb}`);
    const rentNow = rentMultiplier(content, next.round);
    if (rentNow > rentMultiplier(content, next.round - 1)) {
      next = log(next, 'money', `📈 Rents rise along the front — upkeep is now ×${rentNow.toFixed(2)}.`);
    }
    next = { ...next, currentPlayer: nextId, phase: 'income' as Phase };
    next = drawEvent(content, next);
  } else {
    next = { ...next, currentPlayer: nextId, phase: 'income' as Phase };
  }
  // If an event levy already sank the incoming player, they must settle first.
  return enforceSolvency(content, next);
}

/* ------------------------------------------------------------------ */
/* Action application                                                  */
/* ------------------------------------------------------------------ */

export function applyAction(content: ContentPack, state: GameState, action: GameAction): GameState {
  assertEngine(state.phase !== 'game-over', 'The game is over');
  const player = state.players[state.currentPlayer];
  assertEngine(!player.eliminated, 'Eliminated players cannot act');

  switch (action.type) {
    case 'COLLECT_INCOME': {
      assertEngine(state.phase === 'income', 'Not the Income Phase');
      const report = computeIncome(content, state, player.id);
      let next = withPlayerCash(state, player.id, report.net);
      next = { ...next, lastIncome: report, phase: 'action' };
      next = log(
        next,
        'money',
        `${player.name} collects £${report.gross + report.characterBonus} and pays £${report.maintenance} upkeep (net ${report.net >= 0 ? '+' : ''}£${report.net}).`,
      );
      return enforceSolvency(content, next);
    }

    case 'BUILD': {
      assertEngine(state.phase === 'action', 'Building happens in the Action Phase');
      const def = defById(content, action.defId);
      const zone = content.zones.find((z) => z.id === action.zone);
      assertEngine(zone, `Unknown zone ${action.zone}`);
      assertEngine(zone.allows.includes(def.kind), `${def.name} cannot be placed in ${zone.name}`);
      assertEngine(def.zones.includes(zone.id), `${def.name} cannot be placed in ${zone.name}`);
      const slot = findSlot(state, action.zone, action.slotIndex);
      assertEngine(slot, 'No such slot');
      assertEngine(!slot.structure, 'That slot is already occupied');
      const cost = buildCost(content, state, player.id, def.id, { zone: action.zone, index: action.slotIndex });
      assertEngine(player.cash >= cost, `Not enough cash (£${cost} needed)`);
      let next = withPlayerCash(state, player.id, -cost);
      next = {
        ...next,
        slots: next.slots.map((s) =>
          s === slot ? { ...s, structure: { pieces: [def.id], ownerId: player.id, mortgaged: false, invested: cost } } : s,
        ),
      };
      return log(next, 'build', `${player.name} opens ${def.name} — ${zone.name} — for £${cost}.`);
    }

    case 'STACK': {
      assertEngine(state.phase === 'action', 'Stacking happens in the Action Phase');
      const def = defById(content, action.defId);
      assertEngine(def.kind === 'building', 'Only buildings can be stacked');
      const slot = findSlot(state, action.zone, action.slotIndex);
      assertEngine(slot?.structure, 'Nothing there to stack on');
      const structure = slot.structure;
      assertEngine(structure.ownerId === player.id, 'You can only stack on your own structures');
      assertEngine(!structure.mortgaged, 'Cannot stack on a mortgaged structure');
      const groundDef = defById(content, structure.pieces[0]);
      assertEngine(groundDef.kind === 'building', 'Only buildings can be stacked upon');
      const ceiling = maxLevelsAt(content, slot.zone, slot.index, groundDef);
      assertEngine(
        structure.pieces.length < ceiling,
        ceiling < groundDef.maxLevels
          ? 'The ground here cannot bear another storey'
          : `${groundDef.name} is at its maximum height`,
      );
      assertEngine(def.zones.includes(slot.zone), `${def.name} cannot operate in that zone`);
      const cost = buildCost(content, state, player.id, def.id, { zone: slot.zone, index: slot.index });
      assertEngine(player.cash >= cost, `Not enough cash (£${cost} needed)`);
      let next = withPlayerCash(state, player.id, -cost);
      next = {
        ...next,
        slots: next.slots.map((s) =>
          s === slot
            ? { ...s, structure: { ...structure, pieces: [...structure.pieces, def.id], invested: (structure.invested ?? 0) + cost } }
            : s,
        ),
      };
      return log(next, 'build', `${player.name} stacks a ${def.name} — now ${structure.pieces.length + 1} levels tall.`);
    }

    case 'SELL': {
      assertEngine(state.phase === 'action' || state.phase === 'settle-debt', 'Cannot sell right now');
      const slot = findSlot(state, action.zone, action.slotIndex);
      assertEngine(slot?.structure, 'Nothing there to sell');
      const structure = slot.structure;
      assertEngine(structure.ownerId === player.id, 'You can only sell your own structures');
      assertEngine(!structure.mortgaged, 'Lift the mortgage before selling');
      const proceeds = Math.floor(structureBaseValue(content, structure) * sellPctFor(content, player));
      let next = withPlayerCash(state, player.id, proceeds);
      next = { ...next, slots: next.slots.map((s) => (s === slot ? { ...s, structure: null } : s)) };
      next = log(next, 'money', `${player.name} sells ${defById(content, structure.pieces[0]).name} back to the bank for £${proceeds}.`);
      return settleProgress(content, next);
    }

    case 'MORTGAGE': {
      assertEngine(state.phase === 'action' || state.phase === 'settle-debt', 'Cannot mortgage right now');
      const slot = findSlot(state, action.zone, action.slotIndex);
      assertEngine(slot?.structure, 'Nothing there to mortgage');
      const structure = slot.structure;
      assertEngine(structure.ownerId === player.id, 'You can only mortgage your own structures');
      assertEngine(!structure.mortgaged, 'Already mortgaged');
      const value = Math.floor(structureBaseValue(content, structure) * content.rules.mortgagePct);
      let next = withPlayerCash(state, player.id, value);
      next = {
        ...next,
        slots: next.slots.map((s) => (s === slot ? { ...s, structure: { ...structure, mortgaged: true } } : s)),
      };
      next = log(next, 'money', `${player.name} mortgages ${defById(content, structure.pieces[0]).name} for £${value}. Its flag turns grey.`);
      return settleProgress(content, next);
    }

    case 'UNMORTGAGE': {
      assertEngine(state.phase === 'action', 'Mortgages are lifted in the Action Phase');
      const slot = findSlot(state, action.zone, action.slotIndex);
      assertEngine(slot?.structure, 'Nothing there');
      const structure = slot.structure;
      assertEngine(structure.ownerId === player.id, 'Not your structure');
      assertEngine(structure.mortgaged, 'Not mortgaged');
      const cost = Math.ceil(structureBaseValue(content, structure) * content.rules.unmortgagePct);
      assertEngine(player.cash >= cost, `Not enough cash (£${cost} needed)`);
      let next = withPlayerCash(state, player.id, -cost);
      next = {
        ...next,
        slots: next.slots.map((s) => (s === slot ? { ...s, structure: { ...structure, mortgaged: false } } : s)),
      };
      return log(next, 'money', `${player.name} lifts the mortgage on ${defById(content, structure.pieces[0]).name} for £${cost}.`);
    }

    case 'TRADE': {
      assertEngine(state.phase === 'action', 'Trades happen in the Action Phase');
      const other = state.players[action.withPlayer];
      assertEngine(other && !other.eliminated && other.id !== player.id, 'Invalid trade partner');
      validateTradeSide(content, state, player.id, action.give);
      validateTradeSide(content, state, other.id, action.receive);
      assertEngine(player.cash >= action.give.cash, 'You cannot offer cash you do not have');
      assertEngine(other.cash >= action.receive.cash, `${other.name} cannot cover that cash`);
      assertEngine(
        action.give.cash > 0 || action.give.structures.length > 0 || action.receive.cash > 0 || action.receive.structures.length > 0,
        'An empty trade is no trade at all',
      );
      let next = withPlayerCash(state, player.id, -action.give.cash + action.receive.cash);
      next = withPlayerCash(next, other.id, action.give.cash - action.receive.cash);
      const reassign = (keys: string[], newOwner: number, s: GameState): GameState => ({
        ...s,
        slots: s.slots.map((slot) =>
          slot.structure && keys.includes(slotKey(slot.zone, slot.index))
            ? { ...slot, structure: { ...slot.structure, ownerId: newOwner } }
            : slot,
        ),
      });
      next = reassign(action.give.structures, other.id, next);
      next = reassign(action.receive.structures, player.id, next);
      return log(next, 'trade', `🤝 ${player.name} and ${other.name} strike a deal (${describeTrade(action.give)} for ${describeTrade(action.receive)}).`);
    }

    case 'END_ACTIONS': {
      assertEngine(state.phase === 'action', 'Not in the Action Phase');
      return { ...state, phase: 'tourist' };
    }

    case 'ROLL_TOURISTS': {
      assertEngine(state.phase === 'tourist', 'Not the Tourist Phase');
      let rng = state.rng;
      const d1 = nextInt(rng, 1, 6); rng = d1.state;
      const d2 = nextInt(rng, 1, 6); rng = d2.state;
      const dPref = nextInt(rng, 0, content.zones.length); rng = dPref.state;
      const preference: ZoneId | 'spread' =
        dPref.value === content.zones.length ? 'spread' : content.zones[dPref.value].id;

      const surge = d1.value === 6 && d2.value === 6;
      let triggeredDisaster: DisasterId | null = null;
      if (d1.value === 1 && d2.value === 1 && content.disasters.length > 0) {
        const pick = nextInt(rng, 0, content.disasters.length - 1);
        rng = pick.state;
        triggeredDisaster = content.disasters[pick.value].id;
      }

      let next: GameState = { ...state, rng };
      const { touristBase, touristsPerPip, surgeBonus } = content.rules;
      const season = seasonForRound(content, next.round);
      let tourists = touristBase + (d1.value + d2.value) * touristsPerPip;
      if (surge) tourists += surgeBonus;
      // The season wheel scales the natural tide; events then add or remove visitors.
      tourists = Math.round(tourists * season.touristMult);
      for (const eff of next.activeEffects) {
        if (eff.effect.type === 'touristDelta') tourists += eff.effect.amount;
      }
      tourists = Math.max(0, tourists);

      if (triggeredDisaster) {
        next = triggerDisaster(content, next, triggeredDisaster, 'double ones on the tourist dice');
        // If this roll ends the round, expireEffects will tick immediately —
        // compensate so the disaster delivers its full duration of income
        // phases no matter which seat rolled it.
        const endsRound = activePlayerIdsFrom(next, next.currentPlayer)[0] <= next.currentPlayer;
        if (endsRound) {
          next = {
            ...next,
            activeEffects: next.activeEffects.map((e) =>
              e.effect.type === 'disasterActive' && e.effect.disaster === triggeredDisaster
                ? { ...e, remainingRounds: e.remainingRounds + 1 }
                : e,
            ),
          };
        }
      }

      // Distribute after any dice-triggered disaster so the flow reflects it.
      const byZone = distributeTourists(content, next, tourists, preference);

      const dice = {
        volume: [d1.value, d2.value] as [number, number],
        preference,
        tourists,
        seasonId: season.id,
        seasonMult: season.touristMult,
        triggeredDisaster,
        surge,
      };
      next = { ...next, tourists: byZone, totalTourists: tourists, preferredZone: preference, lastDice: dice };
      const prefName = preference === 'spread' ? 'spread evenly' : `drawn to ${content.zones.find((z) => z.id === preference)!.name}`;
      next = log(next, 'dice', `🎲 ${currentName(next)} rolls ${d1.value}+${d2.value}${surge ? ' — a surge!' : ''}: ${tourists} tourists arrive (${season.icon} ${season.name}), ${prefName}.`);
      return advanceToNextPlayer(content, next);
    }

    case 'DECLARE_BANKRUPTCY': {
      assertEngine(state.phase === 'settle-debt', 'You are not in debt');
      const next = eliminate(content, state, player.id, 'They declared bankruptcy.');
      if (next.phase === 'game-over') return next;
      return advanceToNextPlayer(content, next);
    }
  }
}

function validateTradeSide(_content: ContentPack, state: GameState, ownerId: number, side: TradeSide) {
  assertEngine(side.cash >= 0, 'Trade cash must be non-negative');
  for (const key of side.structures) {
    const slot = state.slots.find((s) => slotKey(s.zone, s.index) === key);
    assertEngine(slot?.structure, `No structure at ${key}`);
    assertEngine(slot.structure.ownerId === ownerId, `Structure at ${key} is not theirs to trade`);
    assertEngine(!slot.structure.mortgaged, 'Mortgaged structures cannot change hands');
  }
}

function describeTrade(side: TradeSide): string {
  const parts: string[] = [];
  if (side.cash > 0) parts.push(`£${side.cash}`);
  if (side.structures.length > 0) parts.push(`${side.structures.length} establishment${side.structures.length > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' + ') : 'nothing';
}

/**
 * After a sale/mortgage during settle-debt: if the player is solvent again,
 * return to the Action Phase; if they have nothing left to raise and are still
 * under, they go bankrupt automatically.
 */
function settleProgress(content: ContentPack, state: GameState): GameState {
  if (state.phase !== 'settle-debt') return state;
  const player = state.players[state.currentPlayer];
  if (player.cash >= 0) {
    let next: GameState = { ...state, phase: state.settleReturn, debt: 0, settleReturn: 'action' };
    return log(next, 'money', `${player.name} is solvent again.`);
  }
  if (liquidationValue(content, state, player.id) < 0) {
    const next = eliminate(content, state, player.id, 'Nothing left to sell.');
    if (next.phase === 'game-over') return next;
    return advanceToNextPlayer(content, next);
  }
  return { ...state, debt: -player.cash };
}

/* ------------------------------------------------------------------ */
/* Serialization                                                       */
/* ------------------------------------------------------------------ */

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  if (state.schemaVersion !== 2) throw new EngineError('Unsupported save version');
  return state;
}
