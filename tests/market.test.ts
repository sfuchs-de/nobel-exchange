import { describe, expect, it } from "vitest";
import { crowdRanking } from "../shared/market";

const candidates = [
  { id: "a", name: "Ada", field: "Theory" },
  { id: "b", name: "Bea", field: "Trade" },
  { id: "c", name: "Cal", field: "Theory" },
];
const market = (totals: Record<string, number>, pool = 200) => ({
  totals, pool, supporters: { a: 2, b: 1, c: 1 }, history: [],
});

describe("public crowd ranking", () => {
  it("ranks saved credits, reports backers and excludes unbacked candidates", () => {
    const rows = crowdRanking(candidates, market({ a: 150, b: 50 }));
    expect(rows.map(({ candidate, rank, share, backers }) =>
      [candidate.id, rank, share, backers])).toEqual([
      ["a", 1, 75, 2], ["b", 2, 25, 1],
    ]);
    expect(rows.every((row) => row.change === null)).toBe(true);
  });
  it("uses shared ranks for ties with deterministic alphabetical order", () => {
    const rows = crowdRanking([...candidates].reverse(), market({ a: 80, b: 80, c: 40 }));
    expect(rows.map(({ candidate, rank }) => [candidate.id, rank])).toEqual([
      ["a", 1], ["b", 1], ["c", 3],
    ]);
  });
  it("returns an empty table when nobody has submitted", () => {
    expect(crowdRanking(candidates, market({}, 0))).toEqual([]);
  });
  it("does not invent a change from a single snapshot", () => {
    const rows = crowdRanking(candidates, {
      ...market({ a: 200 }),
      history: [{ at: "2026-10-08T12:00:00Z", pool: 200, totals: { a: 200 } }],
    });
    expect(rows[0].change).toBeNull();
  });
  it("measures share changes against the previous update, allowing a changing pool", () => {
    const rows = crowdRanking(candidates, {
      ...market({ a: 150, b: 50 }),
      history: [
        { at: "2026-10-08T11:00:00Z", pool: 100, totals: { a: 100 } },
        { at: "2026-10-08T12:00:00Z", pool: 200, totals: { a: 150, b: 50 } },
      ],
    });
    expect(rows.map((row) => row.change)).toEqual([-25, 25]);
  });
  it("handles a preceding empty pool without dividing by zero", () => {
    const rows = crowdRanking(candidates, {
      ...market({ a: 100 }, 100),
      history: [
        { at: "2026-10-08T11:00:00Z", pool: 0, totals: {} },
        { at: "2026-10-08T12:00:00Z", pool: 100, totals: { a: 100 } },
      ],
    });
    expect(rows[0].change).toBe(100);
  });
});
