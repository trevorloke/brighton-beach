import type {
  BerthTraitDef,
  ContentPack,
  DisasterDef,
  DisasterId,
  EstablishmentDef,
  EstablishmentTag,
  GameState,
  IncomeReport,
  PlayerState,
  SeasonDef,
  Slot,
  Structure,
  ZoneId,
} from './types';

export function slotKey(zone: ZoneId, index: number): string {
  return `${zone}:${index}`;
}

export function findSlot(state: GameState, zone: ZoneId, index: number): Slot | undefined {
  return state.slots.find((s) => s.zone === zone && s.index === index);
}

export function defById(content: ContentPack, id: string): EstablishmentDef {
  const def = content.establishments.find((e) => e.id === id);
  if (!def) throw new Error(`Unknown establishment: ${id}`);
  return def;
}

export function characterOf(content: ContentPack, player: PlayerState) {
  const c = content.characters.find((c) => c.id === player.characterId);
  if (!c) throw new Error(`Unknown character: ${player.characterId}`);
  return c;
}

/**
 * What was actually paid for a structure. Sales, mortgages and asset values
 * are all fractions of this, so discounted builds can never be resold at a
 * profit. (Falls back to list price for structures created before invested
 * cost was tracked.)
 */
export function structureBaseValue(content: ContentPack, structure: Structure): number {
  return structure.invested ?? structure.pieces.reduce((sum, id) => sum + defById(content, id).cost, 0);
}

/* ------------------------------------------------------------------ */
/* Berth traits                                                        */
/* ------------------------------------------------------------------ */

/** The traits printed on one berth of the board (empty for plain ground). */
export function traitsAt(content: ContentPack, zone: ZoneId, index: number): BerthTraitDef[] {
  const ids = content.berthTraits[slotKey(zone, index)] ?? [];
  return ids
    .map((id) => content.traits.find((t) => t.id === id))
    .filter((t): t is BerthTraitDef => !!t);
}

function traitProduct(traits: BerthTraitDef[], pick: (t: BerthTraitDef) => number | undefined): number {
  return traits.reduce((m, t) => m * (pick(t) ?? 1), 1);
}

/** Stack ceiling at a berth: the establishment's own cap, minus any ground limits. */
export function maxLevelsAt(content: ContentPack, zone: ZoneId, index: number, def: EstablishmentDef): number {
  const caps = traitsAt(content, zone, index)
    .map((t) => t.maxLevelsCap)
    .filter((c): c is number => c !== undefined);
  return Math.min(def.maxLevels, ...caps);
}

/** Tags a structure counts as having: its pieces' tags plus berth-granted ones. */
function effectiveTags(content: ContentPack, slot: Slot): Set<EstablishmentTag> {
  const tags = new Set<EstablishmentTag>();
  for (const id of slot.structure?.pieces ?? []) {
    for (const tag of defById(content, id).tags) tags.add(tag);
  }
  for (const trait of traitsAt(content, slot.zone, slot.index)) {
    for (const tag of trait.grantsTags ?? []) tags.add(tag);
  }
  return tags;
}

/* ------------------------------------------------------------------ */
/* Seasons and rising rents                                            */
/* ------------------------------------------------------------------ */

/** The season wheel turns once per round. */
export function seasonForRound(content: ContentPack, round: number): SeasonDef {
  const seasons = content.rules.seasons;
  return seasons[(round - 1) % seasons.length];
}

/** Rising rents: upkeep multiplier for a round (compounds as the resort grows, to a ceiling). */
export function rentMultiplier(content: ContentPack, round: number): number {
  const { rentEscalationEvery, rentEscalationMult, rentEscalationCap } = content.rules;
  return Math.min(
    rentEscalationCap,
    Math.pow(rentEscalationMult, Math.floor((round - 1) / rentEscalationEvery)),
  );
}

/** Economy-card build cost multiplier currently in force. */
export function globalCostMult(state: GameState): number {
  let mult = 1;
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'globalMult' && eff.effect.costMult !== undefined) mult *= eff.effect.costMult;
  }
  return mult;
}

/** Economy-card upkeep multiplier currently in force (0 during a maintenance holiday). */
export function globalUpkeepMult(state: GameState): number {
  let mult = 1;
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'globalMult' && eff.effect.upkeepMult !== undefined) mult *= eff.effect.upkeepMult;
  }
  return mult;
}

/* ------------------------------------------------------------------ */
/* Clusters                                                            */
/* ------------------------------------------------------------------ */

/**
 * A cluster is a maximal run of adjacent occupied slots within one zone
 * (slots are arranged in a line per zone; adjacency = consecutive indices).
 * Returns cluster size for each occupied slot, keyed by slot key.
 */
