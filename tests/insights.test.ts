import { describe, expect, it } from "vitest";
import { marketInsights, newcomerScenario } from "../shared/insights";
import { aggregate, score } from "../shared/rules";
const candidates = [
  { id: "a", name: "Ada", field: "Theory" },
  { id: "b", name: "Bea", field: "Trade" },
  { id: "c", name: "Cal", field: "Theory" },
];
const market = (totals: Record<string, number>, pool = 200) => ({ totals, pool, participants: pool / 100 });

describe("market pulse", () => {
  it("keeps an empty market distinct from a concentrated one", () => {
    const m = marketInsights(candidates, market({}, 0));
    expect(m.effectiveContenders).toBeNull();
    expect(m.backed).toBe(0); expect(m.unbacked).toBe(3);
    expect(m.bands.map((b) => b.count)).toEqual([3, 0, 0, 0, 0]);
    expect(m.fields.every((f) => f.share === 0)).toBe(true);
  });
  it("measures concentration and equivalent equally backed candidates", () => {
    const m = marketInsights(candidates, market({ a: 150, b: 50 }));
    expect(m.effectiveContenders).toBe(1.6);
    expect(m.concentration).toEqual([{ rank: 0, share: 0 }, { rank: 1, share: .75 }, { rank: 2, share: 1 }]);
    expect(m.topShare).toBe(.75); expect(m.topFiveShare).toBe(1);
  });
  it("recognizes monopoly and uniform backing without treating them as probabilities", () => {
    expect(marketInsights(candidates, market({ a: 200 })).effectiveContenders).toBe(1);
    const m = marketInsights(candidates, market({ a: 100, b: 100, c: 100 }, 300));
    expect(m.effectiveContenders).toBeCloseTo(3);
    expect(m.concentration.at(-1)!.share).toBeCloseTo(1);
  });
  it("assigns exact share-band boundaries once, keeping zero separate", () => {
    const cs = Array.from({ length: 7 }, (_, i) => ({ id: String(i), name: String(i), field: "Theory" }));
    const m = marketInsights(cs, market({ "1": 1, "2": 10, "3": 11, "4": 50, "5": 200, "6": 728 }, 1000));
    expect(m.bands.map((b) => b.count)).toEqual([1, 2, 2, 1, 1]);
    expect(m.bands.reduce((s, b) => s + b.count, 0)).toBe(cs.length);
  });
  it("uses saved credits, not candidate counts, for field bar lengths", () => {
    const m = marketInsights(candidates, market({ a: 10, b: 180, c: 10 }));
    expect(m.fields).toEqual([
      { field: "Trade", candidates: 1, credits: 180, share: .9 },
      { field: "Theory", candidates: 2, credits: 20, share: .1 },
    ]);
  });
  it("does not mutate aggregates or expose individual portfolios", () => {
    const m = market({ a: 150, b: 50 }); const before = JSON.stringify(m);
    const result = marketInsights(candidates, m);
    expect(JSON.stringify(m)).toBe(before);
    expect(Object.hasOwn(result, "entries")).toBe(false);
  });
  it("adds a whole new player's pool and its own dilution, including an unbacked pick", () => {
    expect(newcomerScenario(market({ a: 150 }), "a", 10)).toEqual({ points: 18.75, pointsPerCredit: 1.875, pool: 300 });
    expect(newcomerScenario(market({ a: 200 }), "b", 10).points).toBe(300);
    expect(newcomerScenario(market({}, 0), "a", 10).points).toBe(100);
  });
  it("agrees with official-share settlement on a valid hypothetical 100-credit portfolio", () => {
    const entries = [{ id: "old", displayName: "Old", allocation: { a: 100 }, version: 1, updatedAt: "" }];
    const scenario = newcomerScenario(aggregate(entries), "a", 25, .5);
    const hypothetical = { id: "new", displayName: "New", allocation: { a: 25, b: 75 }, version: 1, updatedAt: "" };
    const final = score([...entries, hypothetical], [{ candidateId: "a", share: .5 }, { candidateId: "c", share: .5 }]);
    expect(scenario.points).toBe(final.rows.find((r) => r.id === "new")!.points);
  });
  it("increases total conditional points with allocation but reduces points per credit", () => {
    const a = newcomerScenario(market({ a: 100 }), "a", 10);
    const b = newcomerScenario(market({ a: 100 }), "a", 50);
    expect(b.points).toBeGreaterThan(a.points);
    expect(b.pointsPerCredit).toBeLessThan(a.pointsPerCredit);
    expect(newcomerScenario(market({ a: 100 }), "a", 50, .5).points).toBe(b.points / 2);
  });
  it("rejects non-whole credits and impossible prize fractions", () => {
    for (const n of [0, 101, 1.5, NaN]) expect(() => newcomerScenario(market({}), "a", n)).toThrow();
    for (const s of [0, 2, NaN]) expect(() => newcomerScenario(market({}), "a", 10, s)).toThrow();
  });
});
