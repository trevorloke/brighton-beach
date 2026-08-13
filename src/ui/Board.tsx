import { useMemo } from 'react';
import type { ContentPack, GameState, Slot, ZoneId } from '../engine/types';
import { activeDisasters, clusterSizes, defById, slotKey } from '../engine/selectors';

/**
 * The board: a gently stylised top-down seafront. The promenade runs along the
 * top with the pier striking out between its north and south halves, shingle
 * beach below, then open water. Every zone has a distinct ground treatment;
 * ownership reads through colour AND flag shape; stack height reads as
 * physically taller structures; clusters are strung with bunting.
 */

const EMOJI: Record<string, string> = {
  'ice-cream': '🍦', chippy: '🍟', deckchairs: '🪑', souvenirs: '🎁', pedalos: '🦢', donuts: '🍩',
  cafe: '☕', arcade: '🕹️', restaurant: '🍽️', hotel: '🏨', aquarium: '🐠', pavilion: '🎭',
  wheel: '🎡', bandstand: '🎪', carousel: '🎠', lido: '🏊',
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
function geom(zone: ZoneId, index: number): SlotGeom {
  return SLOT_GEOMS[slotKey(zone, index)];
}
// North promenade: six berths west of the pier.
for (let i = 0; i < 6; i++) SLOT_GEOMS[`north-prom:${i}`] = { x: 28 + i * 79, y: 96, w: 70, h: 70 };
// South promenade: six berths east of the pier.
for (let i = 0; i < 6; i++) SLOT_GEOMS[`south-prom:${i}`] = { x: 606 + i * 79, y: 96, w: 70, h: 70 };
// Pier: five berths marching out to sea.
for (let i = 0; i < 5; i++) SLOT_GEOMS[`pier:${i}`] = { x: 514, y: 196 + i * 82, w: 72, h: 70 };
// Beach: six pitches on the shingle (the pier passes overhead between 2 and 3).
const BEACH_X = [46, 196, 346, 668, 818, 968];
for (let i = 0; i < 6; i++) SLOT_GEOMS[`beach:${i}`] = { x: BEACH_X[i], y: 262, w: 86, h: 76 };
// Water: four moorings.
const WATER_X = [110, 300, 716, 906];
for (let i = 0; i < 4; i++) SLOT_GEOMS[`water:${i}`] = { x: WATER_X[i], y: 492, w: 86, h: 70 };

const ZONE_LABELS: Record<string, { x: number; y: number; anchor?: 'start' | 'end' | 'middle' }> = {
  'north-prom': { x: 40, y: 58 },
  'south-prom': { x: 1060, y: 58, anchor: 'end' },
  pier: { x: 550, y: 645, anchor: 'middle' },
  beach: { x: 40, y: 208 },
  water: { x: 40, y: 416 },
};

const ZONE_RECTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  'north-prom': { x: 16, y: 44, w: 490, h: 134 },
  'south-prom': { x: 594, y: 44, w: 490, h: 134 },
  pier: { x: 504, y: 178, w: 92, h: 428 },
  beach: { x: 16, y: 196, w: 1068, h: 154 },
  water: { x: 16, y: 400, w: 1068, h: 270 },
};

export type BoardMode =
  | { kind: 'idle' }
  | { kind: 'placing'; validSlots: Set<string> }
  | { kind: 'inspect' };

interface Props {
  content: ContentPack;
  state: GameState;
  mode: BoardMode;
  selectedSlot: string | null;
  onSlotClick: (slot: Slot) => void;
}

