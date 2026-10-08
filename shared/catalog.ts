import type { Candidate, CandidateEvidence, ContenderGroup } from "./types";

export const contenderGroups: Record<ContenderGroup, { label: string; short: string; explanation: string }> = {
  established: { label: "Established contenders", short: "Established", explanation: "Mature, distinct prize cases. Some have current public predictions; others have established contributions without a fresh annual forecast." },
  broad: { label: "Broad watchlist", short: "Watchlist", explanation: "Defensible broader picks, without treating an award or public visibility as proof of current favoritism." },
  future: { label: "Future contenders", short: "Future", explanation: "Longer-horizon picks. Recent medals and broad longlists are not the same as a 2026 forecast; there is no age eligibility rule." },
  outsider: { label: "Outsiders", short: "Outsider", explanation: "Documented scholarly contributions, but a less straightforward prize case or weaker recent Nobel-specific support." },
};
export const groupOrder = Object.keys(contenderGroups) as ContenderGroup[];
export const evidenceKinds: Record<CandidateEvidence["kind"], string> = {
  award: "Research award", forecast: "Public prediction", preview: "Public preview",
  market: "Market listing", longlist: "Future longlist", advocacy: "Published advocacy",
};
const normalized = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ø/g, "o").replace(/ı/g, "i").replace(/ł/g, "l");

export function catalogCandidates(
  candidates: Candidate[],
  { query = "", field = "All fields", group = "all", sort = "Featured", totals = {} }:
  { query?: string; field?: string; group?: ContenderGroup | "all"; sort?: string; totals?: Record<string, number> } = {},
) {
  const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
  return candidates.filter((c) => {
    const text = normalized([c.name, ...(c.aliases || []), c.institution, c.field, c.summary, ...(c.tags || [])].join(" "));
    return (field === "All fields" || c.field === field) &&
      (group === "all" || c.editorial.group === group) && terms.every((term) => text.includes(term));
  }).sort((a, b) => {
    const alphabetical = a.name.localeCompare(b.name);
    if (sort === "Name") return alphabetical;
    if (sort === "Crowd backing") return (totals[b.id] || 0) - (totals[a.id] || 0) || alphabetical;
    if (sort === "Citations") return (b.citations?.total ?? -1) - (a.citations?.total ?? -1) || alphabetical;
    return groupOrder.indexOf(a.editorial.group) - groupOrder.indexOf(b.editorial.group) ||
      (a.editorial.priority ?? 999) - (b.editorial.priority ?? 999) || alphabetical;
  });
}

// Prefer current public attention in the compact row; retain every evidence item in the profile.
export function leadEvidence(c: Candidate): CandidateEvidence {
  return c.editorial.evidence.find((e) => e.targetYear === 2026 && ["preview", "forecast"].includes(e.kind)) ||
    c.editorial.evidence.find((e) => e.kind === "award" && e.dateLabel === "2026") ||
    c.editorial.evidence.find((e) => e.kind === "forecast") || c.editorial.evidence[0];
}
