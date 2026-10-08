import { useMemo, useState } from "react";
import type { Candidate, Snapshot } from "../shared/types";
import { marketInsights, newcomerScenario } from "../shared/insights";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const points = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const axisPoints = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const headlinePoints = (n: number) => n >= 10000 ? axisPoints.format(n) : points.format(n);
const left = 44, right = 340, top = 18, bottom = 143;

export function MarketPulse({ candidates, market, colors, onField, onPortfolio }: {
  candidates: Candidate[]; market: Snapshot; colors: Record<string, string>;
  onField: (field: string) => void; onPortfolio: () => void;
}) {
  const data = useMemo(() => marketInsights(candidates, market), [candidates, market.totals, market.pool]);
  const [selectedId, setSelectedId] = useState("");
  const [credits, setCredits] = useState(10);
  const [prizeShare, setPrizeShare] = useState(1);
  const [allFields, setAllFields] = useState(false);
  const selected = candidates.find((c) => c.id === selectedId) || data.ranked[0]?.candidate || candidates[0];
  const quote = newcomerScenario(market, selected.id, credits, prizeShare);
  const curve = Array.from({ length: 100 }, (_, i) => newcomerScenario(market, selected.id, i + 1, prizeShare).points);
  const ceiling = Math.max(25, Math.ceil(curve.at(-1)! / 25) * 25);
  const cx = (x: number) => left + (x - 1) / 99 * (right - left);
  const cy = (n: number) => bottom - n / ceiling * (bottom - top);
  const concentrationPath = data.concentration.map((row, i) => `${i ? "L" : "M"}${left + row.rank / (data.backed || 1) * (right - left)},${bottom - row.share * (bottom - top)}`).join(" ");
  const maxBand = Math.max(1, ...data.bands.map((b) => b.count));
  return (
    <section className="market-pulse" aria-labelledby="pulse-title">
      <div className="pulse-heading">
        <div><span className="eyebrow">A CROWD, NOT AN ORACLE</span><h2 id="pulse-title">Market pulse</h2></div>
        <p>Saved credits only · live updates · no implied winning probabilities</p>
      </div>
      {market.participants < 5 && <p className="pulse-sample-note">{market.participants ? `Just ${market.participants} ${market.participants === 1 ? "player" : "players"} so far—these patterns can change quickly.` : "No saved portfolios yet. The charts will fill in as people join."}</p>}
      <div className="pulse-grid">
        <section className="pulse-card" aria-labelledby="concentration-title">
          <span className="pulse-kicker">01 · FAVORITES & THE LONG TAIL</span>
          <h3 id="concentration-title">How crowded is the favorite?</h3>
          {data.backed ? <>
            <p className="pulse-standout"><strong>{pct(data.topShare)}</strong> backs {data.ranked[0].candidate.name}.</p>
            <svg className="pulse-plot" viewBox="0 0 360 178" role="img" aria-label={`Cumulative backing: the top candidate has ${pct(data.topShare)}; all ${data.backed} backed candidates have ${pct(data.concentration.at(-1)!.share)}.`}>
              {[0, .5, 1].map((n) => <g key={n}><line className="pulse-gridline" x1={left} x2={right} y1={bottom - n * (bottom - top)} y2={bottom - n * (bottom - top)} /><text x={left - 7} y={bottom - n * (bottom - top) + 4} textAnchor="end">{n * 100}%</text></g>)}
              <line className="pulse-reference" x1={left} x2={right} y1={bottom} y2={top} />
              <path className="pulse-line" d={concentrationPath} />
              {data.concentration.slice(1).map((row) => <circle key={row.rank} cx={left + row.rank / data.backed * (right - left)} cy={bottom - row.share * (bottom - top)} r={data.backed > 25 ? 1.5 : 3} className="pulse-dot" />)}
              <text x={left} y="163">0</text><text x={right} y="163" textAnchor="end">Top {data.backed}</text>
              <text x="187" y="175" textAnchor="middle">Backed economists, ranked by credits</text>
            </svg>
            <p className="pulse-note">Solid line: cumulative credits. Dashed line: equal backing among these picks. More bowed means more concentrated.</p>
            <div className="pulse-facts"><span><strong>{data.effectiveContenders!.toFixed(1)}</strong> equally backed picks</span><span><strong>{data.unbacked}</strong> with no backing</span></div>
            <details className="pulse-details"><summary>Numbers & method</summary><p>The effective count is 1 divided by the sum of squared credit shares. It describes concentration—not the number of likely winners.</p><div className="table-scroll"><table><thead><tr><th>Top picks</th><th>Cumulative backing</th></tr></thead><tbody>{data.concentration.slice(1).map((row) => <tr key={row.rank}><td>{row.rank}</td><td>{pct(row.share)}</td></tr>)}</tbody></table></div></details>
          </> : <p className="pulse-empty">The first saved portfolio starts this picture. No backing is not the same as equal backing.</p>}
        </section>

        <section className="pulse-card" aria-labelledby="distribution-title">
          <span className="pulse-kicker">02 · EVERY PICK COUNTS</span>
          <h3 id="distribution-title">A busy few, a quiet many?</h3>
          <p>Where all {candidates.length} economists sit in the backing distribution.</p>
          <div className="pulse-bands" role="list" aria-label="Number of economists by backing-share band">
            {data.bands.map((band) => <div role="listitem" className="pulse-band" key={band.label}><span>{band.label}</span><span className="pulse-bar-track" aria-hidden="true"><i style={{ width: `${band.count / maxBand * 100}%` }} /></span><strong>{band.count}</strong></div>)}
          </div>
          <div className="pulse-axis-note">Share of saved credits <span>Number of economists →</span></div>
          <p className="pulse-note">Each economist appears once. Zero backing is separate; these are labelled bands, not a probability density.</p>
          <p className="pulse-bottomline"><strong>{data.backed} of {candidates.length}</strong> have at least one saved credit.</p>
        </section>

        <section className="pulse-card" aria-labelledby="fields-title">
          <span className="pulse-kicker">03 · FOLLOW THE IDEAS</span>
          <h3 id="fields-title">Which fields own the conversation?</h3>
          <p>Share of saved credits by editorial research field.</p>
          <div className="pulse-fields">
            {(allFields ? data.fields : data.fields.slice(0, 6)).map((row) => <button key={row.field} className="pulse-field" onClick={() => onField(row.field)} aria-label={`Browse ${row.field}: ${pct(row.share)} of saved credits; ${row.candidates} candidates`}><span><i style={{ background: colors[row.field] }} />{row.field}<small>{row.candidates} candidates</small></span><span className="pulse-bar-track" aria-hidden="true"><i style={{ width: `${row.share * 100}%`, background: colors[row.field] }} /></span><strong>{pct(row.share)}</strong></button>)}
          </div>
          {data.fields.length > 6 && <button className="text-button pulse-expand" onClick={() => setAllFields(!allFields)}>{allFields ? "Show top six fields" : `Show all ${data.fields.length} fields`}</button>}
          <p className="pulse-note">Bars share a 0–100% scale. Candidate counts are context, not bar lengths. Tap a field to explore its economists.</p>
        </section>

        <section className="pulse-card payout-card" aria-labelledby="payout-title">
          <span className="pulse-kicker">04 · THE UNDERDOG DIVIDEND</span>
          <h3 id="payout-title">If your pick wins…</h3>
          <p>A new-player scenario—not odds, expected profit, or a saved entry.</p>
          <label className="pulse-label" htmlFor="pulse-candidate">Economist</label>
          <select id="pulse-candidate" value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>{[...candidates].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="pulse-scenario-controls"><label className="pulse-label" htmlFor="pulse-share">Their Nobel share<select id="pulse-share" value={prizeShare} onChange={(e) => setPrizeShare(Number(e.target.value))}><option value={1}>Sole winner</option><option value={.5}>Half the prize</option><option value={1 / 3}>One third</option></select></label><div><label className="pulse-label" htmlFor="pulse-credits">Your allocation <strong>{credits} credits</strong></label><input id="pulse-credits" aria-label="Hypothetical credits" type="range" min="1" max="100" step="1" value={credits} onChange={(e) => setCredits(Number(e.target.value))} /></div></div>
          <div className="payout-quote" aria-live="polite"><div><strong>{headlinePoints(quote.points)} <small>pts</small></strong><span>if this economist wins</span></div><div><strong>{quote.pointsPerCredit >= 10000 ? headlinePoints(quote.pointsPerCredit) : quote.pointsPerCredit.toFixed(2)}<small> pts/credit</small></strong><span>conditional payout</span></div></div>
          <svg className="pulse-plot payout-plot" viewBox="0 0 360 178" role="img" aria-label={`Conditional points as you allocate 1–100 credits to ${selected.name}. ${credits} credits would pay ${points.format(quote.points)} points.`}>
            {[0, .5, 1].map((n) => <g key={n}><line className="pulse-gridline" x1={left} x2={right} y1={cy(n * ceiling)} y2={cy(n * ceiling)} /><text x={left - 7} y={cy(n * ceiling) + 4} textAnchor="end">{axisPoints.format(n * ceiling)}</text></g>)}
            <path className="pulse-line" d={curve.map((n, i) => `${i ? "L" : "M"}${cx(i + 1)},${cy(n)}`).join(" ")} />
            <line className="pulse-reference" x1={cx(credits)} x2={cx(credits)} y1={bottom} y2={cy(quote.points)} />
            <circle className="pulse-dot" cx={cx(credits)} cy={cy(quote.points)} r="4" />
            <text x={left} y="163">1 credit</text><text x={right} y="163" textAnchor="end">100 credits</text><text x="187" y="175" textAnchor="middle">Your allocation → conditional points</text>
          </svg>
          <p className="pulse-note">Assumes one extra player adds 100 credits; {100 - credits ? `${100 - credits} go elsewhere` : "all go to this pick"}. Includes your own dilution. Other portfolios stay fixed. Points are zero if this pick does not win.</p>
          <details className="pulse-details"><summary>Scenario table & formula</summary><p>Points = ({market.pool} + 100) × Nobel share × your credits ÷ (current backing + your credits). All scenarios are mutually exclusive.</p><table><thead><tr><th>Credits on pick</th><th>If they win</th><th>Pts/credit</th></tr></thead><tbody>{[1, 5, 10, 25, 50, 100].map((n) => { const q = newcomerScenario(market, selected.id, n, prizeShare); return <tr key={n}><td>{n}</td><td>{points.format(q.points)}</td><td>{q.pointsPerCredit.toFixed(2)}</td></tr>; })}</tbody></table></details>
          <button className="text-button pulse-expand" onClick={onPortfolio}>Your actual draft →</button>
        </section>
      </div>
    </section>
  );
}
