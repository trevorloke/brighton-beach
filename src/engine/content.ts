import type {
  ContentPack,
  ZoneDef,
  EstablishmentDef,
  DisasterDef,
  EventCardDef,
  CharacterDef,
  RuleNumbers,
} from './types';

/**
 * The base-game content pack. Everything here is data — expansions (High Tide
 * terrain, Festive's Party Island, …) add entries to these tables without
 * touching the engine. All tunable numbers live in RULES (see BALANCING.md
 * for the worksheet awaiting sign-off).
 */

export const ZONES: ZoneDef[] = [
  { id: 'north-prom', name: 'North Promenade', shortName: 'North Prom', slots: 6, allows: ['kiosk', 'building', 'monument'], baseAttraction: 2 },
  { id: 'south-prom', name: 'South Promenade', shortName: 'South Prom', slots: 6, allows: ['kiosk', 'building', 'monument'], baseAttraction: 2 },
  { id: 'pier', name: 'The Pier', shortName: 'Pier', slots: 5, allows: ['kiosk', 'building', 'monument'], baseAttraction: 3 },
  { id: 'beach', name: 'Main Beach', shortName: 'Beach', slots: 6, allows: ['kiosk', 'monument'], baseAttraction: 3 },
  { id: 'water', name: 'The Water', shortName: 'Water', slots: 4, allows: ['kiosk', 'monument'], baseAttraction: 1 },
];

const PROMS = ['north-prom', 'south-prom'];
const LAND = ['north-prom', 'south-prom', 'pier'];
const SHORE = ['north-prom', 'south-prom', 'pier', 'beach'];

export const ESTABLISHMENTS: EstablishmentDef[] = [
  // ---- Kiosks: cheap, low income, pull tourists toward a zone ----
  { id: 'ice-cream', name: 'Ice Cream Kiosk', kind: 'kiosk', cost: 100, attraction: 3, incomePerTourist: 1, maintenance: 10, maxLevels: 1, zones: SHORE, tags: ['food'], flavor: '99 with a flake, mind the gulls.' },
  { id: 'chippy', name: 'Fish & Chips Stand', kind: 'kiosk', cost: 120, attraction: 3, incomePerTourist: 1.2, maintenance: 12, maxLevels: 1, zones: SHORE, tags: ['food'], flavor: 'Salt, vinegar, sea air.' },
  { id: 'deckchairs', name: 'Deckchair Hire', kind: 'kiosk', cost: 80, attraction: 2, incomePerTourist: 0.8, maintenance: 8, maxLevels: 1, zones: ['beach'], tags: [], flavor: 'Stripes for hire by the hour.' },
  { id: 'souvenirs', name: 'Souvenir Stall', kind: 'kiosk', cost: 90, attraction: 2, incomePerTourist: 1, maintenance: 9, maxLevels: 1, zones: LAND, tags: ['netted'], flavor: 'Rock candy and postcards under netting.' },
  { id: 'pedalos', name: 'Pedalo Hire', kind: 'kiosk', cost: 110, attraction: 3, incomePerTourist: 1, maintenance: 11, maxLevels: 1, zones: ['water'], tags: ['clean'], flavor: 'Swan-shaped, seaworthy-ish.' },
  { id: 'donuts', name: 'Donut Fryer', kind: 'kiosk', cost: 100, attraction: 3, incomePerTourist: 1.1, maintenance: 10, maxLevels: 1, zones: ['pier', 'north-prom', 'south-prom'], tags: ['food'], flavor: 'Hot sugar in a paper bag.' },

  // ---- Buildings: primary income, stack up to 3 levels ----
  { id: 'cafe', name: 'Seafront Café', kind: 'building', cost: 250, attraction: 5, incomePerTourist: 1.8, maintenance: 25, maxLevels: 3, zones: PROMS, tags: ['food'], flavor: 'Tea served with a sea view.' },
  { id: 'arcade', name: 'Amusement Arcade', kind: 'building', cost: 320, attraction: 7, incomePerTourist: 2, maintenance: 32, maxLevels: 3, zones: LAND, tags: ['amusement', 'netted'], flavor: 'Tuppence cascades and neon.' },
  { id: 'restaurant', name: 'Fish Restaurant', kind: 'building', cost: 350, attraction: 6, incomePerTourist: 2.4, maintenance: 35, maxLevels: 3, zones: LAND, tags: ['food'], flavor: 'The catch of the day, plated.' },
  { id: 'hotel', name: 'Seaside Hotel', kind: 'building', cost: 450, attraction: 8, incomePerTourist: 2.8, maintenance: 45, maxLevels: 3, zones: PROMS, tags: ['lodging', 'sturdy'], flavor: 'Regency stucco, sea-facing rooms.' },
  { id: 'aquarium', name: 'Aquarium', kind: 'building', cost: 400, attraction: 8, incomePerTourist: 2.2, maintenance: 40, maxLevels: 2, zones: ['pier', 'north-prom', 'south-prom'], tags: ['clean', 'sturdy'], flavor: 'Rays glide under Victorian arches.' },
  { id: 'pavilion', name: 'Pier Pavilion', kind: 'building', cost: 380, attraction: 7, incomePerTourist: 2.3, maintenance: 38, maxLevels: 2, zones: ['pier'], tags: ['sturdy', 'amusement'], flavor: 'Built to shrug off a gale.' },

  // ---- Monuments: expensive, huge attraction, one level ----
  { id: 'wheel', name: 'The Great Wheel', kind: 'monument', cost: 800, attraction: 18, incomePerTourist: 2, maintenance: 60, maxLevels: 1, zones: SHORE, tags: ['sturdy'], flavor: 'See three counties on a clear day.' },
  { id: 'bandstand', name: 'Victorian Bandstand', kind: 'monument', cost: 600, attraction: 13, incomePerTourist: 1.6, maintenance: 45, maxLevels: 1, zones: PROMS, tags: [], flavor: 'Brass on Sunday afternoons.' },
  { id: 'carousel', name: 'Golden Carousel', kind: 'monument', cost: 700, attraction: 15, incomePerTourist: 1.8, maintenance: 50, maxLevels: 1, zones: SHORE, tags: ['amusement'], flavor: 'Painted horses, barrel organ waltz.' },
  { id: 'lido', name: 'Sea Lido', kind: 'monument', cost: 750, attraction: 16, incomePerTourist: 1.9, maintenance: 55, maxLevels: 1, zones: ['water', 'beach'], tags: ['clean'], flavor: 'Salt-water swimming, art-deco tiles.' },
];