export function clusterSizes(state: GameState): Map<string, number> {
  const sizes = new Map<string, number>();
  const byZone = new Map<ZoneId, Slot[]>();
  for (const slot of state.slots) {
    if (!byZone.has(slot.zone)) byZone.set(slot.zone, []);
    byZone.get(slot.zone)!.push(slot);
  }
  for (const slots of byZone.values()) {
    slots.sort((a, b) => a.index - b.index);
    let run: Slot[] = [];
    const flush = () => {
      for (const s of run) sizes.set(slotKey(s.zone, s.index), run.length);
      run = [];
    };
    for (const slot of slots) {
      if (slot.structure && !slot.structure.mortgaged) run.push(slot);
      else flush();
    }
    flush();
  }
  return sizes;
}

function clusterMult(content: ContentPack, size: number): number {
  const { clusterBase, clusterCap } = content.rules;
  return Math.min(clusterCap, Math.pow(clusterBase, Math.max(0, size - 1)));
}

/* ------------------------------------------------------------------ */
/* Disasters and effects                                               */
/* ------------------------------------------------------------------ */

export function activeDisasters(state: GameState, content: ContentPack): DisasterDef[] {
  const out: DisasterDef[] = [];
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'disasterActive') {
      const def = content.disasters.find((d) => d.id === (eff.effect as { disaster: DisasterId }).disaster);
      if (def) out.push(def);
    }
  }
  return out;
}

function structureResists(content: ContentPack, state: GameState, slot: Slot, disaster: DisasterDef): boolean {
  const structure = slot.structure!;
  const owner = state.players[structure.ownerId];
  const char = characterOf(content, owner);
  if (char.bonus.type === 'resistAllDisasters') return true;
  if (char.bonus.type === 'resistDisaster' && char.bonus.disaster === disaster.id) return true;
  return effectiveTags(content, slot).has(disaster.resistedBy);
}

interface StructureModifiers {
  attractionMult: number;
  incomeMult: number;
  /** Names of disasters actually biting this structure (for income factor chips). */
  applied: string[];
}

function disasterModifiers(content: ContentPack, state: GameState, slot: Slot): StructureModifiers {
  let attractionMult = 1;
  let incomeMult = 1;
  const applied: string[] = [];
  const structure = slot.structure!;
  const topDef = defById(content, structure.pieces[0]);
  for (const disaster of activeDisasters(state, content)) {
    if (!disaster.zones.includes(slot.zone)) continue;
    if (disaster.kindFilter && topDef.kind !== disaster.kindFilter) continue;
    if (structureResists(content, state, slot, disaster)) continue;
    attractionMult *= disaster.attractionMult;
    incomeMult *= disaster.incomeMult;
    applied.push(`${disaster.icon} ${disaster.name}`);
  }
  return { attractionMult, incomeMult, applied };
}

function zoneBoostMult(state: GameState, zone: ZoneId): number {
  let mult = 1;
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'zoneBoost' && eff.effect.zone === zone) mult *= eff.effect.mult;
  }
  return mult;
}

function kindIncomeMult(state: GameState, kind: EstablishmentDef['kind']): { mult: number; names: string[] } {
  let mult = 1;
  const names: string[] = [];
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'kindBoost' && eff.effect.kind === kind) {
      mult *= eff.effect.incomeMult;
      names.push(eff.sourceName);
    }
  }
  return { mult, names };
}

export function touristDelta(state: GameState): number {
  let delta = 0;
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'touristDelta') delta += eff.effect.amount;
  }
  return delta;
}

/* ------------------------------------------------------------------ */
/* Attraction                                                          */
/* ------------------------------------------------------------------ */

/**
 * Attraction points of one structure, including stack level multiplier,
 * berth traits, character bonuses, cluster multiplier and disaster modifiers.
 * Mortgaged structures attract nothing (flag lowered).
 */
export function structureAttraction(
  content: ContentPack,
  state: GameState,
  slot: Slot,
  clusters: Map<string, number>,
): number {
  const structure = slot.structure;
  if (!structure || structure.mortgaged) return 0;
  const { rules } = content;
  const levels = structure.pieces.length;
  const base = structure.pieces.reduce((sum, id) => sum + defById(content, id).attraction, 0) / levels;
  const leveled = base * (rules.levelMult[levels - 1] ?? rules.levelMult[rules.levelMult.length - 1]);

  const owner = state.players[structure.ownerId];
  const char = characterOf(content, owner);
  const topDef = defById(content, structure.pieces[0]);
  let bonusMult = 1;
  if (char.bonus.type === 'attractionBonus' && char.bonus.kind === topDef.kind) bonusMult += char.bonus.pct;

  const traitMult = traitProduct(traitsAt(content, slot.zone, slot.index), (t) => t.attractionMult);

  let size = clusters.get(slotKey(slot.zone, slot.index)) ?? 1;
  if (char.bonus.type === 'clusterBonus' && size > 1) size += char.bonus.extraSize;

  const mods = disasterModifiers(content, state, slot);
  return leveled * bonusMult * traitMult * clusterMult(content, size) * mods.attractionMult;
}

