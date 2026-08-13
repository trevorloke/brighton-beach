import type { RngState } from './rng';

/* ------------------------------------------------------------------ */
/* Content definitions (data, not logic — expansions add entries here) */
/* ------------------------------------------------------------------ */

export type ZoneId = string; // 'north-prom' | 'south-prom' | 'pier' | 'beach' | 'water' in the base game

export interface ZoneDef {
  id: ZoneId;
  name: string;
  shortName: string;
  /** Number of placement slots in this zone. */
  slots: number;
  /** Which establishment kinds may be placed here. */
  allows: EstablishmentKind[];
  /** Base pull so an empty-ish zone still sees some footfall. */
  baseAttraction: number;
}

export type EstablishmentKind = 'kiosk' | 'building' | 'monument';

/** Tags used by disasters/events for resistance and targeting. */
export type EstablishmentTag =
  | 'sturdy' // stands through storms
  | 'clean' // shrugs off pollution
  | 'netted' // ignores seagulls
  | 'lit' // glows through sea fog
  | 'food' // thrives in a scorcher
  | 'lodging'
  | 'amusement';

export interface EstablishmentDef {
  id: string;
  name: string;
  kind: EstablishmentKind;
  cost: number;
  /** Base attraction points contributed to the zone. */
  attraction: number;
  /** Income per tourist routed to this establishment. */
  incomePerTourist: number;
  /** Flat upkeep charged each of the owner's Income Phases (per level). */
  maintenance: number;
  /** Max stack height. 1 for kiosks and monuments. */
  maxLevels: number;
  /** Zones this may be built in. */
  zones: ZoneId[];
  tags: EstablishmentTag[];
  flavor: string;
}

/**
 * A named quality of one specific berth — the board is a designed artifact
 * and every square can carry advantages and disadvantages. All multipliers
 * default to 1 (absent = no effect).
 */
export interface BerthTraitDef {
  id: string;
  name: string;
  /** One-glyph badge drawn on the board berth. */
  icon: string;
  /** Short explanation shown in placement and inspection UI. */
  blurb: string;
  /** Whether the trait reads as an advantage (UI colouring only). */
  good: boolean;
  attractionMult?: number;
  incomeMult?: number;
  upkeepMult?: number;
  costMult?: number;
  /** The structure here counts as having these tags (e.g. sheltered = sturdy). */
  grantsTags?: EstablishmentTag[];
  /** Hard cap on stack height at this berth (subsiding ground, etc.). */
  maxLevelsCap?: number;
}

export type DisasterId = 'storm' | 'pollution' | 'seagulls' | 'fog' | 'heatwave';

export interface DisasterDef {
  id: DisasterId;
  name: string;
  /** Zones affected. */
  zones: ZoneId[];
  /** Attraction multiplier applied to non-resistant structures in affected zones. */
  attractionMult: number;
  /** Income multiplier applied to non-resistant structures in affected zones. */
  incomeMult: number;
  /** Rounds the disaster persists. */
  duration: number;
  /** Structures with this tag are unaffected. */
  resistedBy: EstablishmentTag;
  /** Restrict effect to a kind (seagulls hit kiosks hardest); undefined = all kinds. */
  kindFilter?: EstablishmentKind;
  description: string;
  icon: string;
}

export type EventEffect =
  | { type: 'touristDelta'; amount: number; duration: number } // extra/fewer tourists per round
  | { type: 'zoneBoost'; zone: ZoneId; mult: number; duration: number }
  | { type: 'kindBoost'; kind: EstablishmentKind; incomeMult: number; duration: number }
  | { type: 'cashAll'; amount: number } // negative = tax on everyone (bankruptcy pressure)
  | { type: 'cashCurrent'; amount: number }
  | { type: 'perStructureCash'; amount: number; kind?: EstablishmentKind } // levy/grant scaled to holdings
  | { type: 'transferRichPoor'; amount: number } // richest player pays the poorest
  | { type: 'globalMult'; costMult?: number; upkeepMult?: number; duration: number } // economy swings
  | { type: 'disaster'; disaster: DisasterId };

