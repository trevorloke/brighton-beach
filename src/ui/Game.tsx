import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ContentPack, EstablishmentDef, GameAction, GameState, Slot, TradeSide,
} from '../engine/types';
import {
  assetValue, buildCost, computeIncome, defById, slotKey, structureBaseValue,
} from '../engine/selectors';
import { Board, establishmentEmoji, type BoardMode } from './Board';
import { Bunting, ConfirmModal, Modal, money } from './bits';
import { RulesModal } from './RulesModal';
import { TradeModal } from './TradeModal';
import { flagGlyph } from './Lobby';

interface Props {
  content: ContentPack;
  state: GameState;
  dispatch: (action: GameAction) => void;
  onExit: () => void;
  onPlayAgain: () => void;
  pushToast: (text: string, error?: boolean) => void;
}

/** Orchestrated interstitials between engine phases. */
type Stage =
  | { kind: 'none' }
  | { kind: 'event' } // reveal the round's card
  | { kind: 'handoff' } // pass-and-play screen change
  | { kind: 'income' } // income breakdown, then collect
  | { kind: 'dice-rolling' }
  | { kind: 'dice-result' };

export function Game({ content, state, dispatch, onExit, onPlayAgain, pushToast }: Props) {
  const me = state.players[state.currentPlayer];

  const [stage, setStage] = useState<Stage>({ kind: 'event' });
  const [showRules, setShowRules] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [placingDef, setPlacingDef] = useState<EstablishmentDef | null>(null);
  const [pendingBuild, setPendingBuild] = useState<{ def: EstablishmentDef; slot: Slot } | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [showTrade, setShowTrade] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string; body: string; label: string; danger?: boolean; action: GameAction;
  } | null>(null);

  // Track which round's event has been revealed, so the card shows exactly once.
  const shownEventRound = useRef(0);

  // When the engine hands play to a new player, run the interstitial chain.
  const prevTurnKey = useRef(`${state.round}:${state.currentPlayer}`);
  useEffect(() => {
    const key = `${state.round}:${state.currentPlayer}`;
    if (key !== prevTurnKey.current) {
      prevTurnKey.current = key;
      setPlacingDef(null);
      setInspecting(null);
      setShowCatalog(false);
      setShowTrade(false);
      if (state.phase !== 'game-over' && stage.kind !== 'dice-result') {
        // Dice-result stage advances the chain itself on Continue.
        setStage(state.round !== shownEventRound.current && state.lastEvent ? { kind: 'event' } : { kind: 'handoff' });
      }
    }
  }, [state.round, state.currentPlayer, state.phase, state.lastEvent, stage.kind]);

  const incomePreview = useMemo(
    () => (state.phase === 'income' ? computeIncome(content, state, me.id) : null),
    [content, state, me.id],
  );

  const validSlots = useMemo(() => {
    if (!placingDef) return new Set<string>();
    const set = new Set<string>();
    for (const slot of state.slots) {
      if (slot.structure) continue;
      const zone = content.zones.find((z) => z.id === slot.zone)!;
      if (zone.allows.includes(placingDef.kind) && placingDef.zones.includes(slot.zone)) {
        set.add(slotKey(slot.zone, slot.index));
      }
    }
    return set;
  }, [placingDef, state.slots, content.zones]);

  const boardMode: BoardMode = placingDef
    ? { kind: 'placing', validSlots }
    : { kind: 'inspect' };

  const onSlotClick = (slot: Slot) => {
    if (placingDef && !slot.structure) {
      setPendingBuild({ def: placingDef, slot });
      return;
    }
    if (slot.structure) {
      setInspecting(slotKey(slot.zone, slot.index));
    }
  };

  const inspectedSlot = inspecting
    ? state.slots.find((s) => slotKey(s.zone, s.index) === inspecting && s.structure) ?? null
    : null;

  const eventCard = state.lastEvent ? content.events.find((e) => e.id === state.lastEvent) : null;

  const dispatchAndToast = (action: GameAction) => {
    dispatch(action);
  };

  /* ------------------------- render ------------------------- */

  return (
    <div className="game">
      <header className="topbar">
        <Bunting width="full" />
        <div className="topbar-inner">
          <span className="game-name">Brighton Beach</span>
          <span className="turn-chip" aria-live="polite">
            Round {state.round} ·{' '}
            <span style={{ color: me.color === '#148BA6' ? '#7fdff0' : me.color }}>
              {flagGlyph(me.flagShape)} {me.name}
            </span>
          </span>
          <PhaseStepper phase={state.phase} />
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ color: 'var(--cream)', borderColor: 'var(--cream)' }} onClick={() => setShowRules(true)}>
              📖 Rules
            </button>
            <button className="btn-ghost" style={{ color: 'var(--cream)', borderColor: 'var(--cream)' }} onClick={onExit}>
              💾 Save & exit
            </button>
          </span>
        </div>
      </header>

      <main className="main-area">
        <div className="board-column">
          <Board
            content={content}
            state={state}
            mode={boardMode}
            selectedSlot={inspecting}
            onSlotClick={onSlotClick}
          />
          <ActionBar
            content={content}
            state={state}
            placingDef={placingDef}
            onOpenCatalog={() => setShowCatalog(true)}
            onCancelPlacing={() => setPlacingDef(null)}
            onTrade={() => setShowTrade(true)}
            onEndActions={() => dispatchAndToast({ type: 'END_ACTIONS' })}
            onRoll={() => setStage({ kind: 'dice-rolling' })}
            onCollect={() => setStage({ kind: 'income' })}
            onBankrupt={() =>
              setConfirm({
                title: 'Declare bankruptcy?',
                body: `${me.name} will be eliminated. Their establishments return to the bank and the season carries on without them. This cannot be undone.`,
                label: 'Go under',
                danger: true,
                action: { type: 'DECLARE_BANKRUPTCY' },
              })
            }
          />
        </div>

        <aside className="side-column">
          <PlayersPanel content={content} state={state} />
          <EffectsPanel state={state} />
          <LogPanel state={state} />
        </aside>
      </main>

      {/* ---------------- interstitials & modals ---------------- */}

      {stage.kind === 'event' && eventCard && state.phase !== 'game-over' && (
        <Modal onClose={undefined} title={undefined}>
          <div className={`event-card cat-${eventCard.category}`}>
            <div className="ec-band">{categoryLabel(eventCard.category)}</div>
            <div className="ec-icon" aria-hidden>{categoryIcon(eventCard.category)}</div>
            <div className="ec-body">
              <h2 style={{ margin: '0 0 8px' }}>{eventCard.name}</h2>
              <p style={{ margin: 0 }}>{eventCard.description}</p>
            </div>
          </div>
          <div className="modal-actions" style={{ justifyContent: 'center' }}>
            <button
              className="btn-primary btn-big"
              autoFocus
              onClick={() => {
                shownEventRound.current = state.round;
                setStage({ kind: 'handoff' });
              }}
            >
              So be it
            </button>
          </div>
        </Modal>
      )}

      {stage.kind === 'handoff' && state.phase !== 'game-over' && (
        <Modal>
          <div className="handoff">
            <div className="hand-emoji" aria-hidden>🫱</div>
            <h2>
              Pass the screen to{' '}
              <span style={{ color: me.color }}>{flagGlyph(me.flagShape)} {me.name}</span>
            </h2>
            <p style={{ color: 'var(--ink-soft)' }}>
              {characterLine(content, state)} · {money(me.cash)} in the till
            </p>
            <button
              className="btn-coral btn-big"
              autoFocus
              onClick={() => setStage(state.phase === 'income' ? { kind: 'income' } : { kind: 'none' })}
            >
              I'm {me.name} — start my turn
            </button>
          </div>
        </Modal>
      )}

      {stage.kind === 'income' && incomePreview && (
        <Modal title={`Income Phase — ${me.name}`} wide onClose={undefined}>
          <IncomeTable content={content} state={state} report={incomePreview} />
          <div className="modal-actions">
            <button
              className="btn-primary btn-big"
              autoFocus
              onClick={() => {
                dispatchAndToast({ type: 'COLLECT_INCOME' });
                setStage({ kind: 'none' });
              }}
            >
              {incomePreview.net >= 0
                ? `Collect ${money(incomePreview.net)}`
                : `Settle up ${money(incomePreview.net)}`}
            </button>
          </div>
        </Modal>
      )}

      {(stage.kind === 'dice-rolling' || stage.kind === 'dice-result') && state.phase !== 'game-over' && (
        <DiceStage
          content={content}
          state={state}
          rolling={stage.kind === 'dice-rolling'}
          onRolled={() => {
            dispatchAndToast({ type: 'ROLL_TOURISTS' });
            setStage({ kind: 'dice-result' });
          }}
          onDone={() => {
            if (state.phase === 'game-over') {
              setStage({ kind: 'none' });
              return;
            }
            setStage(
              state.round !== shownEventRound.current && state.lastEvent
                ? { kind: 'event' }
                : { kind: 'handoff' },
            );
          }}
        />
      )}

      {showCatalog && (
        <BuildCatalog
          content={content}
          state={state}
          onPick={(def) => {
            setShowCatalog(false);
            setPlacingDef(def);
            pushToast(`Choose a highlighted berth for the ${def.name}.`);
          }}
          onClose={() => setShowCatalog(false)}
        />
      )}

      {pendingBuild && (
        <ConfirmModal
          title={`Build ${pendingBuild.def.name}?`}
          body={
            `${establishmentEmoji(pendingBuild.def.id)} ${pendingBuild.def.name} on the ` +
            `${content.zones.find((z) => z.id === pendingBuild.slot.zone)!.name}, berth ${pendingBuild.slot.index + 1}, ` +
            `for ${money(buildCost(content, state, me.id, pendingBuild.def.id))}. Building is final.`
          }
          confirmLabel={`Build for ${money(buildCost(content, state, me.id, pendingBuild.def.id))}`}
          onConfirm={() => {
            dispatchAndToast({
              type: 'BUILD',
              defId: pendingBuild.def.id,
              zone: pendingBuild.slot.zone,
              slotIndex: pendingBuild.slot.index,
            });
            setPendingBuild(null);
            setPlacingDef(null);
          }}
          onCancel={() => setPendingBuild(null)}
        />
      )}

      {inspectedSlot && (
        <StructureModal
          content={content}
          state={state}
          slot={inspectedSlot}
          onAction={(action, title, body, label, danger) =>
            setConfirm({ title, body, label, danger, action })
          }
          onClose={() => setInspecting(null)}
        />
      )}

      {showTrade && (
        <TradeModal
          content={content}
          state={state}
          onSubmit={(withPlayer: number, give: TradeSide, receive: TradeSide) => {
            dispatchAndToast({ type: 'TRADE', withPlayer, give, receive });
            setShowTrade(false);
          }}
          onClose={() => setShowTrade(false)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={() => {
            dispatchAndToast(confirm.action);
            setConfirm(null);
            setInspecting(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {showRules && <RulesModal content={content} onClose={() => setShowRules(false)} />}

      {state.phase === 'game-over' && state.winnerId !== null && (
        <VictoryModal content={content} state={state} onPlayAgain={onPlayAgain} onExit={onExit} />
      )}
    </div>
  );
}

/* ================================================================== */

function PhaseStepper({ phase }: { phase: GameState['phase'] }) {
  const steps: { id: string; label: string; icon: string }[] = [
    { id: 'income', label: 'Income', icon: '💷' },
    { id: 'action', label: 'Action', icon: '🔨' },
    { id: 'tourist', label: 'Tourists', icon: '🎲' },
  ];
  return (
    <nav className="phase-stepper" aria-label="Turn phases">
      {phase === 'settle-debt' ? (
        <span className="phase-step debt">⚠️ Settle your debts</span>
      ) : (
        steps.map((s, i) => (
          <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span className="phase-arrow" aria-hidden>→</span>}
            <span className={`phase-step${phase === s.id ? ' active' : ''}`} aria-current={phase === s.id ? 'step' : undefined}>
              {s.icon} {s.label}
            </span>
          </span>
        ))
      )}
    </nav>
  );
}

function characterLine(content: ContentPack, state: GameState): string {
  const me = state.players[state.currentPlayer];
  const c = content.characters.find((c) => c.id === me.characterId)!;
  return `${c.emoji} ${c.title} — ${c.bonusText}`;
}

function ActionBar({
  content, state, placingDef, onOpenCatalog, onCancelPlacing, onTrade, onEndActions, onRoll, onCollect, onBankrupt,
}: {
  content: ContentPack;
  state: GameState;
  placingDef: EstablishmentDef | null;
  onOpenCatalog: () => void;
  onCancelPlacing: () => void;
  onTrade: () => void;
  onEndActions: () => void;
  onRoll: () => void;
  onCollect: () => void;
  onBankrupt: () => void;
}) {
  const me = state.players[state.currentPlayer];
  switch (state.phase) {
    case 'income':
      return (
        <div className="action-bar">
          <button className="btn-primary btn-big" onClick={onCollect}>
            💷 Review income
          </button>
          <span className="action-hint">Collect this round's takings, minus maintenance.</span>
        </div>
      );
    case 'action':
      if (placingDef) {
        return (
          <div className="action-bar">
            <strong>
              Placing {establishmentEmoji(placingDef.id)} {placingDef.name} — pick a glowing berth
            </strong>
            <button className="btn-ghost" onClick={onCancelPlacing}>Cancel placement</button>
          </div>
        );
      }
      return (
        <div className="action-bar">
          <button className="btn-primary" onClick={onOpenCatalog}>🔨 Build</button>
          <button className="btn-quiet" onClick={onTrade}>🤝 Trade</button>
          <button className="btn-coral" onClick={onEndActions}>Done — to the Tourist Phase 🎲</button>
          <span className="action-hint">
            Tap any establishment on the board to stack, sell, or mortgage it. {money(me.cash)} in the till.
          </span>
        </div>
      );
    case 'tourist':
      return (
        <div className="action-bar">
          <button className="btn-coral btn-big" onClick={onRoll}>🎲 Roll the tourist dice</button>
          <span className="action-hint">Set the crowds for the next player's takings.</span>
        </div>
      );
    case 'settle-debt':
      return (
        <div className="action-bar">
          <div className="debt-banner" role="alert">
            {me.name} is {money(state.debt)} short. Sell or mortgage establishments on the board to
            raise it — or fold.
          </div>
          <button className="btn-coral" onClick={onBankrupt}>💸 Declare bankruptcy</button>
          <span className="action-hint">
            Tap your establishments on the board: mortgage keeps them (at {Math.round(content.rules.mortgagePct * 100)}% value), selling lets go at {Math.round(content.rules.sellPct * 100)}%.
          </span>
        </div>
      );
    default:
      return null;
  }
}

function PlayersPanel({ content, state }: { content: ContentPack; state: GameState }) {
  return (
    <div className="panel">
      <h3>Entrepreneurs</h3>
      {state.players.map((p) => {
        const char = content.characters.find((c) => c.id === p.characterId)!;
        const holdings = state.slots.filter((s) => s.structure?.ownerId === p.id).length;
        return (
          <div
            key={p.id}
            className={`player-card${p.id === state.currentPlayer && !p.eliminated ? ' current' : ''}${p.eliminated ? ' eliminated' : ''}`}
          >
            <span className="swatch" style={{ background: p.color, width: 30, height: 30, fontSize: 12 }}>
              {flagGlyph(p.flagShape)}
            </span>
            <span>
              <div className="pc-name">{p.name}</div>
              <div className="pc-char">{char.emoji} {char.title}</div>
            </span>
            <span>
              <div className="pc-cash">{p.eliminated ? 'OUT' : money(p.cash)}</div>
              <div className="pc-assets">
                {p.eliminated
                  ? `r${p.eliminatedRound}`
                  : `${holdings} est · ${money(assetValue(content, state, p.id))} assets`}
              </div>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EffectsPanel({ state }: { state: GameState }) {
  if (state.activeEffects.length === 0) return null;
  return (
    <div className="panel">
      <h3>In effect</h3>
      <div className="effects-list">
        {state.activeEffects.map((e, i) => (
          <div key={i} className={`effect-chip${e.effect.type === 'disasterActive' ? ' disaster' : ''}`}>
            <span aria-hidden>{e.icon}</span>
            <span>{e.sourceName}</span>
            <span className="effect-rounds">
              {e.remainingRounds} round{e.remainingRounds > 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogPanel({ state }: { state: GameState }) {
  const entries = state.log.slice(-60).reverse();
  return (
    <div className="panel log-panel">
      <h3>Seafront gazette</h3>
      <div className="log-scroll">
        {entries.map((e, i) => (
          <div key={state.log.length - i} className="log-entry">
            <span className="lr">R{e.round}</span>
            {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomeTable({
  content, state, report,
}: {
  content: ContentPack;
  state: GameState;
  report: NonNullable<GameState['lastIncome']>;
}) {
  return (
    <>
      {report.lines.length === 0 && (
        <p>No establishments yet — the seafront awaits your first build.</p>
      )}
      {report.lines.length > 0 && (
        <table className="income-table">
          <thead>
            <tr>
              <th>Establishment</th>
              <th>Zone</th>
              <th className="num">Tourists</th>
              <th className="num">Takings</th>
              <th className="num">Upkeep</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((l) => (
              <tr key={l.slotKey}>
                <td>{establishmentEmoji(l.slotKey.includes(':') ? findDefId(state, l.slotKey) : '')} {l.name}</td>
                <td>{content.zones.find((z) => z.id === l.zone)?.shortName}</td>
                <td className="num">{l.tourists}</td>
                <td className="num" style={{ color: l.gross > 0 ? 'var(--good)' : undefined }}>
                  {l.gross > 0 ? `+${money(l.gross)}` : money(0)}
                </td>
                <td className="num" style={{ color: 'var(--bad)' }}>−{money(l.maintenance)}</td>
              </tr>
            ))}
            {report.characterBonus > 0 && (
              <tr>
                <td colSpan={3}>Character bonus</td>
                <td className="num" style={{ color: 'var(--good)' }}>+{money(report.characterBonus)}</td>
                <td />
              </tr>
            )}
            <tr className="income-total">
              <td colSpan={3}>Net this round</td>
              <td className="num" colSpan={2} style={{ color: report.net >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {report.net >= 0 ? '+' : ''}
                {money(report.net)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  );
}

function findDefId(state: GameState, key: string): string {
  const [zone, idx] = key.split(':');
  const slot = state.slots.find((s) => s.zone === zone && s.index === Number(idx));
  return slot?.structure?.pieces[0] ?? '';
}

function DiceStage({
  content, state, rolling, onRolled, onDone,
}: {
  content: ContentPack;
  state: GameState;
  rolling: boolean;
  onRolled: () => void;
  onDone: () => void;
}) {
  // A short tumble, then the engine rolls for real.
  const fired = useRef(false);
  useEffect(() => {
    if (!rolling || fired.current) return;
    fired.current = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(onRolled, reduced ? 50 : 900);
    return () => clearTimeout(t);
  }, [rolling, onRolled]);

  const dice = state.lastDice;
  const prefName =
    dice?.preference === 'spread'
      ? 'an even spread along the front'
      : content.zones.find((z) => z.id === dice?.preference)?.name ?? '';

  return (
    <Modal title="Tourist Phase">
      <div className="dice-stage">
        <div className="dice-row">
          <div className={`die${rolling ? ' rolling' : ''}`}>{rolling ? '?' : dice?.volume[0]}</div>
          <div className={`die${rolling ? ' rolling' : ''}`}>{rolling ? '?' : dice?.volume[1]}</div>
          <div className={`die pref${rolling ? ' rolling' : ''}`}>
            {rolling ? '?' : dice?.preference === 'spread' ? '〜 spread' : content.zones.find((z) => z.id === dice?.preference)?.shortName}
          </div>
        </div>
        <div className="dice-verdict" aria-live="polite">
          {rolling
            ? 'The tide turns…'
            : dice && (
                <>
                  {dice.tourists} tourists arrive{dice.surge ? ' — a surge!' : ''}, favouring {prefName}.
                  {dice.triggeredDisaster && (
                    <div style={{ color: 'var(--coral-deep)' }}>
                      Double ones! {content.disasters.find((d) => d.id === dice.triggeredDisaster)?.icon}{' '}
                      {content.disasters.find((d) => d.id === dice.triggeredDisaster)?.name} strikes the seafront!
                    </div>
                  )}
                </>
              )}
        </div>
        {!rolling && (
          <button className="btn-primary btn-big" autoFocus onClick={onDone}>
            The crowds pour in →
          </button>
        )}
      </div>
    </Modal>
  );
}

function BuildCatalog({
  content, state, onPick, onClose,
}: {
  content: ContentPack;
  state: GameState;
  onPick: (def: EstablishmentDef) => void;
  onClose: () => void;
}) {
  const me = state.players[state.currentPlayer];
  const freeSlotZones = new Set(state.slots.filter((s) => !s.structure).map((s) => s.zone));
  return (
    <Modal title="Build an establishment" wide onClose={onClose}>
      <div className="catalog">
        {content.establishments.map((def) => {
          const cost = buildCost(content, state, me.id, def.id);
          const anyRoom = def.zones.some((z) => freeSlotZones.has(z));
          const affordable = cost <= me.cash;
          return (
            <button
              key={def.id}
              className="catalog-item"
              disabled={!affordable || !anyRoom}
              onClick={() => onPick(def)}
              title={!anyRoom ? 'No free berths in its zones' : !affordable ? 'Not enough cash' : undefined}
            >
              <div className="ci-head">
                <span aria-hidden>{establishmentEmoji(def.id)}</span>
                {def.name}
                <span className="ci-cost">{money(cost)}</span>
              </div>
              <div className="ci-meta">
                <span className={`kind-tag kind-${def.kind}`}>{def.kind}</span>{' '}
                pull {def.attraction} · {`£${def.incomePerTourist}`}/tourist · upkeep {money(def.maintenance)}
                {def.maxLevels > 1 ? ` · stacks ×${def.maxLevels}` : ''}
              </div>
              <div className="ci-meta">
                {def.zones.map((z) => content.zones.find((zz) => zz.id === z)?.shortName).join(', ')}
              </div>
              <div className="ci-flavor">{def.flavor}</div>
            </button>
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Never mind</button>
      </div>
    </Modal>
  );
}

function StructureModal({
  content, state, slot, onAction, onClose,
}: {
  content: ContentPack;
  state: GameState;
  slot: Slot;
  onAction: (action: GameAction, title: string, body: string, label: string, danger?: boolean) => void;
  onClose: () => void;
}) {
  const structure = slot.structure!;
  const def = defById(content, structure.pieces[0]);
  const owner = state.players[structure.ownerId];
  const me = state.players[state.currentPlayer];
  const mine = owner.id === me.id;
  const zoneName = content.zones.find((z) => z.id === slot.zone)!.name;
  const canAct = state.phase === 'action' || state.phase === 'settle-debt';
  const inDebt = state.phase === 'settle-debt';
  const value = structureBaseValue(content, structure);
  const levels = structure.pieces.length;
  const stackCost = buildCost(content, state, me.id, def.id);
  const canStack =
    mine && !inDebt && def.kind === 'building' && levels < def.maxLevels && !structure.mortgaged;

  return (
    <Modal title={undefined} onClose={onClose}>
      <div className="structure-info">
        <div className="si-head">
          <span aria-hidden style={{ fontSize: '1.8rem' }}>{establishmentEmoji(def.id)}</span>
          {def.name}
          {levels > 1 ? ` ×${levels}` : ''}
          <span style={{ marginLeft: 'auto', color: owner.color, fontSize: 'var(--fs-md)' }}>
            {flagGlyph(owner.flagShape)} {owner.name}
          </span>
        </div>
        <div className="si-row"><span>Zone</span><span className="v">{zoneName}, berth {slot.index + 1}</span></div>
        <div className="si-row"><span>Invested</span><span className="v">{money(value)}</span></div>
        <div className="si-row"><span>Upkeep per round</span><span className="v">{money(structure.pieces.reduce((s, id) => s + defById(content, id).maintenance, 0))}</span></div>
        <div className="si-row"><span>Status</span><span className="v">{structure.mortgaged ? '🔒 Mortgaged (no income, no flag)' : 'Open for business'}</span></div>
        <p style={{ fontStyle: 'italic', color: 'var(--ink-soft)', margin: 0 }}>{def.flavor}</p>
      </div>
      {mine && canAct && (
        <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
          {canStack && (
            <button
              className="btn-primary"
              disabled={stackCost > me.cash}
              onClick={() =>
                onAction(
                  { type: 'STACK', defId: def.id, zone: slot.zone, slotIndex: slot.index },
                  `Add a storey to ${def.name}?`,
                  `Raise it to ${levels + 1} levels for ${money(stackCost)}. Taller structures attract far more tourists. Building is final.`,
                  `Stack for ${money(stackCost)}`,
                )
              }
            >
              🏗️ Stack (+{money(stackCost)})
            </button>
          )}
          {!structure.mortgaged && (
            <button
              className="btn-quiet"
              onClick={() =>
                onAction(
                  { type: 'MORTGAGE', zone: slot.zone, slotIndex: slot.index },
                  `Mortgage ${def.name}?`,
                  `The bank advances ${money(Math.floor(value * content.rules.mortgagePct))}. While mortgaged it earns nothing, attracts nobody, and costs half upkeep. Lifting the mortgage later costs ${money(Math.ceil(value * content.rules.unmortgagePct))}.`,
                  `Mortgage for ${money(Math.floor(value * content.rules.mortgagePct))}`,
                )
              }
            >
              🔒 Mortgage (+{money(Math.floor(value * content.rules.mortgagePct))})
            </button>
          )}
          {structure.mortgaged && !inDebt && (
            <button
              className="btn-quiet"
              disabled={Math.ceil(value * content.rules.unmortgagePct) > me.cash}
              onClick={() =>
                onAction(
                  { type: 'UNMORTGAGE', zone: slot.zone, slotIndex: slot.index },
                  `Lift the mortgage on ${def.name}?`,
                  `Pay ${money(Math.ceil(value * content.rules.unmortgagePct))} and it re-opens for business at once.`,
                  `Pay ${money(Math.ceil(value * content.rules.unmortgagePct))}`,
                )
              }
            >
              🔓 Unmortgage (−{money(Math.ceil(value * content.rules.unmortgagePct))})
            </button>
          )}
          {!structure.mortgaged && (
            <button
              className="btn-coral"
              onClick={() =>
                onAction(
                  { type: 'SELL', zone: slot.zone, slotIndex: slot.index },
                  `Sell ${def.name} to the bank?`,
                  `The bank pays ${money(Math.floor(value * content.rules.sellPct))} and the berth is cleared. Selling is final.`,
                  `Sell for ${money(Math.floor(value * content.rules.sellPct))}`,
                  true,
                )
              }
            >
              💰 Sell (+{money(Math.floor(value * content.rules.sellPct))})
            </button>
          )}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function VictoryModal({
  content, state, onPlayAgain, onExit,
}: {
  content: ContentPack;
  state: GameState;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const winner = state.players[state.winnerId!];
  const standings = [...state.players].sort((a, b) => {
    if (a.id === state.winnerId) return -1;
    if (b.id === state.winnerId) return 1;
    return (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0);
  });
  return (
    <Modal wide>
      <div className="victory-stage">
        <div className="trophy" aria-hidden>🏆</div>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>
          <span style={{ color: winner.color }}>{flagGlyph(winner.flagShape)} {winner.name}</span> rules the seafront!
        </h2>
        <p style={{ color: 'var(--ink-soft)' }}>
          The last solvent entrepreneur after {state.round} round{state.round > 1 ? 's' : ''} of tides, gulls and grand openings.
        </p>
        <Bunting width={360} />
        <table className="standings">
          <thead>
            <tr><th>Place</th><th>Entrepreneur</th><th>Character</th><th className="num">Final assets</th><th>Fate</th></tr>
          </thead>
          <tbody>
            {standings.map((p, i) => {
              const char = content.characters.find((c) => c.id === p.characterId)!;
              const assets = p.eliminated ? p.assetValueAtElimination ?? 0 : assetValue(content, state, p.id);
              return (
                <tr key={p.id}>
                  <td>{['🥇', '🥈', '🥉', '4th'][i]}</td>
                  <td style={{ fontWeight: 800, color: p.color }}>{flagGlyph(p.flagShape)} {p.name}</td>
                  <td>{char.emoji} {char.title}</td>
                  <td className="num">{money(assets)}</td>
                  <td>{p.eliminated ? `Bankrupt, round ${p.eliminatedRound}` : 'Solvent'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="modal-actions" style={{ justifyContent: 'center' }}>
          <button className="btn-coral btn-big" onClick={onPlayAgain}>🎡 Play again</button>
          <button className="btn-ghost" onClick={onExit}>Back to the title</button>
        </div>
      </div>
    </Modal>
  );
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'boom': return 'Tourist Boom';
    case 'shift': return 'The Winds Shift';
    case 'windfall': return 'Windfall';
    case 'levy': return 'The Bill Arrives';
    case 'disaster': return 'DISASTER';
    default: return 'Event';
  }
}
function categoryIcon(cat: string): string {
  switch (cat) {
    case 'boom': return '☀️';
    case 'shift': return '🎠';
    case 'windfall': return '💷';
    case 'levy': return '🧾';
    case 'disaster': return '🌩️';
    default: return '🃏';
  }
}
