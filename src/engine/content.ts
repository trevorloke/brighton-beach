import type {
  ContentPack,
  ZoneDef,
  EstablishmentDef,
  BerthTraitDef,
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
  { id: 'north-prom', name: 'North Promenade', shortName: 'North Prom', slots: 9, allows: ['kiosk', 'building', 'monument'], baseAttraction: 5 },
  { id: 'south-prom', name: 'South Promenade', shortName: 'South Prom', slots: 9, allows: ['kiosk', 'building', 'monument'], baseAttraction: 5 },
  { id: 'pier', name: 'The Pier', shortName: 'Pier', slots: 7, allows: ['kiosk', 'building', 'monument'], baseAttraction: 7 },
  { id: 'beach', name: 'Main Beach', shortName: 'Beach', slots: 9, allows: ['kiosk', 'monument'], baseAttraction: 7 },
  { id: 'water', name: 'The Water', shortName: 'Water', slots: 6, allows: ['kiosk', 'monument'], baseAttraction: 3 },
];

const PROMS = ['north-prom', 'south-prom'];
const LAND = ['north-prom', 'south-prom', 'pier'];
const SHORE = ['north-prom', 'south-prom', 'pier', 'beach'];

export const ESTABLISHMENTS: EstablishmentDef[] = [
  // ---- Kiosks: cheap, quick income, pull tourists toward a zone ----
  { id: 'ice-cream', name: 'Ice Cream Kiosk', kind: 'kiosk', cost: 180, attraction: 3, incomePerTourist: 1.6, maintenance: 16, maxLevels: 1, zones: SHORE, tags: ['food'], flavor: '99 with a flake, mind the gulls.' },
  { id: 'chippy', name: 'Fish & Chips Stand', kind: 'kiosk', cost: 220, attraction: 3, incomePerTourist: 1.9, maintenance: 20, maxLevels: 1, zones: SHORE, tags: ['food'], flavor: 'Salt, vinegar, sea air.' },
  { id: 'deckchairs', name: 'Deckchair Hire', kind: 'kiosk', cost: 140, attraction: 2, incomePerTourist: 1.7, maintenance: 12, maxLevels: 1, zones: ['beach'], tags: [], flavor: 'Stripes for hire by the hour.' },
  { id: 'souvenirs', name: 'Souvenir Stall', kind: 'kiosk', cost: 160, attraction: 2, incomePerTourist: 1.8, maintenance: 14, maxLevels: 1, zones: LAND, tags: ['netted'], flavor: 'Rock candy and postcards under netting.' },
  { id: 'pedalos', name: 'Pedalo Hire', kind: 'kiosk', cost: 200, attraction: 3, incomePerTourist: 1.5, maintenance: 18, maxLevels: 1, zones: ['water'], tags: ['clean'], flavor: 'Swan-shaped, seaworthy-ish.' },
  { id: 'donuts', name: 'Donut Fryer', kind: 'kiosk', cost: 180, attraction: 3, incomePerTourist: 1.7, maintenance: 16, maxLevels: 1, zones: ['pier', 'north-prom', 'south-prom'], tags: ['food'], flavor: 'Hot sugar in a paper bag.' },
  { id: 'rock-shop', name: 'Brighton Rock Shop', kind: 'kiosk', cost: 170, attraction: 2, incomePerTourist: 1.9, maintenance: 15, maxLevels: 1, zones: LAND, tags: ['netted', 'food'], flavor: 'BRIGHTON, all the way through.' },

  // ---- Buildings: primary income, stack into multi-storey landmarks ----
  { id: 'cafe', name: 'Seafront Café', kind: 'building', cost: 450, attraction: 5, incomePerTourist: 2.8, maintenance: 40, maxLevels: 3, zones: PROMS, tags: ['food'], flavor: 'Tea served with a sea view.' },
  { id: 'arcade', name: 'Amusement Arcade', kind: 'building', cost: 580, attraction: 7, incomePerTourist: 3.2, maintenance: 52, maxLevels: 3, zones: LAND, tags: ['amusement', 'netted', 'lit'], flavor: 'Tuppence cascades and neon.' },
  { id: 'restaurant', name: 'Fish Restaurant', kind: 'building', cost: 640, attraction: 6, incomePerTourist: 3.8, maintenance: 60, maxLevels: 3, zones: LAND, tags: ['food'], flavor: 'The catch of the day, plated.' },
  { id: 'hotel', name: 'Seaside Hotel', kind: 'building', cost: 820, attraction: 8, incomePerTourist: 4.0, maintenance: 82, maxLevels: 3, zones: PROMS, tags: ['lodging', 'sturdy'], flavor: 'Regency stucco, sea-facing rooms.' },
  { id: 'aquarium', name: 'Aquarium', kind: 'building', cost: 720, attraction: 8, incomePerTourist: 3.4, maintenance: 65, maxLevels: 2, zones: ['pier', 'north-prom', 'south-prom'], tags: ['clean', 'sturdy'], flavor: 'Rays glide under Victorian arches.' },
  { id: 'pavilion', name: 'Pier Pavilion', kind: 'building', cost: 690, attraction: 7, incomePerTourist: 3.6, maintenance: 62, maxLevels: 2, zones: ['pier'], tags: ['sturdy', 'amusement', 'lit'], flavor: 'Built to shrug off a gale.' },
  { id: 'ballroom', name: 'Winter Ballroom', kind: 'building', cost: 760, attraction: 7, incomePerTourist: 3.9, maintenance: 70, maxLevels: 2, zones: PROMS, tags: ['sturdy', 'lit'], flavor: 'Chandeliers against the winter dark.' },

  // ---- Monuments: expensive showpieces, huge attraction, one level ----
  { id: 'wheel', name: 'The Great Wheel', kind: 'monument', cost: 1450, attraction: 18, incomePerTourist: 3.2, maintenance: 105, maxLevels: 1, zones: SHORE, tags: ['sturdy', 'lit'], flavor: 'See three counties on a clear day.' },
  { id: 'bandstand', name: 'Victorian Bandstand', kind: 'monument', cost: 1050, attraction: 13, incomePerTourist: 2.6, maintenance: 80, maxLevels: 1, zones: PROMS, tags: [], flavor: 'Brass on Sunday afternoons.' },
  { id: 'carousel', name: 'Golden Carousel', kind: 'monument', cost: 1250, attraction: 15, incomePerTourist: 2.9, maintenance: 92, maxLevels: 1, zones: SHORE, tags: ['amusement', 'lit'], flavor: 'Painted horses, barrel organ waltz.' },
  { id: 'lido', name: 'Sea Lido', kind: 'monument', cost: 1350, attraction: 16, incomePerTourist: 3.0, maintenance: 98, maxLevels: 1, zones: ['water', 'beach'], tags: ['clean'], flavor: 'Salt-water swimming, art-deco tiles.' },
  { id: 'lighthouse', name: 'Old Lighthouse', kind: 'monument', cost: 980, attraction: 12, incomePerTourist: 2.4, maintenance: 72, maxLevels: 1, zones: ['water', 'beach'], tags: ['sturdy', 'lit'], flavor: 'A sweep of light across the bay.' },
];

