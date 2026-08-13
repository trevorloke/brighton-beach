import { useMemo } from 'react';
import type { ContentPack, DisasterDef, GameState, SeasonDef, Slot, ZoneId } from '../engine/types';
import { activeDisasters, clusterSizes, defById, slotKey, traitsAt } from '../engine/selectors';

/**
 * The board: a stylised top-down seafront, alive with weather and detail.
 * The promenade runs along the top with the pier striking out between its
 * north and south halves, shingle beach below, then open water. Every zone
 * has a distinct ground treatment; every berth wears its printed traits as
 * badges; ownership reads through colour AND flag shape; stack height reads
 * as physically taller structures; clusters are strung with bunting; the
 * season tints the light.
 */

const EMOJI: Record<string, string> = {
  'ice-cream': '🍦', chippy: '🍟', deckchairs: '🪑', souvenirs: '🎁', pedalos: '🦢', donuts: '🍩', 'rock-shop': '🍭',
  cafe: '☕', arcade: '🕹️', restaurant: '🍽️', hotel: '🏨', aquarium: '🐠', pavilion: '🎭', ballroom: '💃',
  wheel: '🎡', bandstand: '🎪', carousel: '🎠', lido: '🏊', lighthouse: '🗼',
};

export function establishmentEmoji(defId: string): string {
  return EMOJI[defId] ?? '🏛️';
}

