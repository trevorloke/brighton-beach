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
      body: 'North Promenade, South Promenade, the Pier, Main Beach, and the Water — 40 berths in all. Buildings need firm ground (promenades and pier); kiosks go almost anywhere; monuments are welcome most places. Tourists spread across zones in proportion to how attractive each zone is — and the preference die can make one zone the place to be, boosting its pull by ×' + r.preferenceMult + '. Tap a zone\'s 👥 chip on the board to see its maths.',
    },
    {
      title: 'Berth traits',
      body: 'Every berth is its own little plot with printed traits, shown as round badges on the board: ' +
        content.traits.map((t) => `${t.icon} ${t.name} — ${t.blurb}`).join(' ') +
        ' Traits apply to whatever is built there, by anyone. Tap any empty berth to read its ground.',
    },
    {
      title: 'The seasons',
      body: 'The season wheel turns every round: ' +
        r.seasons.map((s) => `${s.icon} ${s.name} (tide ×${s.touristMult})`).join(' → ') +
        '. High Summer floods the front with visitors; Winter thins them badly. Watch the season chip in the top bar — it also shows what arrives next round, so you can build ahead of the boom and bank ahead of the freeze.',
    },
    {
      title: 'Rising rents',
      body: `As the resort grows, so do the ground rents: every ${r.rentEscalationEvery} rounds, all upkeep is multiplied by ×${r.rentEscalationMult} (compounding, to a ceiling of ×${r.rentEscalationCap}). The seafront gets richer — and crueller. Over-extended empires that looked unsinkable in round 4 drown in round 14, while a lean, efficient portfolio can still out-earn the rent. This is the clock that ends the game.`,
    },
    {
      title: 'Establishments',
      body: 'Kiosks are cheap, earn a little, and pull tourists toward a zone. Buildings are the backbone: bigger income, and they can be stacked into multi-level structures (up to their max height — some ground won\'t bear it) that attract far more visitors. Monuments are expensive showpieces with a huge attraction boost. Ownership shows as your coloured, shaped flag.',
    },
    {
      title: 'Clusters',
      body: `Adjacent occupied berths in the same zone form a cluster, and tourists love a bustling stretch: every establishment in a cluster of size n multiplies its attraction by ${r.clusterBase}^(n−1), capped at ×${r.clusterCap}. Clusters are strung with bunting on the board. A mortgaged structure drops out of its cluster.`,
    },
    {
      title: 'Income maths',
      body: 'Tourists in a zone split across its establishments in proportion to attraction. Each establishment earns its income-per-tourist rate times the tourists it captured, times its berth traits and any event effects — the Income Phase table spells out the big multipliers (clusters, storeys, traits, events, disasters) as chips. Maintenance is then charged on everything you own, rising with the rent escalator. That upkeep is the tide that sinks the over-extended.',
    },
    {
      title: 'The tourist dice',
      body: `Two volume dice set the crowd: ${r.touristBase} + (d6 + d6) × ${r.touristsPerPip} tourists, all scaled by the season. A third die picks the preferred zone — or an even spread. Double sixes bring a surge of +${r.surgeBonus} (scaled by the season like the rest of the tide). Double ones stir up a disaster. Events can add or subtract visitors on top.`,
    },
    {
      title: 'Events and disasters',
      body: 'An event card turns at the start of each round: booms, zone crazes, windfalls, levies, market swings — and sometimes a disaster. ' +
        content.disasters.map((d) => `${d.icon} ${d.name}: ${d.description} (${d.duration} round${d.duration > 1 ? 's' : ''}; resisted by ${d.resistedBy})`).join(' '),
    },
    {
      title: 'The market moves',
      body: 'Economy cards swing the whole seafront: a Planning Grant makes every build cheaper for the round, a Materials Shortage makes them dearer, and a Maintenance Holiday waives every upkeep bill. Time your building sprees to the market.',
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
        .map((e) => `${e.name} (${e.kind}, ${money(e.cost)}; upkeep ${money(e.maintenance)}/round${e.maxLevels > 1 ? `; stacks to ${e.maxLevels}` : ''}${e.tags.length ? `; ${e.tags.join(', ')}` : ''})`)
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
        placeholder="Search the rules… (clusters, seasons, rents, fog)"
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
