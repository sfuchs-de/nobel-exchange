import type { Candidate, Snapshot } from "./types";

/** Public aggregate rankings only: this never reads individual portfolios. */
export function crowdRanking<T extends Pick<Candidate, "id" | "name" | "field">>(
  candidates: T[],
  market: Pick<Snapshot, "totals" | "supporters" | "pool" | "history">,
) {
  const previous = market.history.length > 1 ? market.history.at(-2)! : null;
  const rows = candidates
    .map((candidate) => {
      const credits = market.totals[candidate.id] || 0;
      const share = market.pool ? (credits / market.pool) * 100 : 0;
      return {
        candidate,
        credits,
        share,
        backers: market.supporters[candidate.id] || 0,
        change: previous
          ? share - (previous.pool
              ? ((previous.totals[candidate.id] || 0) / previous.pool) * 100
              : 0)
          : null,
        rank: 0,
      };
    })
    .filter((row) => row.credits > 0)
    .sort((a, b) => b.credits - a.credits ||
      a.candidate.name.localeCompare(b.candidate.name) ||
      a.candidate.id.localeCompare(b.candidate.id));
  rows.forEach((row, i) => {
    row.rank = i && rows[i - 1].credits === row.credits
      ? rows[i - 1].rank
      : i + 1;
  });
  return rows;
}
