import { useMemo, useState } from 'react';
import type { ContentPack, GameConfig, SetupPlayer } from '../engine/types';
import { RulesModal } from './RulesModal';
import { Bunting } from './bits';

export const PLAYER_COLORS = [
  { name: 'Coral', hex: '#E8604C' },
  { name: 'Teal', hex: '#148BA6' },
  { name: 'Mustard', hex: '#D9A426' },
  { name: 'Plum', hex: '#7B5EA7' },
];

/** Ownership is never colour alone: each player also gets a flag shape. */
export const FLAG_SHAPES = ['triangle', 'swallowtail', 'square', 'circle'] as const;

interface Props {
  content: ContentPack;
  hasSave: boolean;
  onStart: (config: GameConfig) => void;
  onResume: () => void;
  onAbandonSave: () => void;
}

export function Lobby({ content, hasSave, onStart, onResume, onAbandonSave }: Props) {
  const [count, setCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '']);
  const [chars, setChars] = useState<(string | null)[]>([null, null, null, null]);
  const [showRules, setShowRules] = useState(false);
  const [pickingFor, setPickingFor] = useState(0);

  const ready = useMemo(
    () => Array.from({ length: count }, (_, i) => chars[i]).every(Boolean),
    [count, chars],
  );

  const start = () => {
    const players: SetupPlayer[] = Array.from({ length: count }, (_, i) => ({
      name: names[i].trim() || `Player ${i + 1}`,
      color: PLAYER_COLORS[i].hex,
      flagShape: FLAG_SHAPES[i],
      characterId: chars[i]!,
    }));
    onStart({ seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, players });
  };

  return (
    <div className="lobby">
      <Bunting width={420} />
      <h1 className="lobby-title">Brighton Beach</h1>
      <p className="lobby-sub">
        Build the seafront. Chase the tourist tide. Be the last entrepreneur standing.
      </p>

      {hasSave && (
        <div className="lobby-card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>A game is waiting on the seafront.</strong>
          <button className="btn-primary" onClick={onResume}>
            Resume saved game
          </button>
          <button className="btn-ghost" onClick={onAbandonSave}>
            Abandon it
          </button>
        </div>
      )}

      <div className="lobby-card">
        <h2>New game</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 700 }}>Players:</span>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              className={n === count ? 'btn-primary' : 'btn-quiet'}
              aria-pressed={n === count}
              onClick={() => {
                setCount(n);
                setPickingFor((p) => Math.min(p, n - 1));
              }}
            >
              {n}
            </button>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            <button className="btn-ghost" onClick={() => setShowRules(true)}>
              📖 How to play
            </button>
          </span>
        </div>

        {Array.from({ length: count }, (_, i) => (
          <div className="player-row" key={i}>
            <span
              className="swatch"
              style={{ background: PLAYER_COLORS[i].hex }}
              title={`${PLAYER_COLORS[i].name} · ${FLAG_SHAPES[i]} flag`}
            >
              {flagGlyph(FLAG_SHAPES[i])}
            </span>
            <input
              type="text"
              placeholder={`Player ${i + 1} name`}
              aria-label={`Player ${i + 1} name`}
              value={names[i]}
              onChange={(e) => setNames((ns) => ns.map((n, j) => (j === i ? e.target.value : n)))}
              maxLength={18}
            />
            <button
              className={pickingFor === i ? 'btn-primary' : 'btn-quiet'}
              onClick={() => setPickingFor(i)}
            >
              {chars[i]
                ? content.characters.find((c) => c.id === chars[i])!.title
                : 'Pick character…'}
            </button>
          </div>
        ))}
      </div>

      <div className="lobby-card">
        <h2>
          Character for{' '}
          <span style={{ color: PLAYER_COLORS[pickingFor].hex }}>
            {names[pickingFor].trim() || `Player ${pickingFor + 1}`}
          </span>
        </h2>
        <div className="char-grid">
          {content.characters.map((c) => {
            const takenBy = chars.findIndex((id, i) => id === c.id && i < count);
            const takenByOther = takenBy !== -1 && takenBy !== pickingFor;
            return (
              <button
                key={c.id}
                className={`char-card${chars[pickingFor] === c.id ? ' selected' : ''}${takenByOther ? ' taken' : ''}`}
                disabled={takenByOther}
                onClick={() =>
                  setChars((cs) => cs.map((id, i) => (i === pickingFor ? c.id : id)))
                }
              >
                <span className="char-emoji" aria-hidden>
                  {c.emoji}
                </span>
                <span>
                  <div className="char-name">{c.name}</div>
                  <div className="char-title">{c.title}</div>
                  <div className="char-bonus">{c.bonusText}</div>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="btn-coral btn-big" disabled={!ready} onClick={start}>
        {ready ? '🌊 Open the season' : 'Every player needs a character'}
      </button>

      {showRules && <RulesModal content={content} onClose={() => setShowRules(false)} />}
    </div>
  );
}

export function flagGlyph(shape: (typeof FLAG_SHAPES)[number]): string {
  switch (shape) {
    case 'triangle': return '▲';
    case 'swallowtail': return '⚑';
    case 'square': return '■';
    case 'circle': return '●';
  }
}