/* ------------------------------------------------------------------ */
/* Berth traits — every square of the board has its own character      */
/* ------------------------------------------------------------------ */

export const TRAITS: BerthTraitDef[] = [
  { id: 'corner', name: 'Prime Corner', icon: '★', good: true, attractionMult: 1.25, blurb: 'The busiest crossing on the front — attraction ×1.25.' },
  { id: 'seaview', name: 'Sea View', icon: '🌅', good: true, incomeMult: 1.2, blurb: 'Customers linger and spend — income ×1.2.' },
  { id: 'thoroughfare', name: 'Thoroughfare', icon: '👣', good: true, attractionMult: 1.15, upkeepMult: 1.2, blurb: 'Endless footfall, endless wear — attraction ×1.15, upkeep ×1.2.' },
  { id: 'quiet', name: 'Quiet End', icon: '🌿', good: false, attractionMult: 0.8, costMult: 0.75, blurb: 'Off the beaten track — attraction ×0.8, but building costs ×0.75.' },
  { id: 'sheltered', name: 'Sheltered', icon: '🛡️', good: true, grantsTags: ['sturdy'], blurb: 'In the lee of the sea wall — structures here stand through storms.' },
  { id: 'springs', name: 'Fresh Springs', icon: '💧', good: true, grantsTags: ['clean'], blurb: 'Spring-fed and spotless — structures here shrug off pollution.' },
  { id: 'gullroost', name: 'Gull Roost', icon: '🪶', good: false, upkeepMult: 1.3, blurb: 'The flock lives upstairs — cleaning bills raise upkeep ×1.3.' },
  { id: 'subsiding', name: 'Subsiding Ground', icon: '⚠️', good: false, costMult: 0.85, maxLevelsCap: 1, blurb: 'Soft ground: cheap to build (×0.85) but nothing can be stacked here.' },
  { id: 'postcard', name: 'Postcard Spot', icon: '📮', good: true, attractionMult: 1.2, costMult: 1.3, blurb: 'The view on every postcard — attraction ×1.2, but land costs ×1.3.' },
  { id: 'landmark', name: 'Landmark Plot', icon: '🏛️', good: true, attractionMult: 1.3, upkeepMult: 1.15, blurb: 'The head of the pier itself — attraction ×1.3, upkeep ×1.15.' },
  { id: 'windswept', name: 'Windswept', icon: '🌬️', good: false, attractionMult: 0.85, upkeepMult: 0.85, blurb: 'Bracing, to put it kindly — attraction ×0.85, upkeep ×0.85.' },
  { id: 'lamplit', name: 'Lamplit Row', icon: '🏮', good: true, grantsTags: ['lit'], upkeepMult: 1.1, blurb: 'Gas lamps burn all night — lit through fog, upkeep ×1.1.' },
];