export interface ZoneAttraction {
  zone: ZoneId;
  total: number;
  preferred: boolean;
  structures: Map<string, number>; // slot key -> attraction
}

/** Attraction per zone given current effects and a preference. */
export function zoneAttractions(
  content: ContentPack,
  state: GameState,
  preference: ZoneId | 'spread',
): ZoneAttraction[] {
  const clusters = clusterSizes(state);
  return content.zones.map((zone) => {
    const structures = new Map<string, number>();
    // Zone-wide disasters also suppress the zone's base pull (an empty stormy
    // pier attracts nobody). Structure attractions are modified individually
    // in structureAttraction so resistant buildings keep their draw.
    let base = zone.baseAttraction;
    for (const disaster of activeDisasters(state, content)) {
      if (disaster.zones.includes(zone.id) && !disaster.kindFilter) base *= disaster.attractionMult;
    }
    let total = base;
    for (const slot of state.slots) {
      if (slot.zone !== zone.id || !slot.structure) continue;
      const a = structureAttraction(content, state, slot, clusters);
      structures.set(slotKey(slot.zone, slot.index), a);
      total += a;
    }
    total *= zoneBoostMult(state, zone.id);
    const preferred = preference === zone.id;
    if (preferred) total *= content.rules.preferenceMult;
    return { zone: zone.id, total: Math.max(0, total), preferred, structures };
  });
}

