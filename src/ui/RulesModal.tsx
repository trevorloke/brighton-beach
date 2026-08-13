import { useMemo, useState } from 'react';
import type { ContentPack } from '../engine/types';
import { Modal, money } from './bits';

interface Section {
  title: string;
  body: string;
}

function buildSections(content: ContentPack): Section[] {
  const r = content.rules;
  return [
    {
      title: 'The goal',
      body: 'Brighton Beach is last-entrepreneur-standing. Build seaside attractions, collect income from tourists, and stay solvent. When you cannot cover your obligations even after selling and mortgaging everything, you are bankrupt and out. The final solvent player wins. If everyone goes under at once, the highest asset value before the fatal obligation wins.',
    },
    {
      title: 'Your turn: three phases',
      body: 'Income Phase — collect revenue from your establishments based on where the tourists currently are, minus maintenance on everything you own. Action Phase — build, stack, sell, mortgage, and trade as much as you can afford. Tourist Phase — roll the tourist dice to set how many tourists arrive and which zone they prefer; then play passes clockwise. An event card is drawn at the start of every round.',
    },
    {
      title: 'The five zones',
      body: 'North Promenade, South Promenade, the Pier, Main Beach, and the Water. Buildings need firm ground (promenades and pier); kiosks go almost anywhere; monuments are welcome most places. Tourists spread across zones in proportion to how attractive each zone is — and the preference die can make one zone the place to be, boosting its pull by ×' + r.preferenceMult + '.',
    },
    {
      title: 'Establishments',
      body: 'Kiosks are cheap, earn a little, and pull tourists toward a zone. Buildings are the backbone: bigger income, and they can be stacked into multi-level structures (up to their max height) that attract far more visitors. Monuments are expensive showpieces with a huge attraction boost. Ownership shows as your coloured, shaped flag.',
    },
    {
      title: 'Clusters',
      body: `Adjacent occupied berths in the same zone form a cluster, and tourists love a bustling stretch: every establishment in a cluster of size n multiplies its attraction by ${r.clusterBase}^(n−1), capped at ×${r.clusterCap}. Clusters are strung with bunting on the board. A mortgaged structure drops out of its cluster.`,
    },
    {
      title: 'Income maths',
      body: 'Tourists in a zone split across its establishments in proportion to attraction. Each establishment earns its income-per-tourist rate times the tourists it captured. Maintenance is then charged on everything you own — kiosks, buildings (per level), monuments — whether or not they earned. That upkeep is the tide that sinks the over-extended.',
    },
    {
      title: 'The tourist dice',
      body: `Two volume dice set the crowd: (d6 + d6) × ${r.touristsPerPip} tourists. A third die picks the preferred zone — or an even spread. Double sixes bring a surge of +20. Double ones stir up a disaster. Events can add or subtract visitors on top.`,
    },
    {
      title: 'Events and disasters',
      body: 'An event card turns at the start of each round: booms, zone crazes, windfalls, levies — and sometimes a disaster. Storms close the pier and water (2 rounds). Pollution fouls the beach and water (2 rounds). Seagulls savage kiosk trade for a round. Some establishments resist: sturdy ones stand through storms, clean-certified ones shrug off pollution, netted stalls ignore the gulls.',
    },
    {
      title: 'Trading',
      body: 'In your Action Phase you can strike a deal with any player: cash and establishments on either side, both parties confirm, all in the open. A well-timed purchase can complete a cluster — yours, or the one you are selling into.',
    },
    {
      title: 'Money trouble',
      body: `Can't cover an obligation? You must raise the cash: mortgage structures (${Math.round(r.mortgagePct * 100)}% of value now, ${Math.round(r.unmortgagePct * 100)}% to lift later; mortgaged structures earn nothing and lose their flag) or sell to the bank (${Math.round(r.sellPct * 100)}% of invested cost). If even total liquidation cannot cover the debt, you are bankrupt: your structures leave the board and you are out.`,
    },
    {
      title: 'Characters',
      body: content.characters.map((c) => `${c.emoji} ${c.name}, ${c.title} — ${c.bonusText}`).join(' '),
    },
    {
      title: 'Establishment catalogue',
      body: content.establishments
        .map((e) => `${e.name} (${e.kind}, ${money(e.cost)}; upkeep ${money(e.maintenance)}/round${e.maxLevels > 1 ? `; stacks to ${e.maxLevels}` : ''})`)
        .join(' · '),
    },
  ];
}

export function RulesModal({ content, onClose }: { content: ContentPack; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const sections = useMemo(() => buildSections(content), [content]);
  const q = query.trim().toLowerCase();
  const visible = q
    ? sections.filter((s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
    : sections;
  return (
    <Modal title="How to play Brighton Beach" wide onClose={onClose}>
      <input
        className="rules-search"
        type="search"
        placeholder="Search the rules… (clusters, mortgage, storm)"
        aria-label="Search the rules"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {visible.length === 0 && <p>Nothing in the rulebook matches “{query}”.</p>}
      {visible.map((s) => (
        <section className="rules-section" key={s.title}>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </section>
      ))}
      <div className="modal-actions">
        <button className="btn-primary" onClick={onClose}>
          Back to the seafront
        </button>
      </div>
    </Modal>
  );
}