export interface EventCardDef {
  id: string;
  name: string;
  category: 'boom' | 'shift' | 'windfall' | 'levy' | 'economy' | 'disaster';
  description: string;
  effects: EventEffect[];
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  emoji: string;
  bonusText: string;
  bonus:
    | { type: 'buildDiscount'; kind: EstablishmentKind; pct: number }
    | { type: 'attractionBonus'; kind: EstablishmentKind; pct: number }
    | { type: 'incomeBonus'; kind: EstablishmentKind; pct: number }
    | { type: 'noMaintenance'; kind: EstablishmentKind }
    | { type: 'maintenanceDiscount'; kind: EstablishmentKind; pct: number }
    | { type: 'incomeFlat'; amount: number }
    | { type: 'resistDisaster'; disaster: DisasterId }
    | { type: 'resistAllDisasters' }
    | { type: 'clusterBonus'; extraSize: number }
    | { type: 'sellBonus'; pct: number }; // extra fraction on bank sales
}

/** One step of the rotating season wheel (round-driven, fully data). */
export interface SeasonDef {
  id: string;
  name: string;
  icon: string;
  /** Multiplier on the natural tourist tide. */
  touristMult: number;
  blurb: string;
}

/** Everything data-driven, injected into the engine at game creation. */
export interface ContentPack {
  zones: ZoneDef[];
  establishments: EstablishmentDef[];
  events: EventCardDef[];
  disasters: DisasterDef[];
  characters: CharacterDef[];
  /** Trait vocabulary for berths. */
  traits: BerthTraitDef[];
  /** Fixed board map: slot key ("zone:index") -> trait ids on that berth. */
  berthTraits: Record<string, string[]>;
  rules: RuleNumbers;
}

/** The balancing worksheet — every tunable number in one place. */
export interface RuleNumbers {
  startingCapital: Record<number, number>; // by player count
  /** tourists = (touristBase + 2d6 sum × touristsPerPip) × season multiplier */
  touristBase: number;
  touristsPerPip: number;
  /** Extra tourists on double sixes. */
  surgeBonus: number;
  /** Cluster attraction multiplier = clusterBase ^ (clusterSize - 1), capped. */
  clusterBase: number;
  clusterCap: number;
  /** Attraction multiplier per stack level (index = level - 1). */
  levelMult: number[];
  /** Preferred zone (from the preference die) attraction multiplier. */
  preferenceMult: number;
  sellPct: number; // sale to bank, fraction of cost
  mortgagePct: number; // cash received when mortgaging
  unmortgagePct: number; // cost to lift a mortgage
  mortgagedMaintenancePct: number; // upkeep fraction while mortgaged
  /** The season wheel, cycled by round number. */
  seasons: SeasonDef[];
  /** Rising rents: upkeep × rentEscalationMult^floor((round-1)/rentEscalationEvery). */
  rentEscalationEvery: number;
  rentEscalationMult: number;
}

/* ------------------------------------------------------------------ */
/* Live game state (fully serializable)                                */
/* ------------------------------------------------------------------ */

export interface Structure {
  /** Stack of establishment def ids; index 0 is ground level. */
  pieces: string[];
  ownerId: number;
  mortgaged: boolean;
  /**
   * Cash actually paid to build this structure (after berth traits, character
   * discounts and economy cards). Sales and mortgages pay out fractions of
   * THIS, so no combination of discounts can mint money through resale.
   */
  invested: number;
}

export interface Slot {
  zone: ZoneId;
  index: number;
  structure: Structure | null;
}