function sumMap(m: Map<string, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

/** Distribute a tourist count across zones proportionally to attraction. */
export function distributeTourists(
  content: ContentPack,
  state: GameState,
  totalTourists: number,
  preference: ZoneId | 'spread',
): Record<ZoneId, number> {
  const attractions = zoneAttractions(content, state, preference);
  const totalAttraction = attractions.reduce((s, z) => s + z.total, 0);
  const out: Record<ZoneId, number> = {};
  if (totalAttraction <= 0) {
    for (const z of attractions) out[z.zone] = 0;
    return out;
  }
  let assigned = 0;
  for (const z of attractions) {
    const n = Math.floor((totalTourists * z.total) / totalAttraction);
    out[z.zone] = n;
    assigned += n;
  }
  // Remainder goes to the most attractive zone so totals reconcile.
  let best = attractions[0];
  for (const z of attractions) if (z.total > best.total) best = z;
  out[best.zone] += totalTourists - assigned;
  return out;
}

/* ------------------------------------------------------------------ */
/* Income                                                              */
/* ------------------------------------------------------------------ */

/**
 * Income report for one player given the current tourist distribution.
 * Tourists inside a zone split across structures proportional to attraction;
 * each structure earns tourists × incomePerTourist (weighted across its stack),
 * times berth traits and event modifiers, minus maintenance (which rises with
 * the rent escalator and the berth's own upkeep traits).
 */
export function computeIncome(content: ContentPack, state: GameState, playerId: number): IncomeReport {
  const clusters = clusterSizes(state);
  const attractions = zoneAttractions(content, state, state.preferredZone);
  const byZone = new Map(attractions.map((z) => [z.zone, z]));
  const player = state.players[playerId];
  const char = characterOf(content, player);
  const rentMult = rentMultiplier(content, state.round);
  const upkeepHoliday = globalUpkeepMult(state);

  const report: IncomeReport = {
    playerId,
    lines: [],
    characterBonus: char.bonus.type === 'incomeFlat' ? char.bonus.amount : 0,
    gross: 0,
    maintenance: 0,
    net: 0,
    rentMult,
  };

  for (const slot of state.slots) {
    const structure = slot.structure;
    if (!structure || structure.ownerId !== playerId) continue;
    const def = defById(content, structure.pieces[0]);
    const levels = structure.pieces.length;
    const traits = traitsAt(content, slot.zone, slot.index);
    const factors: string[] = [];

    // Maintenance is owed even while mortgaged (reduced) — the bankruptcy pressure.
    let maintenance = structure.pieces.reduce((s, id) => s + defById(content, id).maintenance, 0);
    maintenance *= traitProduct(traits, (t) => t.upkeepMult);
    maintenance *= rentMult * upkeepHoliday;
    if (structure.mortgaged) maintenance *= content.rules.mortgagedMaintenancePct;
    if (char.bonus.type === 'maintenanceDiscount' && char.bonus.kind === def.kind) {
      maintenance *= 1 - char.bonus.pct;
    }
    maintenance = Math.ceil(maintenance);
    if (char.bonus.type === 'noMaintenance' && char.bonus.kind === def.kind) maintenance = 0;

    let tourists = 0;
    let gross = 0;
    if (!structure.mortgaged) {
      const zoneInfo = byZone.get(slot.zone)!;
      const myAttraction = structureAttraction(content, state, slot, clusters);
      const zoneTourists = state.tourists[slot.zone] ?? 0;
      const structTotal = sumMap(zoneInfo.structures);
      if (structTotal > 0 && myAttraction > 0) {
        tourists = Math.round((zoneTourists * myAttraction) / structTotal);
        const rate =
          structure.pieces.reduce((s, id) => s + defById(content, id).incomePerTourist, 0) / levels;
        const kindMult = kindIncomeMult(state, def.kind);
        const traitIncome = traitProduct(traits, (t) => t.incomeMult);
        let charIncome = 1;
        if (char.bonus.type === 'incomeBonus' && char.bonus.kind === def.kind) charIncome += char.bonus.pct;
        const mods = disasterModifiers(content, state, slot);
        gross = Math.round(tourists * rate * kindMult.mult * traitIncome * charIncome * mods.incomeMult);

        // Human-readable factor chips for the income review.
        const clusterSize = clusters.get(slotKey(slot.zone, slot.index)) ?? 1;
        if (clusterSize > 1) factors.push(`🎪 cluster of ${clusterSize} ×${clusterMult(content, clusterSize).toFixed(2)}`);
        if (levels > 1) factors.push(`🏗️ ${levels} storeys ×${content.rules.levelMult[levels - 1]}`);
        for (const t of traits) factors.push(`${t.icon} ${t.name}`);
        for (const name of kindMult.names) factors.push(`🎠 ${name} ×${kindMult.mult}`);
        for (const name of mods.applied) factors.push(name);
      }
    } else {
      factors.push('🔒 mortgaged');
    }

    report.lines.push({
      slotKey: slotKey(slot.zone, slot.index),
      name: def.name + (levels > 1 ? ` ×${levels}` : ''),
      zone: slot.zone,
      levels,
      tourists,
      gross,
      maintenance,
      factors,
    });
    report.gross += gross;
    report.maintenance += maintenance;
  }

  report.net = report.gross + report.characterBonus - report.maintenance;
  return report;
}

/* ------------------------------------------------------------------ */
/* Valuation                                                           */
/* ------------------------------------------------------------------ */

/** Sale fraction for a player (the Dealmaker gets a better rate). */
export function sellPctFor(content: ContentPack, player: PlayerState): number {
  const char = characterOf(content, player);
  const bonus = char.bonus.type === 'sellBonus' ? char.bonus.pct : 0;
  return content.rules.sellPct + bonus;
}

/** Cash the player could raise right now: cash + sale value + mortgage headroom. */
export function liquidationValue(content: ContentPack, state: GameState, playerId: number): number {
  const player = state.players[playerId];
  const pct = sellPctFor(content, player);
  let total = player.cash;
  for (const slot of state.slots) {
    const s = slot.structure;
    if (!s || s.ownerId !== playerId) continue;
    if (!s.mortgaged) total += Math.floor(structureBaseValue(content, s) * pct);
  }
  return total;
}

/** Asset value for the tie-break rule: cash plus full base value of unmortgaged holdings. */
export function assetValue(content: ContentPack, state: GameState, playerId: number): number {
  let total = state.players[playerId].cash;
  for (const slot of state.slots) {
    const s = slot.structure;
    if (!s || s.ownerId !== playerId) continue;
    total += s.mortgaged ? 0 : structureBaseValue(content, s);
  }
  return total;
}

/**
 * Cost to build (or stack) a piece. Includes the character discount, the
 * economy cards in force, and — when a berth is specified — its cost traits.
 */
export function buildCost(
  content: ContentPack,
  state: GameState,
  playerId: number,
  defId: string,
  at?: { zone: ZoneId; index: number },
): number {
  const def = defById(content, defId);
  const char = characterOf(content, state.players[playerId]);
  let cost = def.cost;
  if (char.bonus.type === 'buildDiscount' && char.bonus.kind === def.kind) {
    cost *= 1 - char.bonus.pct;
  }
  cost *= globalCostMult(state);
  if (at) cost *= traitProduct(traitsAt(content, at.zone, at.index), (t) => t.costMult);
  return Math.round(cost);
}

export function playersRemaining(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}
