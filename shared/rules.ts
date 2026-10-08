import type { Allocation, Entry, Winner, Snapshot } from "./types";
export const CREDITS = 100;
export const MAX_PICKS = 10;
export class RuleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function validateAllocation(
  value: unknown,
  validIds: Set<string>,
): Allocation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RuleError("Choose candidates and allocate your 100 credits.");
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > MAX_PICKS)
    throw new RuleError("Choose between 1 and 10 economists.");
  for (const [id, n] of entries)
    if (
      !validIds.has(id) ||
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 100
    )
      throw new RuleError(
        "Every pick needs 1–100 whole credits and must be on the roster.",
      );
  if (entries.reduce((s, [, n]) => s + Number(n), 0) !== CREDITS)
    throw new RuleError("Your portfolio must total exactly 100 credits.");
  return Object.fromEntries(entries) as Allocation;
}
export function validateName(value: unknown): string {
  if (typeof value !== "string") throw new RuleError("Choose a display name.");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (
    name.length < 2 ||
    name.length > 36 ||
    /[\u0000-\u001f\u007f<>]/.test(name)
  )
    throw new RuleError(
      "Use a display name of 2–36 characters, without markup.",
    );
  return name;
}
export function aggregate(entries: Entry[]) {
  const totals: Allocation = {},
    supporters: Allocation = {};
  for (const e of entries)
    for (const [id, n] of Object.entries(e.allocation)) {
      totals[id] = (totals[id] || 0) + n;
      supporters[id] = (supporters[id] || 0) + 1;
    }
  return {
    totals,
    supporters,
    participants: entries.length,
    pool: entries.length * CREDITS,
  };
}
export function projectedPayout(
  snapshot: Pick<Snapshot, "totals" | "pool" | "participants">,
  old: Allocation | undefined,
  draft: Allocation,
  id: string,
  share = 1,
) {
  const own = draft[id] || 0;
  if (own <= 0) return 0;
  const total = (snapshot.totals[id] || 0) - (old?.[id] || 0) + own;
  const pool = snapshot.pool + (old ? 0 : CREDITS);
  return total > 0 ? (pool * share * own) / total : 0;
}
export function validateWinners(value: unknown): Winner[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3)
    throw new RuleError("Enter the one, two, or three official laureates.");
  if (value.some((w) => !w || typeof w !== "object" || Array.isArray(w)))
    throw new RuleError("Each laureate must be an object with an ID and prize share.");
  const winners = value as Winner[];
  if (new Set(winners.map((w) => w.candidateId)).size !== winners.length)
    throw new RuleError("Each laureate must appear once.");
  for (const w of winners)
    if (
      typeof w.candidateId !== "string" ||
      !w.candidateId ||
      typeof w.share !== "number" ||
      !Number.isFinite(w.share) ||
      w.share <= 0 ||
      w.share > 1
    )
      throw new RuleError(
        "Each official prize share must be greater than zero and at most one.",
      );
  if (Math.abs(winners.reduce((s, w) => s + w.share, 0) - 1) > 1e-9)
    throw new RuleError("Official prize shares must total one.");
  return winners;
}
export function canonicalWinners(value: unknown, names: Record<string, string>): Winner[] {
  return validateWinners(value).map((w) => {
    if (Object.hasOwn(names, w.candidateId))
      return { candidateId: w.candidateId, share: w.share, name: names[w.candidateId] };
    if (!w.candidateId.startsWith("outside-") || typeof w.name !== "string" ||
        w.name.trim().length < 2 || w.name.length > 100 || /[\u0000-\u001f\u007f<>]/.test(w.name))
      throw new RuleError("For a laureate outside the roster, enter their official name.");
    return { candidateId: w.candidateId, share: w.share, name: w.name.trim() };
  });
}
export function score(entries: Entry[], winners: Winner[]) {
  validateWinners(winners);
  const { totals, pool } = aggregate(entries);
  let unawarded = 0;
  for (const w of winners)
    if (!totals[w.candidateId]) unawarded += pool * w.share;
  const rows = entries
    .map((e) => ({
      id: e.id,
      displayName: e.displayName,
      allocation: e.allocation,
      points: winners.reduce(
        (s, w) =>
          s +
          (totals[w.candidateId]
            ? (pool * w.share * (e.allocation[w.candidateId] || 0)) /
              totals[w.candidateId]
            : 0),
        0,
      ),
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points || a.displayName.localeCompare(b.displayName),
    );
  rows.forEach(
    (r, i) =>
      (r.rank =
        i > 0 && Math.abs(rows[i - 1].points - r.points) < 1e-8
          ? rows[i - 1].rank
          : i + 1),
  );
  return { rows, pool, unawarded };
}
export function effectivePhase(
  manual: string,
  close: string,
  now: number,
  settled = false,
): Snapshot["phase"] {
  if (settled) return "settled";
  if (manual === "closed" || now >= Date.parse(close)) return "closed";
  if (manual === "open") return "open";
  if (manual === "paused") return "paused";
  return "setup";
}