export function Board({ content, state, mode, selectedSlot, onSlotClick }: Props) {
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
        viewBox="0 0 1100 690"
        role="group"
        aria-label="The Brighton Beach board"
      >
        <defs>
          <linearGradient id="sea-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#37c4d6" />
            <stop offset="100%" stopColor="#0c6272" />
          </linearGradient>
          <linearGradient id="shingle-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#efc978" />
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
            <rect width="4" height="10" fill="rgba(31,58,77,0.28)" />
          </pattern>
        </defs>

        {/* town backdrop */}
        <rect x="0" y="0" width="1100" height="40" fill="#f6ecd4" />
        {Array.from({ length: 22 }, (_, i) => (
          <g key={i} transform={`translate(${i * 50 + 8}, ${8 + (i % 3) * 2})`} aria-hidden>
            <rect width="34" height={30 - (i % 3) * 3} fill={['#e8b7a5', '#bcd8d2', '#e6d3a8', '#c9b7d8'][i % 4]} rx="2" />
            <rect x="5" y="5" width="7" height="7" fill="rgba(31,58,77,0.35)" />
            <rect x="21" y="5" width="7" height="7" fill="rgba(31,58,77,0.35)" />
          </g>
        ))}

        {/* promenade paving */}
        <rect x="0" y="40" width="1100" height="140" fill="url(#paving)" />
        {/* beach */}
        <rect x="0" y="180" width="1100" height="176" fill="url(#shingle-grad)" />
        <rect x="0" y="180" width="1100" height="176" fill="url(#pebbles)" />
        {/* water */}
        <rect x="0" y="356" width="1100" height="324" fill="url(#sea-grad)" />
        {/* surf line */}
        <path
          d="M0 360 Q 55 350 110 360 T 220 360 T 330 360 T 440 360 T 550 360 T 660 360 T 770 360 T 880 360 T 990 360 T 1100 360"
          fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="4" strokeLinecap="round"
        />
        {/* wave marks */}
        {[420, 480, 540, 600].map((y, r) => (
          <g key={y} aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                d={`M${60 + i * 140 + (r % 2) * 60} ${y} q 14 -8 28 0`}
                stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none" strokeLinecap="round"
              />
            ))}
          </g>
        ))}

        {/* the pier: legs then deck */}
        {[240, 330, 420, 510, 585].map((y) => (
          <g key={y} aria-hidden>
            <rect x="512" y={y} width="8" height="30" fill="#7a5124" />
            <rect x="580" y={y} width="8" height="30" fill="#7a5124" />
          </g>
        ))}
        <rect x="500" y="178" width="100" height="430" fill="url(#planks)" rx="6" />
        <rect x="500" y="178" width="100" height="430" fill="none" stroke="#7a5124" strokeWidth="3" rx="6" />
        {/* pier-head finial */}
        <circle cx="550" cy="612" r="10" fill="#e8604c" stroke="#7a5124" strokeWidth="2" />

        {/* zone labels + tourist meters */}
        {content.zones.map((z) => {
          const label = ZONE_LABELS[z.id];
          const rect = ZONE_RECTS[z.id];
          const count = state.tourists[z.id] ?? 0;
          const preferred = state.preferredZone === z.id;
          const meterW = 70;
          const chipX =
            label.anchor === 'end' ? label.x - 148 : label.anchor === 'middle' ? label.x - 74 : label.x;
          return (
            <g key={z.id}>
              <text className="zone-label" x={label.x} y={label.y} fontSize="20" textAnchor={label.anchor ?? 'start'}>
                {z.name.toUpperCase()}
              </text>
              {/* tourist chip: count + meter (visible representation of flow) */}
              <g transform={`translate(${chipX}, ${label.y + 6})`} aria-label={`${count} tourists in ${z.name}`}>
                <rect className="tourist-chip-bg" width={meterW + 78} height="22" rx="11" />
                <text className="tourist-chip-text" x="8" y="16" fontSize="13">
                  👥 {count}
                </text>
                <rect x="66" y="7" width={meterW} height="8" rx="4" fill="rgba(255,255,255,0.25)" />
                <rect x="66" y="7" width={(meterW * count) / maxTourists} height="8" rx="4" fill="#37c4d6" />
                {preferred && (
                  <text className="pref-star" x={meterW + 60} y="17" fontSize="14" aria-label="preferred zone">
                    ★
                  </text>
                )}
              </g>
              {/* keep TS happy that rect is used for the veil below */}
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="none" pointerEvents="none" />
            </g>
          );
        })}

        {/* cluster bunting */}
        {clusterRuns.map((run) => {
          const a = geom(run.zone, run.from);
          const b = geom(run.zone, run.to);
          const vertical = run.zone === 'pier';
          const x1 = vertical ? a.x + a.w / 2 : a.x + 6;
          const y1 = vertical ? a.y + 4 : a.y - 6;
          const x2 = vertical ? b.x + b.w / 2 : b.x + b.w - 6;
          const y2 = vertical ? b.y + b.h - 4 : b.y - 6;
          const flags = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 24));
          return (
            <g key={`${run.zone}-${run.from}`} aria-label={`Cluster of ${run.to - run.from + 1} in ${run.zone}`}>
              <rect
                x={Math.min(x1, x2) - 10} y={Math.min(y1, y2) - 4}
                width={Math.abs(x2 - x1) + 20 || a.w} height={vertical ? Math.abs(y2 - y1) + 8 : a.h + 16}
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
          <g key={d.id} className="disaster-veil">
            {d.zones.map((zid) => {
              const r = ZONE_RECTS[zid];
              if (!r) return null;
              return (
                <rect key={zid} x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="url(#hatch)" stroke="#e8604c" strokeWidth="2.5" strokeDasharray="8 5" />
              );
            })}
            {(() => {
              const r = ZONE_RECTS[d.zones[0]];
              return (
                <g transform={`translate(${r.x + 10}, ${r.y + r.h / 2})`}>
                  <rect x="-4" y="-16" width="150" height="32" rx="16" fill="rgba(199,74,56,0.92)" />
                  <text x="6" y="6" fontSize="15" fill="#fff" fontWeight="800">
                    {d.icon} {d.name} · {disasterRounds(d.id)}r
                  </text>
                </g>
              );
            })()}
          </g>
        ))}
      </svg>
    </div>
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
  const key = slotKey(slot.zone, slot.index);
  const structure = slot.structure;

  if (!structure) {
    const valid = mode.kind === 'placing' && mode.validSlots.has(key);
    const interactive = valid;
    return (
      <rect
        className={`slot-empty${valid ? ' slot-valid' : ''}`}
        x={g.x} y={g.y} width={g.w} height={g.h} rx="10"
        tabIndex={interactive ? 0 : -1}
        role={interactive ? 'button' : undefined}
        aria-label={interactive ? `Build on ${slot.zone} berth ${slot.index + 1}` : undefined}
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
      />
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
      role="button"
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
      <text
        x={g.x + g.w / 2} y={g.y + g.h / 2 + 8 - (levels - 1) * 9}
        textAnchor="middle" fontSize="26"
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
      {/* ownership flag: colour + shape (never colour alone) */}
      <g transform={`translate(${g.x + 2}, ${g.y - (levels - 1) * 9 - 6})`} aria-hidden>
        <rect x="0" y="0" width="3" height="20" fill="#5b4630" />
        <FlagShape shape={owner.flagShape} color={structure.mortgaged ? '#9aa5a1' : owner.color} />
      </g>
      {structure.mortgaged && (
        <g aria-hidden>
          <rect x={g.x + 6} y={g.y + g.h - 22} width="60" height="16" rx="8" fill="#47616f" />
          <text x={g.x + 36} y={g.y + g.h - 10} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="800">
            MORTGAGED
          </text>
        </g>
      )}
      {clusterSize > 1 && (
        <title>{`${def.name} — in a cluster of ${clusterSize}`}</title>
      )}
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
