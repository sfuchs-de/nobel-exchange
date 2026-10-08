import { describe, it, expect } from "vitest";
import {
  aggregate,
  validateAllocation,
  projectedPayout,
  score,
  validateWinners,
  effectivePhase,
  validateName,
  canonicalWinners,
} from "../shared/rules";
import type { Entry } from "../shared/types";
const entry = (id: string, allocation: Record<string, number>): Entry => ({
  id,
  displayName: id,
  allocation,
  version: 1,
  updatedAt: "2026-10-08T00:00:00Z",
});
describe("budget", () => {
  it("requires exactly 100 positive whole credits on 1–10 known candidates", () => {
    expect(validateAllocation({ a: 50, b: 50 }, new Set(["a", "b"]))).toEqual({
      a: 50,
      b: 50,
    });
    for (const v of [
      { a: 101 },
      { a: 99 },
      { a: 100, b: 0 },
      { a: 99.5, b: 0.5 },
      { c: 100 },
      [],
      null,
    ])
      expect(() => validateAllocation(v, new Set(["a", "b"]))).toThrow();
    const many = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => ["a" + i, i === 0 ? 90 : 1]),
    );
    expect(() =>
      validateAllocation(many, new Set(Object.keys(many))),
    ).toThrow();
  });
  it("rejects unsafe names", () => {
    expect(() => validateName("<b>x</b>")).toThrow();
    expect(validateName("  Team  Keynes ")).toBe("Team Keynes");
  });
});
describe("live potential return", () => {
  const old = { a: 100 };
  const snapshot = aggregate([entry("me", old), entry("you", { b: 100 })]);
  it("subtracts existing allocation before previewing replacement", () =>
    expect(projectedPayout(snapshot, old, { a: 50, b: 50 }, "b")).toBeCloseTo(
      200 / 3,
    ));
  it("includes a new participant and their own market impact", () =>
    expect(projectedPayout(snapshot, undefined, { a: 100 }, "a")).toBe(150));
  it("does not invent infinite returns for a first backer", () =>
    expect(projectedPayout(aggregate([]), undefined, { z: 100 }, "z")).toBe(
      100,
    ));
});
describe("settlement", () => {
  const entries = [entry("A", { x: 80, y: 20 }), entry("B", { x: 20, y: 80 })];
  it("scores a sole winner", () =>
    expect(
      score(entries, [{ candidateId: "x", share: 1 }]).rows.map(
        (r) => r.points,
      ),
    ).toEqual([160, 40]));
  it("uses unequal official shares", () =>
    expect(
      score(entries, [
        { candidateId: "x", share: 0.75 },
        { candidateId: "y", share: 0.25 },
      ]).rows.map((r) => r.points),
    ).toEqual([130, 70]));
  it("preserves ties", () =>
    expect(
      score(entries, [
        { candidateId: "x", share: 0.5 },
        { candidateId: "y", share: 0.5 },
      ]).rows.map((r) => r.rank),
    ).toEqual([1, 1]));
  it("leaves unbacked shares unawarded", () =>
    expect(
      score(entries, [
        { candidateId: "x", share: 0.5 },
        { candidateId: "outside", share: 0.5 },
      ]).unawarded,
    ).toBe(100));
  it("handles nobody backing any winner", () => {
    const r = score(entries, [{ candidateId: "outside", share: 1 }]);
    expect(r.unawarded).toBe(200);
    expect(r.rows.every((r) => r.points === 0 && r.rank === 1)).toBe(true);
  });
  it("validates official fractions", () => {
    for (const w of [
      [],
      [{ candidateId: "a", share: 0.5 }],
      [
        { candidateId: "a", share: 0.5 },
        { candidateId: "a", share: 0.5 },
      ],
    ])
      expect(() => validateWinners(w)).toThrow();
  });
  it("rejects malformed laureate objects with a rule error, not a server exception", () => {
    for (const w of [[null], [true], ["a"], [[]], [{}]])
      expect(() => validateWinners(w)).toThrow(/laureate|prize share/);
  });
  it("uses canonical roster names and requires an explicit safe outside name", () => {
    expect(canonicalWinners([{ candidateId: "x", share: 1, name: "Wrong person" }], { x: "Correct Person" }))
      .toEqual([{ candidateId: "x", share: 1, name: "Correct Person" }]);
    expect(canonicalWinners([{ candidateId: "outside-y", share: 1, name: "  New Laureate  " }], {}))
      .toEqual([{ candidateId: "outside-y", share: 1, name: "New Laureate" }]);
    for (const name of [undefined, "", "<b>Name</b>", "N".repeat(101)])
      expect(() => canonicalWinners([{ candidateId: "outside-y", share: 1, name }], {})).toThrow();
  });
});
it("locks at the exact server deadline even if still manually open", () =>
  expect(
    effectivePhase(
      "open",
      "2026-10-12T00:00:00Z",
      Date.parse("2026-10-12T00:00:00Z"),
    ),
  ).toBe("closed"));