export const DISASTERS: DisasterDef[] = [
  {
    id: 'storm', name: 'Storm', zones: ['pier', 'water'], attractionMult: 0, incomeMult: 0,
    duration: 2, resistedBy: 'sturdy',
    description: 'A gale closes the pier and empties the water. Sturdy structures hold their trade.',
    icon: '🌩️',
  },
  {
    id: 'pollution', name: 'Pollution', zones: ['beach', 'water'], attractionMult: 0.25, incomeMult: 0.25,
    duration: 2, resistedBy: 'clean',
    description: 'A slick washes ashore. The beach and water empty; clean-certified attractions carry on.',
    icon: '🛢️',
  },
  {
    id: 'seagulls', name: 'Seagull Menace', zones: ['north-prom', 'south-prom', 'pier', 'beach'], attractionMult: 0.75, incomeMult: 0.5,
    duration: 1, resistedBy: 'netted', kindFilter: 'kiosk',
    description: 'A brazen flock harasses anyone holding food. Kiosks suffer unless netted.',
    icon: '🕊️',
  },
];

export const EVENTS: EventCardDef[] = [
  { id: 'bank-holiday', name: 'Bank Holiday', category: 'boom', description: 'Half the country heads for the coast. +30 tourists this round.', effects: [{ type: 'touristDelta', amount: 30, duration: 1 }] },
  { id: 'heatwave', name: 'Heatwave', category: 'boom', description: 'Scorching skies for two rounds. +20 tourists per round.', effects: [{ type: 'touristDelta', amount: 20, duration: 2 }] },
  { id: 'rail-excursion', name: 'Railway Excursion', category: 'boom', description: 'A packed excursion train arrives. +25 tourists this round.', effects: [{ type: 'touristDelta', amount: 25, duration: 1 }] },
  { id: 'drizzle', name: 'Sea Drizzle', category: 'shift', description: 'A grey mizzle sets in. −15 tourists this round.', effects: [{ type: 'touristDelta', amount: -15, duration: 1 }] },
  { id: 'regatta', name: 'The Regatta', category: 'shift', description: 'Sails crowd the horizon. Water attractions ×2 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'water', mult: 2, duration: 2 }] },
  { id: 'promenade-parade', name: 'Promenade Parade', category: 'shift', description: 'Brass bands march the North Promenade. Its attractions ×1.5 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'north-prom', mult: 1.5, duration: 2 }] },
  { id: 'sandcastle-contest', name: 'Sandcastle Contest', category: 'shift', description: 'Buckets and spades at dawn. Beach attractions ×1.5 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'beach', mult: 1.5, duration: 2 }] },
  { id: 'pier-illuminations', name: 'Pier Illuminations', category: 'shift', description: 'The pier glows at dusk. Pier attractions ×1.5 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'pier', mult: 1.5, duration: 2 }] },
  { id: 'market-day', name: 'Market Day', category: 'shift', description: 'Stalls do a roaring trade. Kiosk income ×2 for two rounds.', effects: [{ type: 'kindBoost', kind: 'kiosk', incomeMult: 2, duration: 2 }] },
  { id: 'tourism-grant', name: 'Tourism Board Grant', category: 'windfall', description: 'The council backs the seafront. Every player receives £100.', effects: [{ type: 'cashAll', amount: 100 }] },
  { id: 'postcard-fame', name: 'Postcard Fame', category: 'windfall', description: 'Your seafront makes the front of a postcard. Current player receives £150.', effects: [{ type: 'cashCurrent', amount: 150 }] },
  { id: 'lost-wallet', name: 'Lost Wallet Returned', category: 'windfall', description: 'Honesty pays. Current player receives £80.', effects: [{ type: 'cashCurrent', amount: 80 }] },
  { id: 'council-rates', name: 'Council Rates', category: 'levy', description: 'The council calls in seafront rates. Every player pays £120.', effects: [{ type: 'cashAll', amount: -120 }] },
  { id: 'safety-inspection', name: 'Safety Inspection', category: 'levy', description: 'Inspectors comb the boardwalk. Every player pays £80.', effects: [{ type: 'cashAll', amount: -80 }] },
  { id: 'repainting', name: 'Repainting Order', category: 'levy', description: 'Peeling paint will not do. Current player pays £100.', effects: [{ type: 'cashCurrent', amount: -100 }] },
  { id: 'storm-front', name: 'Storm Front', category: 'disaster', description: 'Black clouds roll in off the Channel.', effects: [{ type: 'disaster', disaster: 'storm' }] },
  { id: 'slick-tide', name: 'Slick Tide', category: 'disaster', description: 'Something foul is on the tide.', effects: [{ type: 'disaster', disaster: 'pollution' }] },
  { id: 'gull-season', name: 'Gull Season', category: 'disaster', description: 'The flock has learned no fear.', effects: [{ type: 'disaster', disaster: 'seagulls' }] },
  { id: 'quiet-tuesday', name: 'Quiet Tuesday', category: 'shift', description: 'A sleepy off-season lull. −10 tourists this round.', effects: [{ type: 'touristDelta', amount: -10, duration: 1 }] },
  { id: 'coach-tours', name: 'Coach Tours', category: 'boom', description: 'Coaches line the seafront road. +15 tourists for two rounds.', effects: [{ type: 'touristDelta', amount: 15, duration: 2 }] },
];

export const CHARACTERS: CharacterDef[] = [
  { id: 'hotelier', name: 'Ada Fairweather', title: 'The Hotelier', emoji: '🎩', bonusText: 'Buildings cost 15% less to construct.', bonus: { type: 'buildDiscount', kind: 'building', pct: 0.15 } },
  { id: 'showman', name: 'Reg Marvello', title: 'The Showman', emoji: '🎪', bonusText: 'Your monuments attract 30% more tourists.', bonus: { type: 'attractionBonus', kind: 'monument', pct: 0.3 } },
  { id: 'kiosk-queen', name: 'Priya Shore', title: 'The Kiosk Queen', emoji: '🍦', bonusText: 'Your kiosks cost nothing to maintain.', bonus: { type: 'noMaintenance', kind: 'kiosk' } },
  { id: 'banker', name: 'Marcus Sterling', title: 'The Banker', emoji: '🏦', bonusText: 'Collect an extra £40 every Income Phase.', bonus: { type: 'incomeFlat', amount: 40 } },
  { id: 'engineer', name: 'Sofia Trestle', title: 'The Engineer', emoji: '🔧', bonusText: 'Your structures are unaffected by storms.', bonus: { type: 'resistDisaster', disaster: 'storm' } },
  { id: 'promoter', name: 'Tommy Flyer', title: 'The Promoter', emoji: '📣', bonusText: 'Your clusters count as one establishment larger.', bonus: { type: 'clusterBonus', extraSize: 1 } },
];

export const RULES: RuleNumbers = {
  startingCapital: { 2: 1800, 3: 1500, 4: 1300 },
  touristsPerPip: 10,
  clusterBase: 1.25,
  clusterCap: 2.5,
  levelMult: [1, 1.6, 2.3],
  preferenceMult: 1.5,
  sellPct: 0.5,
  mortgagePct: 0.4,
  unmortgagePct: 0.5,
  mortgagedMaintenancePct: 0.5,
};

export const BASE_CONTENT: ContentPack = {
  zones: ZONES,
  establishments: ESTABLISHMENTS,
  events: EVENTS,
  disasters: DISASTERS,
  characters: CHARACTERS,
  rules: RULES,
};
