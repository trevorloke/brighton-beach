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
export type EstablishmentTag = 'sturdy' | 'clean' | 'netted' | 'food' | 'lodging' | 'amusement';

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

export type DisasterId = 'storm' | 'pollution' | 'seagulls';

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
  | { type: 'disaster'; disaster: DisasterId };

export interface EventCardDef {
  id: string;
  name: string;
  category: 'boom' | 'shift' | 'windfall' | 'levy' | 'disaster';
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
    | { type: 'noMaintenance'; kind: EstablishmentKind }
    | { type: 'incomeFlat'; amount: number }
    | { type: 'resistDisaster'; disaster: DisasterId }
    | { type: 'clusterBonus'; extraSize: number };
}

/** Everything data-driven, injected into the engine at game creation. */
export interface ContentPack {
  zones: ZoneDef[];
  establishments: EstablishmentDef[];
  events: EventCardDef[];
  disasters: DisasterDef[];
  characters: CharacterDef[];
  rules: RuleNumbers;
}

/** The balancing worksheet — every tunable number in one place. */
export interface RuleNumbers {
  startingCapital: Record<number, number>; // by player count
  /** tourists = (2d6 sum) * touristsPerPip */
  touristsPerPip: number;
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
}

/* ------------------------------------------------------------------ */
/* Live game state (fully serializable)                                */
/* ------------------------------------------------------------------ */

export interface Structure {
  /** Stack of establishment def ids; index 0 is ground level. */
  pieces: string[];
  ownerId: number;
  mortgaged: boolean;
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
}

export interface IncomeReport {
  playerId: number;
  lines: IncomeLine[];
  characterBonus: number;
  gross: number;
  maintenance: number;
  net: number;
}

export interface DiceResult {
  volume: [number, number];
  /** Index into zones, or 'spread' for an even day. */
  preference: ZoneId | 'spread';
  tourists: number;
  triggeredDisaster: DisasterId | null;
  surge: boolean;
}

export interface LogEntry {
  round: number;
  text: string;
  kind: 'phase' | 'build' | 'money' | 'event' | 'disaster' | 'trade' | 'elimination' | 'dice' | 'info';
}

export interface GameState {
  schemaVersion: 1;
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