/**
 * The fixed board map. Slot key ("zone:index") → trait ids.
 * Berths without an entry are plain ground. The board is a designed
 * artifact: players learn these squares like a home board.
 */
export const BERTH_TRAITS: Record<string, string[]> = {
  // North Promenade, west → east (8 abuts the pier entrance)
  'north-prom:0': ['quiet'],
  'north-prom:2': ['gullroost'],
  'north-prom:3': ['thoroughfare'],
  'north-prom:5': ['postcard'],
  'north-prom:6': ['subsiding'],
  'north-prom:7': ['lamplit'],
  'north-prom:8': ['corner'],
  // South Promenade, west → east (0 abuts the pier entrance)
  'south-prom:0': ['corner'],
  'south-prom:2': ['seaview'],
  'south-prom:3': ['lamplit'],
  'south-prom:4': ['thoroughfare'],
  'south-prom:6': ['gullroost'],
  'south-prom:7': ['subsiding'],
  'south-prom:8': ['quiet'],
  // The Pier, shore → sea (6 is the pier head)
  'pier:0': ['thoroughfare'],
  'pier:2': ['sheltered'],
  'pier:4': ['windswept'],
  'pier:5': ['lamplit'],
  'pier:6': ['landmark'],
  // Main Beach, west → east (4 sits by the pier steps)
  'beach:0': ['quiet'],
  'beach:1': ['seaview'],
  'beach:3': ['springs'],
  'beach:4': ['corner'],
  'beach:6': ['seaview'],
  'beach:7': ['gullroost'],
  'beach:8': ['windswept'],
  // The Water, west → east (2 lies in the lee of the pier)
  'water:0': ['springs'],
  'water:2': ['sheltered'],
  'water:3': ['postcard'],
  'water:5': ['windswept'],
};

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
  {
    id: 'fog', name: 'Sea Fog', zones: ['north-prom', 'south-prom', 'pier', 'beach', 'water'], attractionMult: 0.6, incomeMult: 0.8,
    duration: 1, resistedBy: 'lit',
    description: 'The front vanishes into grey. Only the lit attractions glow through.',
    icon: '🌫️',
  },
  {
    id: 'heatwave', name: 'Scorcher', zones: ['north-prom', 'south-prom', 'pier'], attractionMult: 0.7, incomeMult: 0.85,
    duration: 2, resistedBy: 'food',
    description: 'Melting tarmac drives the crowds off the pavements toward the sand and sea. Food stalls keep their trade anywhere.',
    icon: '🥵',
  },
];