interface SlotGeom {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SLOT_GEOMS: Record<string, SlotGeom> = {};
function geom(zone: ZoneId, index: number): SlotGeom | undefined {
  return SLOT_GEOMS[slotKey(zone, index)];
}
// North promenade: nine berths west of the pier.
for (let i = 0; i < 9; i++) SLOT_GEOMS[`north-prom:${i}`] = { x: 14 + i * 60, y: 96, w: 56, h: 74 };
// South promenade: nine berths east of the pier.
for (let i = 0; i < 9; i++) SLOT_GEOMS[`south-prom:${i}`] = { x: 700 + i * 60, y: 96, w: 56, h: 74 };
// Pier: seven berths marching out to sea.
for (let i = 0; i < 7; i++) SLOT_GEOMS[`pier:${i}`] = { x: 584, y: 210 + i * 68, w: 72, h: 58 };
// Beach: nine pitches on the shingle, five west of the pier and four east.
const BEACH_X = [30, 134, 238, 342, 446, 716, 820, 924, 1028];
for (let i = 0; i < 9; i++) SLOT_GEOMS[`beach:${i}`] = { x: BEACH_X[i], y: 268, w: 78, h: 70 };
// Water: six moorings, three each side of the pier.
const WATER_X = [60, 190, 320, 780, 910, 1040];
for (let i = 0; i < 6; i++) SLOT_GEOMS[`water:${i}`] = { x: WATER_X[i], y: 470, w: 78, h: 62 };

const ZONE_LABELS: Record<string, { x: number; y: number; anchor?: 'start' | 'end' | 'middle'; chip: { x: number; y: number } }> = {
  'north-prom': { x: 16, y: 74, chip: { x: 256, y: 56 } },
  'south-prom': { x: 1224, y: 74, anchor: 'end', chip: { x: 824, y: 56 } },
  pier: { x: 620, y: 748, anchor: 'middle', chip: { x: 542, y: 754 } },
  beach: { x: 16, y: 236, chip: { x: 16, y: 242 } },
  water: { x: 16, y: 430, chip: { x: 16, y: 436 } },
};

/** Zone footprints for disaster veils (beach and water split around the pier). */
const ZONE_RECTS: Record<string, { x: number; y: number; w: number; h: number }[]> = {
  'north-prom': [{ x: 8, y: 50, w: 560, h: 138 }],
  'south-prom': [{ x: 692, y: 50, w: 542, h: 138 }],
  pier: [{ x: 576, y: 192, w: 116, h: 514 }],
  beach: [
    { x: 8, y: 200, w: 560, h: 158 },
    { x: 700, y: 200, w: 534, h: 158 },
  ],
  water: [
    { x: 8, y: 380, w: 560, h: 392 },
    { x: 700, y: 380, w: 534, h: 392 },
  ],
};

/** Per-disaster veil colours so each catastrophe reads differently. */
const VEIL: Record<string, { stroke: string; fill: string }> = {
  storm: { stroke: '#3d5a80', fill: 'rgba(61, 90, 128, 0.30)' },
  pollution: { stroke: '#5f6b3f', fill: 'rgba(95, 107, 63, 0.30)' },
  seagulls: { stroke: '#e8604c', fill: 'rgba(232, 96, 76, 0.16)' },
  fog: { stroke: '#a9b8bd', fill: 'rgba(233, 240, 242, 0.55)' },
  heatwave: { stroke: '#d97b29', fill: 'rgba(217, 123, 41, 0.22)' },
};

/** Season light: a wash over the whole seafront. */
const SEASON_TINT: Record<string, string> = {
  spring: 'rgba(255, 255, 255, 0)',
  summer: 'rgba(255, 199, 89, 0.10)',
  autumn: 'rgba(222, 133, 62, 0.12)',
  winter: 'rgba(154, 197, 232, 0.18)',
};

export type BoardMode =
  | { kind: 'idle' }
  | { kind: 'placing'; validSlots: Set<string> }
  | { kind: 'inspect' };

interface Props {
  content: ContentPack;
  state: GameState;
  season: SeasonDef;
  mode: BoardMode;
  selectedSlot: string | null;
  onSlotClick: (slot: Slot) => void;
  onZoneClick?: (zone: ZoneId) => void;
}

export function Board({ content, state, season, mode, selectedSlot, onSlotClick, onZoneClick }: Props) {
  const clusters = useMemo(() => clusterSizes(state), [state]);
  const disasters = useMemo(() => activeDisasters(state, content), [state, content]);
  const disasterRounds = (id: string) =>
    state.activeEffects.find((e) => e.effect.type === 'disasterActive' && e.effect.disaster === id)
      ?.remainingRounds ?? 0;

  const maxTourists = Math.max(1, ...Object.values(state.tourists));

  // Bunting strings across each cluster of 2+.
  const clusterRuns = useMemo(() => {
    const runs: { zone: ZoneId; from: number; to: number }[] = [];
    for (const zone of content.zones) {
      let start: number | null = null;
      for (let i = 0; i <= zone.slots; i++) {
        const s = state.slots.find((sl) => sl.zone === zone.id && sl.index === i);
        const occupied = !!s?.structure && !s.structure.mortgaged;
        if (occupied && start === null) start = i;
        if (!occupied && start !== null) {
          if (i - start >= 2) runs.push({ zone: zone.id, from: start, to: i - 1 });
          start = null;
        }
      }
    }
    return runs;
  }, [content.zones, state.slots]);

  return (
    <div className="board-wrap">
      <svg
        className="board-svg"
        viewBox="0 0 1240 780"
        role="group"
        aria-label="The Brighton Beach board"
      >
        <defs>
          <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfeef2" />
            <stop offset="100%" stopColor="#f6ecd4" />
          </linearGradient>
          <linearGradient id="sea-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#37c4d6" />
            <stop offset="70%" stopColor="#16a5b8" />
            <stop offset="100%" stopColor="#0c6272" />
          </linearGradient>
          <linearGradient id="shingle-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2d089" />
            <stop offset="100%" stopColor="#d9a446" />
          </linearGradient>
          <pattern id="paving" width="26" height="14" patternUnits="userSpaceOnUse">
            <rect width="26" height="14" fill="#cfd8d4" />
            <path d="M0 0H26M0 7H26M13 0V7M6 7V14M20 7V14" stroke="#b9c4bf" strokeWidth="1" />
          </pattern>
          <pattern id="planks" width="12" height="18" patternUnits="userSpaceOnUse">
            <rect width="12" height="18" fill="#b07a3f" />
            <path d="M0 0V18M0 9H12" stroke="#93602c" strokeWidth="1.5" />
          </pattern>
          <pattern id="pebbles" width="22" height="16" patternUnits="userSpaceOnUse">
            <rect width="22" height="16" fill="transparent" />
            <circle cx="5" cy="5" r="1.6" fill="rgba(140,100,40,0.35)" />
            <circle cx="15" cy="11" r="1.3" fill="rgba(140,100,40,0.28)" />
          </pattern>
          <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="transparent" />
            <rect width="4" height="10" fill="rgba(31,58,77,0.22)" />
          </pattern>
        </defs>

        {/* sky, sun, clouds */}
        <rect x="0" y="0" width="1240" height="46" fill="url(#sky-grad)" />
        <g className="board-sun" aria-hidden>
          <circle cx="1196" cy="26" r="16" fill="#ffd257" stroke="#e8a41c" strokeWidth="2" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1={1196 + Math.cos(a) * 20} y1={26 + Math.sin(a) * 20}
                x2={1196 + Math.cos(a) * 26} y2={26 + Math.sin(a) * 26}
                stroke="#e8a41c" strokeWidth="2.5" strokeLinecap="round"
              />
            );
          })}
        </g>
        {/* base transforms keep clouds/gulls placed sensibly under reduced motion */}
        <g className="board-cloud cloud-a" aria-hidden transform="translate(240, 0)">
          <ellipse cx="0" cy="18" rx="26" ry="9" fill="rgba(255,255,255,0.85)" />
          <ellipse cx="20" cy="14" rx="18" ry="7" fill="rgba(255,255,255,0.85)" />
        </g>
        <g className="board-cloud cloud-b" aria-hidden transform="translate(880, 0)">
          <ellipse cx="0" cy="30" rx="20" ry="7" fill="rgba(255,255,255,0.7)" />
          <ellipse cx="16" cy="26" rx="13" ry="5" fill="rgba(255,255,255,0.7)" />
        </g>

        {/* town backdrop: painted facades */}
        {Array.from({ length: 22 }, (_, i) => (
          <g key={i} transform={`translate(${i * 52 + 6}, ${12 + (i % 3) * 2})`} aria-hidden>
            <rect width="36" height={34 - (i % 3) * 3} fill={['#e8b7a5', '#bcd8d2', '#e6d3a8', '#c9b7d8'][i % 4]} rx="2" />
            <rect x="5" y="6" width="7" height="7" fill="rgba(31,58,77,0.35)" />
            <rect x="23" y="6" width="7" height="7" fill="rgba(31,58,77,0.35)" />
            {i % 4 === 1 && <path d="M0 0 L18 -7 L36 0 Z" fill="rgba(31,58,77,0.25)" />}
          </g>
        ))}

        {/* promenade paving */}
        <rect x="0" y="46" width="1240" height="154" fill="url(#paving)" />
        {/* railings between promenade and beach */}
        <line x1="0" y1="199" x2="1240" y2="199" stroke="#8fa39c" strokeWidth="3" />
        {[80, 260, 440, 760, 940, 1120].map((x) => (
          <g key={x} aria-hidden>
            <rect x={x} y="186" width="4" height="14" fill="#5b6f68" />
            <circle cx={x + 2} cy="184" r="4" fill="#e7b85c" stroke="#5b6f68" strokeWidth="1.5" />
          </g>
        ))}
        {/* beach */}
        <rect x="0" y="200" width="1240" height="176" fill="url(#shingle-grad)" />
        <rect x="0" y="200" width="1240" height="176" fill="url(#pebbles)" />
        {/* beach decor: parasols and towels in the unclaimed sand */}
        <g aria-hidden>
          {[
            { x: 1150, y: 250 }, { x: 1190, y: 300 }, { x: 540, y: 232 },
          ].map((p, i) => (
            <g key={i} transform={`translate(${p.x}, ${p.y})`}>
              <line x1="0" y1="0" x2="0" y2="20" stroke="#8a5a2b" strokeWidth="2.5" />
              <path d="M-14 2 A 14 14 0 0 1 14 2 Z" fill={i % 2 ? '#e8604c' : '#16a5b8'} stroke="#fff" strokeWidth="1.5" />
            </g>
          ))}
          {[{ x: 100, y: 348 }, { x: 900, y: 350 }].map((p, i) => (
            <rect key={i} x={p.x} y={p.y} width="26" height="14" rx="2" fill={i % 2 ? 'rgba(232,96,76,0.5)' : 'rgba(22,165,184,0.5)'} stroke="rgba(255,255,255,0.6)" />
          ))}
        </g>

        {/* water */}
        <rect x="0" y="376" width="1240" height="404" fill="url(#sea-grad)" />
        {/* surf line */}
        <path
          d="M0 380 Q 62 370 124 380 T 248 380 T 372 380 T 496 380 T 620 380 T 744 380 T 868 380 T 992 380 T 1116 380 T 1240 380"
          fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="4" strokeLinecap="round"
        />
        {/* wave marks */}
        {[430, 560, 620, 690].map((y, r) => (
          <g key={y} className={`board-wave wave-${r % 2}`} aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <path
                key={i}
                d={`M${50 + i * 140 + (r % 2) * 70} ${y} q 14 -8 28 0`}
                stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none" strokeLinecap="round"
              />
            ))}
          </g>
        ))}
        {/* little boats */}
        <g className="board-boat" aria-hidden transform="translate(180, 640)">
          <path d="M-18 0 H18 L10 10 H-10 Z" fill="#e8604c" stroke="#fff" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="-22" stroke="#5b4630" strokeWidth="2" />
          <path d="M0 -22 L14 -6 L0 -6 Z" fill="#fbf3e0" stroke="#5b4630" strokeWidth="1" />
        </g>
        <g className="board-boat boat-b" aria-hidden transform="translate(1050, 600)">
          <path d="M-14 0 H14 L8 8 H-8 Z" fill="#7b5ea7" stroke="#fff" strokeWidth="1.5" />
          <line x1="0" y1="0" x2="0" y2="-18" stroke="#5b4630" strokeWidth="2" />
          <path d="M0 -18 L11 -5 L0 -5 Z" fill="#fbf3e0" stroke="#5b4630" strokeWidth="1" />
        </g>
        {/* buoys */}
        {[{ x: 480, y: 700 }, { x: 900, y: 720 }].map((p, i) => (
          <g key={i} className="board-boat" aria-hidden transform={`translate(${p.x}, ${p.y})`}>
            <circle r="6" fill="#e8604c" stroke="#fff" strokeWidth="1.5" />
            <line x1="0" y1="-6" x2="0" y2="-12" stroke="#fff" strokeWidth="2" />
          </g>
        ))}

        {/* the pier: legs then deck */}
        {[250, 330, 410, 490, 570, 650].map((y) => (
          <g key={y} aria-hidden>
            <rect x="588" y={y} width="8" height="34" fill="#7a5124" />
            <rect x="644" y={y} width="8" height="34" fill="#7a5124" />
          </g>
        ))}
        <rect x="578" y="192" width="112" height="514" fill="url(#planks)" rx="6" />
        <rect x="578" y="192" width="112" height="514" fill="none" stroke="#7a5124" strokeWidth="3" rx="6" />
        {/* pier-head pavilion silhouette + finial */}
        <g aria-hidden>
          <path d="M600 706 L634 690 L668 706 Z" fill="#c74a38" stroke="#7a5124" strokeWidth="2" />
          <circle cx="634" cy="686" r="4" fill="#e7b85c" stroke="#7a5124" strokeWidth="1.5" />
          <line x1="634" y1="682" x2="634" y2="672" stroke="#7a5124" strokeWidth="2" />
          <path d="M634 672 L648 676 L634 680 Z" fill="#e8604c" />
        </g>

        {/* gulls wheeling over the front */}
        <g className="board-gull gull-a" aria-hidden transform="translate(340, 226)">
          <path d="M0 0 q 5 -6 10 0 q 5 -6 10 0" stroke="#47616f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
        <g className="board-gull gull-b" aria-hidden transform="translate(780, 214)">
          <path d="M0 0 q 4 -5 8 0 q 4 -5 8 0" stroke="#47616f" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>

        {/* zone labels + tourist meters */}
        {content.zones.map((z) => {
          const label = ZONE_LABELS[z.id];
          if (!label) return null;
          const count = state.tourists[z.id] ?? 0;
          const preferred = state.preferredZone === z.id;
          const meterW = 64;
          const chipW = meterW + 92;
          return (
            <g key={z.id}>
              <text className="zone-label" x={label.x} y={label.y} fontSize="20" textAnchor={label.anchor ?? 'start'}>
                {z.name.toUpperCase()}
              </text>
              {/* tourist chip: count + meter — click for the zone breakdown */}
              <g
                transform={`translate(${label.chip.x}, ${label.chip.y})`}
                className="tourist-chip"
                role={onZoneClick ? 'button' : undefined}
                tabIndex={onZoneClick ? 0 : -1}
                aria-label={`${count} tourists in ${z.name}${preferred ? ' (preferred zone)' : ''} — inspect zone`}
                onClick={onZoneClick ? () => onZoneClick(z.id) : undefined}
                onKeyDown={
                  onZoneClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onZoneClick(z.id);
                        }
                      }
                    : undefined
                }
              >
                <rect className="tourist-chip-bg" width={chipW} height="22" rx="11" />
                <text className="tourist-chip-text" x="8" y="16" fontSize="13">
                  👥 {count}
                </text>
                <rect x="74" y="7" width={meterW} height="8" rx="4" fill="rgba(255,255,255,0.25)" />
                <rect x="74" y="7" width={(meterW * count) / maxTourists} height="8" rx="4" fill="#37c4d6" />
                {preferred && (
                  <text className="pref-star" x={meterW + 78} y="17" fontSize="14" aria-label="preferred zone">
                    ★
                  </text>
                )}
              </g>
            </g>
          );
        })}

        {/* cluster bunting */}
        {clusterRuns.map((run) => {
          const a = geom(run.zone, run.from);
          const b = geom(run.zone, run.to);
          if (!a || !b) return null;
          const vertical = run.zone === 'pier';
          const x1 = vertical ? a.x + a.w / 2 : a.x + 6;
          const y1 = vertical ? a.y + 4 : a.y - 6;
          const x2 = vertical ? b.x + b.w / 2 : b.x + b.w - 6;
          const y2 = vertical ? b.y + b.h - 4 : b.y - 6;
          const flags = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 24));
          return (
            <g key={`${run.zone}-${run.from}`} aria-label={`Cluster of ${run.to - run.from + 1} in ${run.zone}`}>
              <rect
                x={vertical ? a.x - 6 : Math.min(x1, x2) - 10}
                y={Math.min(y1, y2) - 4}
                width={vertical ? a.w + 12 : Math.abs(x2 - x1) + 20}
                height={vertical ? Math.abs(y2 - y1) + 8 : a.h + 16}
                rx="12" fill="rgba(255, 236, 160, 0.28)"
              />
              <path d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + (vertical ? 0 : 10)} ${x2} ${y2}`} stroke="#fff" strokeWidth="2" fill="none" />
              {Array.from({ length: flags }, (_, i) => {
                const t = (i + 0.5) / flags;
                const mx = x1 + (x2 - x1) * t;
                const my = y1 + (y2 - y1) * t + (vertical ? 0 : 10 * Math.sin(Math.PI * t) * 0.6);
                return (
                  <path
                    key={i}
                    d={`M${mx - 5} ${my} L${mx + 5} ${my} L${mx} ${my + 9} Z`}
                    fill={['#e8604c', '#e7b85c', '#16a5b8'][i % 3]}
                  />
                );
              })}
            </g>
          );
        })}

        {/* slots */}
        {state.slots.map((slot) => (
          <SlotView
            key={slotKey(slot.zone, slot.index)}
            content={content}
            state={state}
            slot={slot}
            mode={mode}
            clusters={clusters}
            selected={selectedSlot === slotKey(slot.zone, slot.index)}
            onClick={() => onSlotClick(slot)}
          />
        ))}

        {/* disaster veils */}
        {disasters.map((d) => (
          <DisasterVeil key={d.id} disaster={d} rounds={disasterRounds(d.id)} />
        ))}

        {/* season light wash */}
        <rect
          x="0" y="0" width="1240" height="780"
          fill={SEASON_TINT[season.id] ?? 'rgba(255,255,255,0)'}
          pointerEvents="none"
        />
      </svg>
    </div>
  );
}

function DisasterVeil({ disaster, rounds }: { disaster: DisasterDef; rounds: number }) {
  const veil = VEIL[disaster.id] ?? { stroke: '#e8604c', fill: 'rgba(199,74,56,0.2)' };
  const rects = disaster.zones.flatMap((zid) => ZONE_RECTS[zid] ?? []);
  if (rects.length === 0) return null;
  const chipAt = rects[0];
  return (
    <g className="disaster-veil">
      {rects.map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill={veil.fill} />
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="url(#hatch)" stroke={veil.stroke} strokeWidth="2.5" strokeDasharray="8 5" />
        </g>
      ))}
      <g transform={`translate(${chipAt.x + 10}, ${chipAt.y + chipAt.h / 2})`}>
        <rect x="-4" y="-16" width="164" height="32" rx="16" fill="rgba(31,58,77,0.92)" />
        <text x="6" y="6" fontSize="15" fill="#fff" fontWeight="800">
          {disaster.icon} {disaster.name} · {rounds}r
        </text>
      </g>
    </g>
  );
}

function SlotView({
  content, state, slot, mode, clusters, selected, onClick,
}: {
  content: ContentPack;
  state: GameState;
  slot: Slot;
  mode: BoardMode;
  clusters: Map<string, number>;
  selected: boolean;
  onClick: () => void;
}) {
  const g = geom(slot.zone, slot.index);
  if (!g) return null;
  const key = slotKey(slot.zone, slot.index);
  const structure = slot.structure;
  const traits = traitsAt(content, slot.zone, slot.index);
  const zoneName = content.zones.find((z) => z.id === slot.zone)?.name ?? slot.zone;

  if (!structure) {
    const valid = mode.kind === 'placing' && mode.validSlots.has(key);
    // Empty berths stay inspectable outside placement so traits can be studied.
    const interactive = valid || mode.kind === 'inspect';
    const traitText = traits.length ? ` — ${traits.map((t) => t.name).join(', ')}` : '';
    return (
      <g
        className={`slot-empty-group${valid ? ' slot-valid-group' : ''}`}
        tabIndex={interactive ? 0 : -1}
        role={interactive ? 'button' : undefined}
        aria-label={
          interactive
            ? `${valid ? 'Build on ' : ''}berth ${slot.index + 1}, ${zoneName}${traitText}`
            : undefined
        }
        onClick={interactive ? onClick : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <rect
          className={`slot-empty${valid ? ' slot-valid' : ''}`}
          x={g.x} y={g.y} width={g.w} height={g.h} rx="10"
        />
        <TraitBadges traits={traits} g={g} dim={!valid} />
        {traits.length > 0 && (
          <title>{`Berth ${slot.index + 1}, ${zoneName}: ${traits.map((t) => `${t.name} — ${t.blurb}`).join(' · ')}`}</title>
        )}
      </g>
    );
  }

  const def = defById(content, structure.pieces[0]);
  const owner = state.players[structure.ownerId];
  const levels = structure.pieces.length;
  const clusterSize = clusters.get(key) ?? 1;
  const interactive = mode.kind !== 'placing';

  return (
    <g
      className={`slot-occupied${selected ? ' slot-selected' : ''}`}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'button' : undefined}
      aria-label={`${def.name}, ${levels} level${levels > 1 ? 's' : ''}, owned by ${owner.name}${structure.mortgaged ? ', mortgaged' : ''}`}
      onClick={interactive ? onClick : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* stacked storeys behind the face — height reads at board scale */}
      {Array.from({ length: levels }, (_, i) => {
        const inset = (levels - 1 - i) * 5;
        const lift = i * 9;
        return (
          <rect
            key={i}
            className={i === levels - 1 ? 'plinth' : undefined}
            x={g.x + 4 + inset} y={g.y + 8 - lift} width={g.w - 8 - inset * 2} height={g.h - 14}
            rx="8"
            fill={structure.mortgaged ? '#9aa5a1' : shade(owner.color, i * 12)}
            stroke="rgba(8,66,78,0.55)" strokeWidth="2"
          />
        );
      })}
      {/* glyph plaque for contrast */}
      <circle
        cx={g.x + g.w / 2} cy={g.y + g.h / 2 - (levels - 1) * 9}
        r={Math.min(g.w, g.h) / 3.4}
        fill={structure.mortgaged ? 'rgba(255,255,255,0.45)' : 'rgba(255,250,240,0.85)'}
      />
      <text
        x={g.x + g.w / 2} y={g.y + g.h / 2 + 8 - (levels - 1) * 9}
        textAnchor="middle" fontSize="24"
        style={structure.mortgaged ? { filter: 'grayscale(1)', opacity: 0.7 } : undefined}
      >
        {establishmentEmoji(def.id)}
      </text>
      {/* level pips: readable without clicking */}
      {levels > 1 && (
        <g aria-hidden>
          <rect x={g.x + g.w - 24} y={g.y - (levels - 1) * 9 + 2} width="20" height="16" rx="8" fill="#08424e" />
          <text x={g.x + g.w - 14} y={g.y - (levels - 1) * 9 + 14} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="800">
            ×{levels}
          </text>
        </g>
      )}
      {/* ownership flag: colour + shape (never colour alone); lift capped so
          tall promenade buildings don't push it into the zone labels */}
      <g transform={`translate(${g.x + 2}, ${g.y - Math.min((levels - 1) * 9, 12) - 6})`} aria-hidden>
        <rect x="0" y="0" width="3" height="20" fill="#5b4630" />
        <FlagShape shape={owner.flagShape} color={structure.mortgaged ? '#9aa5a1' : owner.color} />
      </g>
      {structure.mortgaged && (
        <g aria-hidden>
          {/* sits above the trait badges so both stay readable */}
          <rect x={g.x + 4} y={g.y + g.h - 40} width={Math.min(64, g.w - 8)} height="16" rx="8" fill="#47616f" />
          <text x={g.x + 4 + Math.min(64, g.w - 8) / 2} y={g.y + g.h - 28} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="800">
            MORTGAGED
          </text>
        </g>
      )}
      <TraitBadges traits={traits} g={g} dim={false} />
      <title>
        {`${def.name}${levels > 1 ? ` ×${levels}` : ''} — ${owner.name}` +
          (clusterSize > 1 ? ` — in a cluster of ${clusterSize}` : '') +
          (traits.length ? ` — ${traits.map((t) => t.name).join(', ')}` : '')}
      </title>
    </g>
  );
}

/** Small round badges pinned to a berth's corner showing its printed traits. */
function TraitBadges({ traits, g, dim }: { traits: { id: string; icon: string; good: boolean }[]; g: SlotGeom; dim: boolean }) {
  if (traits.length === 0) return null;
  return (
    <g aria-hidden opacity={dim ? 0.75 : 1}>
      {traits.map((t, i) => (
        <g key={t.id} transform={`translate(${g.x + g.w - 10 - i * 22}, ${g.y + g.h - 10})`}>
          <circle r="10" fill={t.good ? '#fffaf0' : '#f6e2de'} stroke={t.good ? '#0c6272' : '#c74a38'} strokeWidth="1.8" strokeDasharray={t.good ? undefined : '3 2'} />
          <text y="4.5" textAnchor="middle" fontSize="11">{t.icon}</text>
        </g>
      ))}
    </g>
  );
}

function FlagShape({ shape, color }: { shape: string; color: string }) {
  switch (shape) {
    case 'triangle':
      return <path d="M3 1 L19 6 L3 11 Z" fill={color} stroke="#fff" strokeWidth="1" />;
    case 'swallowtail':
      return <path d="M3 1 L19 1 L13 6 L19 11 L3 11 Z" fill={color} stroke="#fff" strokeWidth="1" />;
    case 'square':
      return <rect x="3" y="1" width="14" height="11" fill={color} stroke="#fff" strokeWidth="1" />;
    default:
      return <circle cx="10" cy="6" r="6" fill={color} stroke="#fff" strokeWidth="1" />;
  }
}

/** Darken a hex colour by an amount 0–100. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, c - amount));
  const r = f((n >> 16) & 0xff);
  const gr = f((n >> 8) & 0xff);
  const b = f(n & 0xff);
  return `#${((r << 16) | (gr << 8) | b).toString(16).padStart(6, '0')}`;
}
