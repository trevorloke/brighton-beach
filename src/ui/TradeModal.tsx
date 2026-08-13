import { useMemo, useState } from 'react';
import type { ContentPack, GameState, TradeSide } from '../engine/types';
import { defById, playersRemaining, slotKey } from '../engine/selectors';
import { Modal, money } from './bits';
import { establishmentEmoji } from './Board';
import { flagGlyph } from './Lobby';

interface Props {
  content: ContentPack;
  state: GameState;
  onSubmit: (withPlayer: number, give: TradeSide, receive: TradeSide) => void;
  onClose: () => void;
}

/**
 * Two-party trade builder. The proposer assembles both sides, then the other
 * player confirms on the same screen (hotseat) before anything moves.
 * No hidden state: both offers are always fully visible.
 */
export function TradeModal({ content, state, onSubmit, onClose }: Props) {
  const me = state.players[state.currentPlayer];
  const others = playersRemaining(state).filter((p) => p.id !== me.id);
  const [withPlayer, setWithPlayer] = useState(others[0]?.id ?? -1);
  const [giveCash, setGiveCash] = useState(0);
  const [receiveCash, setReceiveCash] = useState(0);
  const [giveStructures, setGiveStructures] = useState<string[]>([]);
  const [receiveStructures, setReceiveStructures] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  const other = state.players[withPlayer];

  const myStructures = useMemo(
    () => state.slots.filter((s) => s.structure?.ownerId === me.id && !s.structure.mortgaged),
    [state.slots, me.id],
  );
  const theirStructures = useMemo(
    () => state.slots.filter((s) => s.structure?.ownerId === withPlayer && !s.structure?.mortgaged),
    [state.slots, withPlayer],
  );

  const somethingOffered =
    giveCash > 0 || receiveCash > 0 || giveStructures.length > 0 || receiveStructures.length > 0;
  const affordable = giveCash <= me.cash && (other ? receiveCash <= other.cash : false);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  const sideSummary = (cash: number, structures: string[]) => {
    const parts: string[] = [];
    if (cash > 0) parts.push(money(cash));
    for (const key of structures) {
      const slot = state.slots.find((s) => slotKey(s.zone, s.index) === key)!;
      parts.push(defById(content, slot.structure!.pieces[0]).name);
    }
    return parts.length ? parts.join(', ') : 'nothing';
  };

  if (!other) {
    return (
      <Modal title="Trade" onClose={onClose}>
        <p>No one is left to trade with.</p>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  if (confirming) {
    return (
      <Modal title={`${other.name}, do you accept?`} onClose={() => setConfirming(false)}>
        <p>
          <strong style={{ color: me.color }}>{flagGlyph(me.flagShape)} {me.name}</strong> offers{' '}
          <strong>{sideSummary(giveCash, giveStructures)}</strong> in exchange for your{' '}
          <strong>{sideSummary(receiveCash, receiveStructures)}</strong>.
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-soft)' }}>
          Pass the screen to {other.name}. Trades are final once accepted.
        </p>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => setConfirming(false)}>
            ✋ Decline / amend
          </button>
          <button
            className="btn-coral"
            onClick={() =>
              onSubmit(withPlayer, { cash: giveCash, structures: giveStructures }, { cash: receiveCash, structures: receiveStructures })
            }
          >
            🤝 {other.name} accepts
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Strike a deal" wide onClose={onClose}>
      {others.length > 1 && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>Trading with:</span>
          {others.map((p) => (
            <button
              key={p.id}
              className={p.id === withPlayer ? 'btn-primary' : 'btn-quiet'}
              aria-pressed={p.id === withPlayer}
              onClick={() => {
                setWithPlayer(p.id);
                setReceiveStructures([]);
                setReceiveCash(0);
              }}
            >
              <span style={{ color: p.id === withPlayer ? '#fff' : p.color }}>{flagGlyph(p.flagShape)}</span> {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="trade-grid">
        <div className="trade-side">
          <h3 style={{ color: me.color }}>{flagGlyph(me.flagShape)} {me.name} offers</h3>
          <label htmlFor="give-cash">Cash (you have {money(me.cash)})</label>
          <input
            id="give-cash" type="number" min={0} max={me.cash} value={giveCash}
            onChange={(e) => setGiveCash(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <label>Establishments</label>
          {myStructures.length === 0 && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-soft)' }}>None to offer.</div>}
          {myStructures.map((s) => {
            const key = slotKey(s.zone, s.index);
            const def = defById(content, s.structure!.pieces[0]);
            return (
              <label className="trade-est" key={key}>
                <input
                  type="checkbox"
                  checked={giveStructures.includes(key)}
                  onChange={() => toggle(giveStructures, setGiveStructures, key)}
                />
                {establishmentEmoji(def.id)} {def.name}
                {s.structure!.pieces.length > 1 ? ` ×${s.structure!.pieces.length}` : ''} · {zoneName(content, s.zone)}
              </label>
            );
          })}
        </div>
        <div className="trade-side">
          <h3 style={{ color: other.color }}>{flagGlyph(other.flagShape)} {other.name} offers</h3>
          <label htmlFor="receive-cash">Cash (they have {money(other.cash)})</label>
          <input
            id="receive-cash" type="number" min={0} max={other.cash} value={receiveCash}
            onChange={(e) => setReceiveCash(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          />
          <label>Establishments</label>
          {theirStructures.length === 0 && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-soft)' }}>None to ask for.</div>}
          {theirStructures.map((s) => {
            const key = slotKey(s.zone, s.index);
            const def = defById(content, s.structure!.pieces[0]);
            return (
              <label className="trade-est" key={key}>
                <input
                  type="checkbox"
                  checked={receiveStructures.includes(key)}
                  onChange={() => toggle(receiveStructures, setReceiveStructures, key)}
                />
                {establishmentEmoji(def.id)} {def.name}
                {s.structure!.pieces.length > 1 ? ` ×${s.structure!.pieces.length}` : ''} · {zoneName(content, s.zone)}
              </label>
            );
          })}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          disabled={!somethingOffered || !affordable}
          onClick={() => setConfirming(true)}
        >
          Propose to {other.name} →
        </button>
      </div>
    </Modal>
  );
}

function zoneName(content: ContentPack, zoneId: string): string {
  return content.zones.find((z) => z.id === zoneId)?.shortName ?? zoneId;
}