export interface PlayerState {
  id: number;
  name: string;
  color: string; // token from the design palette
  flagShape: 'triangle' | 'swallowtail' | 'square' | 'circle';
  characterId: string;
  cash: number;
  eliminated: boolean;
  eliminatedRound: number | null;
  /** Asset value snapshot taken before the obligations that eliminated them (tie-break rule 8.4). */
  assetValueAtElimination: number | null;
}

export interface ActiveEffect {
  sourceName: string;
  effect: EventEffect | { type: 'disasterActive'; disaster: DisasterId };
  remainingRounds: number;
  icon: string;
}

export type Phase =
  | 'income'
  | 'action'
  | 'tourist'
  | 'settle-debt' // current player must sell/mortgage until solvent
  | 'game-over';

export interface IncomeLine {
  slotKey: string;
  name: string;
  zone: ZoneId;
  levels: number;
  tourists: number;
  gross: number;
  maintenance: number;
  /** Human-readable multiplier chips: cluster, stack, traits, events, disasters. */
  factors: string[];
}

export interface IncomeReport {
  playerId: number;
  lines: IncomeLine[];
  characterBonus: number;
  gross: number;
  maintenance: number;
  net: number;
  /** Rising-rents multiplier in force this round (1 = base rents). */
  rentMult: number;
}

export interface DiceResult {
  volume: [number, number];
  /** Index into zones, or 'spread' for an even day. */
  preference: ZoneId | 'spread';
  tourists: number;
  /** Season in force when the dice were thrown (the round may advance after). */
  seasonId: string;
  seasonMult: number;
  triggeredDisaster: DisasterId | null;
  surge: boolean;
}

export interface LogEntry {
  round: number;
  text: string;
  kind: 'phase' | 'build' | 'money' | 'event' | 'disaster' | 'trade' | 'elimination' | 'dice' | 'season' | 'info';
}

export interface GameState {
  schemaVersion: 2;
  seed: number;
  rng: RngState;
  players: PlayerState[];
  slots: Slot[];
  round: number;
  currentPlayer: number; // player id
  phase: Phase;
  /** Tourist count per zone, set by the last Tourist Phase. */
  tourists: Record<ZoneId, number>;
  totalTourists: number;
  preferredZone: ZoneId | 'spread';
  eventDeck: string[];
  eventDiscard: string[];
  activeEffects: ActiveEffect[];
  /** Latest drawn event, for the reveal UI. */
  lastEvent: string | null;
  lastDice: DiceResult | null;
  lastIncome: IncomeReport | null;
  /** Outstanding amount the current player must raise during settle-debt. */
  debt: number;
  /**
   * Phase to resume once the debt is settled: 'income' when a round-start levy
   * struck before the player could open their tills (so they still collect),
   * 'action' otherwise.
   */
  settleReturn: 'income' | 'action';
  winnerId: number | null;
  log: LogEntry[];
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export interface TradeSide {
  cash: number;
  /** Slot keys ("zone:index") of structures handed over. */
  structures: string[];
}

export type GameAction =
  | { type: 'COLLECT_INCOME' } // income phase -> action phase
  | { type: 'BUILD'; defId: string; zone: ZoneId; slotIndex: number }
  | { type: 'STACK'; defId: string; zone: ZoneId; slotIndex: number }
  | { type: 'SELL'; zone: ZoneId; slotIndex: number }
  | { type: 'MORTGAGE'; zone: ZoneId; slotIndex: number }
  | { type: 'UNMORTGAGE'; zone: ZoneId; slotIndex: number }
  | { type: 'TRADE'; withPlayer: number; give: TradeSide; receive: TradeSide }
  | { type: 'END_ACTIONS' } // action phase -> tourist phase
  | { type: 'ROLL_TOURISTS' } // tourist phase -> next player's income phase
  | { type: 'DECLARE_BANKRUPTCY' };

export interface SetupPlayer {
  name: string;
  color: string;
  flagShape: PlayerState['flagShape'];
  characterId: string;
}

export interface GameConfig {
  seed: number;
  players: SetupPlayer[];
}
