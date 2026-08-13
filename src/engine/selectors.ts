import type {
  ContentPack,
  DisasterDef,
  DisasterId,
  EstablishmentDef,
  GameState,
  IncomeReport,
  PlayerState,
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

/** Total build cost paid for a structure (sum of stacked pieces at list price). */
export function structureBaseValue(content: ContentPack, structure: Structure): number {
  return structure.pieces.reduce((sum, id) => sum + defById(content, id).cost, 0);
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

function structureResists(content: ContentPack, state: GameState, structure: Structure, disaster: DisasterDef): boolean {
  const owner = state.players[structure.ownerId];
  const char = characterOf(content, owner);
  if (char.bonus.type === 'resistDisaster' && char.bonus.disaster === disaster.id) return true;
  return structure.pieces.some((id) => defById(content, id).tags.includes(disaster.resistedBy));
}

interface StructureModifiers {
  attractionMult: number;
  incomeMult: number;
}

function disasterModifiers(content: ContentPack, state: GameState, slot: Slot): StructureModifiers {
  let attractionMult = 1;
  let incomeMult = 1;
  const structure = slot.structure!;
  const topDef = defById(content, structure.pieces[0]);
  for (const disaster of activeDisasters(state, content)) {
    if (!disaster.zones.includes(slot.zone)) continue;
    if (disaster.kindFilter && topDef.kind !== disaster.kindFilter) continue;
    if (structureResists(content, state, structure, disaster)) continue;
    attractionMult *= disaster.attractionMult;
    incomeMult *= disaster.incomeMult;
  }
  return { attractionMult, incomeMult };
}

function zoneBoostMult(state: GameState, zone: ZoneId): number {
  let mult = 1;
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'zoneBoost' && eff.effect.zone === zone) mult *= eff.effect.mult;
  }
  return mult;
}

function kindIncomeMult(state: GameState, kind: EstablishmentDef['kind']): number {
  let mult = 1;
  for (const eff of state.activeEffects) {
    if (eff.effect.type === 'kindBoost' && eff.effect.kind === kind) mult *= eff.effect.incomeMult;
  }
  return mult;
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
 * character bonuses, cluster multiplier and disaster modifiers.
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

  let size = clusters.get(slotKey(slot.zone, slot.index)) ?? 1;
  if (char.bonus.type === 'clusterBonus' && size > 1) size += char.bonus.extraSize;

  const mods = disasterModifiers(content, state, slot);
  return leveled * bonusMult * clusterMult(content, size) * mods.attractionMult;
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
 * minus maintenance.
 */
export function computeIncome(content: ContentPack, state: GameState, playerId: number): IncomeReport {
  const clusters = clusterSizes(state);
  const attractions = zoneAttractions(content, state, state.preferredZone);
  const byZone = new Map(attractions.map((z) => [z.zone, z]));
  const player = state.players[playerId];
  const char = characterOf(content, player);

  const report: IncomeReport = {
    playerId,
    lines: [],
    characterBonus: char.bonus.type === 'incomeFlat' ? char.bonus.amount : 0,
    gross: 0,
    maintenance: 0,
    net: 0,
  };

  for (const slot of state.slots) {
    const structure = slot.structure;
    if (!structure || structure.ownerId !== playerId) continue;
    const def = defById(content, structure.pieces[0]);
    const levels = structure.pieces.length;

    // Maintenance is owed even while mortgaged (reduced) — the bankruptcy pressure.
    let maintenance = structure.pieces.reduce((s, id) => s + defById(content, id).maintenance, 0);
    if (structure.mortgaged) maintenance = Math.ceil(maintenance * content.rules.mortgagedMaintenancePct);
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
        const mods = disasterModifiers(content, state, slot);
        gross = Math.round(tourists * rate * kindIncomeMult(state, def.kind) * mods.incomeMult);
      }
    }

    report.lines.push({
      slotKey: slotKey(slot.zone, slot.index),
      name: def.name + (levels > 1 ? ` ×${levels}` : ''),
      zone: slot.zone,
      levels,
      tourists,
      gross,
      maintenance,
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

/** Cash the player could raise right now: cash + sale value + mortgage headroom. */
export function liquidationValue(content: ContentPack, state: GameState, playerId: number): number {
  let total = state.players[playerId].cash;
  for (const slot of state.slots) {
    const s = slot.structure;
    if (!s || s.ownerId !== playerId) continue;
    if (!s.mortgaged) total += Math.floor(structureBaseValue(content, s) * content.rules.sellPct);
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

export function buildCost(content: ContentPack, state: GameState, playerId: number, defId: string): number {
  const def = defById(content, defId);
  const char = characterOf(content, state.players[playerId]);
  let cost = def.cost;
  if (char.bonus.type === 'buildDiscount' && char.bonus.kind === def.kind) {
    cost = Math.round(cost * (1 - char.bonus.pct));
  }
  return cost;
}

export function playersRemaining(state: GameState): PlayerState[] {
  return state.players.filter((p) => !p.eliminated);
}
