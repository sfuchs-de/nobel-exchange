import type { Candidate, Snapshot } from "./types";
import { CREDITS, projectedPayout } from "./rules";

type PublicMarket = Pick<Snapshot, "totals" | "pool" | "participants">;
type Identity = Pick<Candidate, "id" | "name" | "field">;

/** Descriptive summaries of saved public aggregates, never private portfolios. */
export function marketInsights<T extends Identity>(candidates: T[], market: PublicMarket) {
  const ranked = candidates.map((candidate) => ({
    candidate, credits: market.totals[candidate.id] || 0,
    share: market.pool ? (market.totals[candidate.id] || 0) / market.pool : 0,
  })).filter((row) => row.credits > 0).sort((a, b) => b.credits - a.credits || a.candidate.name.localeCompare(b.candidate.name));
  let cumulative = 0;
  const concentration = [{ rank: 0, share: 0 }, ...ranked.map((row, i) => {
    cumulative += row.share;
    return { rank: i + 1, share: cumulative };
  })];
  const squaredShares = ranked.reduce((sum, row) => sum + row.share ** 2, 0);
  const bands = [
    { label: "No backing", count: 0 },
    { label: "Above 0–1%", count: 0 },
    { label: "Above 1–5%", count: 0 },
    { label: "Above 5–20%", count: 0 },
    { label: "Above 20%", count: 0 },
  ];
  const fields = new Map<string, { field: string; candidates: number; credits: number; share: number }>();
  for (const candidate of candidates) {
    const credits = market.totals[candidate.id] || 0;
    const share = market.pool ? credits / market.pool : 0;
    const band = !credits ? 0 : share <= .01 ? 1 : share <= .05 ? 2 : share <= .2 ? 3 : 4;
    bands[band].count++;
    const row = fields.get(candidate.field) || { field: candidate.field, candidates: 0, credits: 0, share: 0 };
    row.candidates++; row.credits += credits;
    row.share = market.pool ? row.credits / market.pool : 0;
    fields.set(candidate.field, row);
  }
  return {
    ranked, concentration, bands,
    fields: [...fields.values()].sort((a, b) => b.credits - a.credits || b.candidates - a.candidates || a.field.localeCompare(b.field)),
    backed: ranked.length, unbacked: candidates.length - ranked.length,
    topShare: ranked[0]?.share || 0,
    topFiveShare: ranked.slice(0, 5).reduce((sum, row) => sum + row.share, 0),
    effectiveContenders: squaredShares ? 1 / squaredShares : null,
  };
}

/** One extra 100-credit participant; unused credits go to other candidates. */
export function newcomerScenario(market: PublicMarket, candidateId: string, credits: number, prizeShare = 1) {
  if (!Number.isInteger(credits) || credits < 1 || credits > CREDITS)
    throw new RangeError("Use 1–100 whole credits in the scenario.");
  if (!Number.isFinite(prizeShare) || prizeShare <= 0 || prizeShare > 1)
    throw new RangeError("Use a prize fraction above zero and at most one.");
  const points = projectedPayout(market, undefined, { [candidateId]: credits }, candidateId, prizeShare);
  return { points, pointsPerCredit: points / credits, pool: market.pool + CREDITS };
}