export const EVENTS: EventCardDef[] = [
  // ---- Booms ----
  { id: 'bank-holiday', name: 'Bank Holiday', category: 'boom', description: 'Half the country heads for the coast. +120 tourists this round.', effects: [{ type: 'touristDelta', amount: 120, duration: 1 }] },
  { id: 'carnival-week', name: 'Carnival Week', category: 'boom', description: 'Floats, brass and streamers. +80 tourists per round for two rounds.', effects: [{ type: 'touristDelta', amount: 80, duration: 2 }] },
  { id: 'rail-excursion', name: 'Railway Excursion', category: 'boom', description: 'A packed excursion train arrives. +100 tourists this round.', effects: [{ type: 'touristDelta', amount: 100, duration: 1 }] },
  { id: 'sunshine-spell', name: 'Sunshine Spell', category: 'boom', description: 'Blue skies for two rounds. +60 tourists per round.', effects: [{ type: 'touristDelta', amount: 60, duration: 2 }] },
  { id: 'film-crew', name: 'Film Crew on the Front', category: 'boom', description: 'Lights, cameras, crowds: +90 tourists this round, and the current player earns £100 in location fees.', effects: [{ type: 'touristDelta', amount: 90, duration: 1 }, { type: 'cashCurrent', amount: 100 }] },
  { id: 'coach-tours', name: 'Coach Tours', category: 'boom', description: 'Coaches line the seafront road. +70 tourists for two rounds.', effects: [{ type: 'touristDelta', amount: 70, duration: 2 }] },
  { id: 'day-trippers', name: 'Day-Tripper Special', category: 'boom', description: 'Cheap tickets from the city. +110 tourists this round.', effects: [{ type: 'touristDelta', amount: 110, duration: 1 }] },

  // ---- Shifts ----
  { id: 'regatta', name: 'The Regatta', category: 'shift', description: 'Sails crowd the horizon. Water attractions ×2 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'water', mult: 2, duration: 2 }] },
  { id: 'promenade-parade', name: 'Promenade Parade', category: 'shift', description: 'Brass bands march the North Promenade. Its attractions ×1.6 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'north-prom', mult: 1.6, duration: 2 }] },
  { id: 'south-fair', name: 'South Prom Street Fair', category: 'shift', description: 'Stalls and street theatre on the South Promenade. Its attractions ×1.6 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'south-prom', mult: 1.6, duration: 2 }] },
  { id: 'sandcastle-contest', name: 'Sandcastle Contest', category: 'shift', description: 'Buckets and spades at dawn. Beach attractions ×1.6 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'beach', mult: 1.6, duration: 2 }] },
  { id: 'pier-illuminations', name: 'Pier Illuminations', category: 'shift', description: 'The pier glows at dusk. Pier attractions ×1.6 for two rounds.', effects: [{ type: 'zoneBoost', zone: 'pier', mult: 1.6, duration: 2 }] },
  { id: 'market-day', name: 'Market Day', category: 'shift', description: 'Stalls do a roaring trade. Kiosk income ×2 for two rounds.', effects: [{ type: 'kindBoost', kind: 'kiosk', incomeMult: 2, duration: 2 }] },
  { id: 'gala-night', name: 'Gala Night', category: 'shift', description: 'Dinner jackets and dance cards. Building income ×1.5 for two rounds.', effects: [{ type: 'kindBoost', kind: 'building', incomeMult: 1.5, duration: 2 }] },
  { id: 'heritage-day', name: 'Heritage Open Day', category: 'shift', description: 'The great landmarks throw open their gates. Monument income ×1.5 for two rounds.', effects: [{ type: 'kindBoost', kind: 'monument', incomeMult: 1.5, duration: 2 }] },
  { id: 'drizzle', name: 'Sea Drizzle', category: 'shift', description: 'A grey mizzle sets in. −80 tourists this round.', effects: [{ type: 'touristDelta', amount: -80, duration: 1 }] },
  { id: 'quiet-tuesday', name: 'Quiet Tuesday', category: 'shift', description: 'A sleepy off-season lull. −60 tourists this round.', effects: [{ type: 'touristDelta', amount: -60, duration: 1 }] },

  // ---- Windfalls ----
  { id: 'tourism-grant', name: 'Tourism Board Grant', category: 'windfall', description: 'The council backs the seafront. Every player receives £180.', effects: [{ type: 'cashAll', amount: 180 }] },
  { id: 'postcard-fame', name: 'Postcard Fame', category: 'windfall', description: 'Your seafront makes the front of a postcard. Current player receives £250.', effects: [{ type: 'cashCurrent', amount: 250 }] },
  { id: 'lost-wallet', name: 'Lost Wallet Returned', category: 'windfall', description: 'Honesty pays. Current player receives £120.', effects: [{ type: 'cashCurrent', amount: 120 }] },
  { id: 'heritage-fund', name: 'Heritage Fund', category: 'windfall', description: 'The preservation trust pays £40 toward every monument on the front.', effects: [{ type: 'perStructureCash', amount: 40, kind: 'monument' }] },

  // ---- Levies ----
  { id: 'council-rates', name: 'Council Rates', category: 'levy', description: 'The council calls in seafront rates. Every player pays £220.', effects: [{ type: 'cashAll', amount: -220 }] },
  { id: 'safety-inspection', name: 'Safety Inspection', category: 'levy', description: 'Inspectors comb the boardwalk. Every player pays £30 per establishment they own.', effects: [{ type: 'perStructureCash', amount: -30 }] },
  { id: 'repainting', name: 'Repainting Order', category: 'levy', description: 'Peeling paint will not do. Current player pays £180.', effects: [{ type: 'cashCurrent', amount: -180 }] },
  { id: 'ground-rents', name: 'Ground Rents Due', category: 'levy', description: 'The estate collects its dues. Every player pays £150.', effects: [{ type: 'cashAll', amount: -150 }] },
  { id: 'charity-gala', name: 'Charity Gala', category: 'levy', description: 'Noblesse oblige on the front: the richest player donates £150 to the poorest.', effects: [{ type: 'transferRichPoor', amount: 150 }] },

  // ---- Economy swings ----
  { id: 'planning-grant', name: 'Planning Grant', category: 'economy', description: 'The council fast-tracks development: building costs ×0.7 this round.', effects: [{ type: 'globalMult', costMult: 0.7, duration: 1 }] },
  { id: 'maintenance-holiday', name: 'Maintenance Holiday', category: 'economy', description: 'The trades take a well-earned week off: no upkeep is charged this round.', effects: [{ type: 'globalMult', upkeepMult: 0, duration: 1 }] },
  { id: 'materials-shortage', name: 'Materials Shortage', category: 'economy', description: 'Timber and paint run scarce: building costs ×1.3 for two rounds.', effects: [{ type: 'globalMult', costMult: 1.3, duration: 2 }] },

  // ---- Disasters ----
  { id: 'storm-front', name: 'Storm Front', category: 'disaster', description: 'Black clouds roll in off the Channel.', effects: [{ type: 'disaster', disaster: 'storm' }] },
  { id: 'slick-tide', name: 'Slick Tide', category: 'disaster', description: 'Something foul is on the tide.', effects: [{ type: 'disaster', disaster: 'pollution' }] },
  { id: 'gull-season', name: 'Gull Season', category: 'disaster', description: 'The flock has learned no fear.', effects: [{ type: 'disaster', disaster: 'seagulls' }] },
  { id: 'fog-bank', name: 'Fog Bank', category: 'disaster', description: 'The horizon disappears, then the pier, then your hand.', effects: [{ type: 'disaster', disaster: 'fog' }] },
  { id: 'scorcher', name: 'Scorcher', category: 'disaster', description: 'The hottest day in living memory — the pavements empty and the sand and sea overflow.', effects: [{ type: 'disaster', disaster: 'heatwave' }, { type: 'zoneBoost', zone: 'beach', mult: 1.4, duration: 2 }, { type: 'zoneBoost', zone: 'water', mult: 1.4, duration: 2 }] },
];

export const CHARACTERS: CharacterDef[] = [
  { id: 'hotelier', name: 'Ada Fairweather', title: 'The Hotelier', emoji: '🎩', bonusText: 'Buildings cost 20% less to construct.', bonus: { type: 'buildDiscount', kind: 'building', pct: 0.2 } },
  { id: 'showman', name: 'Reg Marvello', title: 'The Showman', emoji: '🎪', bonusText: 'Your monuments attract 40% more tourists.', bonus: { type: 'attractionBonus', kind: 'monument', pct: 0.4 } },
  { id: 'kiosk-queen', name: 'Priya Shore', title: 'The Kiosk Queen', emoji: '🍦', bonusText: 'Your kiosks cost 30% less to maintain.', bonus: { type: 'maintenanceDiscount', kind: 'kiosk', pct: 0.3 } },
  { id: 'banker', name: 'Marcus Sterling', title: 'The Banker', emoji: '🏦', bonusText: 'Collect an extra £35 every Income Phase.', bonus: { type: 'incomeFlat', amount: 35 } },
  { id: 'engineer', name: 'Sofia Trestle', title: 'The Engineer', emoji: '🔧', bonusText: 'Your structures shrug off every disaster.', bonus: { type: 'resistAllDisasters' } },
  { id: 'promoter', name: 'Tommy Flyer', title: 'The Promoter', emoji: '📣', bonusText: 'Your clusters count as two establishments larger.', bonus: { type: 'clusterBonus', extraSize: 2 } },
  { id: 'dealmaker', name: 'Edie Lanes', title: 'The Dealmaker', emoji: '💼', bonusText: 'Bank sales return 75% of value instead of 50%.', bonus: { type: 'sellBonus', pct: 0.25 } },
  { id: 'restaurateur', name: 'Vera Bright', title: 'The Restaurateur', emoji: '👩‍🍳', bonusText: 'Your buildings earn 20% more income.', bonus: { type: 'incomeBonus', kind: 'building', pct: 0.2 } },
];

export const RULES: RuleNumbers = {
  startingCapital: { 2: 2600, 3: 2300, 4: 1800 },
  touristBase: 150,
  touristsPerPip: 25,
  surgeBonus: 100,
  clusterBase: 1.3,
  clusterCap: 2.8,
  levelMult: [1, 1.7, 2.5],
  preferenceMult: 1.5,
  sellPct: 0.5,
  mortgagePct: 0.4,
  unmortgagePct: 0.5,
  mortgagedMaintenancePct: 0.5,
  seasons: [
    { id: 'spring', name: 'Spring', icon: '🌸', touristMult: 1.0, blurb: 'Mild skies and the first day-trippers.' },
    { id: 'summer', name: 'High Summer', icon: '☀️', touristMult: 1.35, blurb: 'The height of the season — the whole country on the sand.' },
    { id: 'autumn', name: 'Autumn', icon: '🍂', touristMult: 0.95, blurb: 'Golden light, thinner crowds.' },
    { id: 'winter', name: 'Winter', icon: '❄️', touristMult: 0.6, blurb: 'Wind off the Channel; only the hardy walk the front.' },
  ],
  rentEscalationEvery: 3,
  rentEscalationMult: 1.2,
  rentEscalationCap: 2.5,
};

export const BASE_CONTENT: ContentPack = {
  zones: ZONES,
  establishments: ESTABLISHMENTS,
  events: EVENTS,
  disasters: DISASTERS,
  characters: CHARACTERS,
  traits: TRAITS,
  berthTraits: BERTH_TRAITS,
  rules: RULES,
};
