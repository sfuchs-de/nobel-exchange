import { describe, expect, it } from "vitest";
import { portfolioSaveState, type SaveState } from "../shared/portfolio";

const ready: SaveState = {busy:false,closed:false,loaded:true,phase:"open",total:100,picks:2,signedIn:true,displayName:"Simon",dirty:true};

describe("portfolio saving guidance", () => {
  it("enables a valid signed-in portfolio without changing it", () => {
    const s = {...ready};
    expect(portfolioSaveState(s).disabled).toBe(false);
    expect(s).toEqual(ready);
  });
  it("explains the reported 20-credit draft and enables it only at 100", () => {
    expect(portfolioSaveState({...ready,total:20})).toMatchObject({disabled:true,message:expect.stringContaining("Allocate 80 more credits")});
    expect(portfolioSaveState({...ready,total:100}).disabled).toBe(false);
  });
  it("rejects over-budget and handles singular credit guidance", () => {
    expect(portfolioSaveState({...ready,total:101}).message).toContain("Remove 1 credit");
    expect(portfolioSaveState({...ready,total:99}).message).toContain("Allocate 1 more credit");
    expect(portfolioSaveState({...ready,total:101}).disabled).toBe(true);
  });
  it("explains empty or oversized portfolios", () => {
    expect(portfolioSaveState({...ready,total:0,picks:0}).disabled).toBe(true);
    expect(portfolioSaveState({...ready,picks:11}).message).toContain("at most 10");
  });
  it("requires a trimmed display name only after signing in", () => {
    expect(portfolioSaveState({...ready,displayName:"  "}).disabled).toBe(true);
    expect(portfolioSaveState({...ready,signedIn:false,displayName:""})).toMatchObject({disabled:false,message:expect.stringContaining("Sign in with Google")});
  });
  it("distinguishes already saved from a changed portfolio", () => {
    expect(portfolioSaveState({...ready,dirty:false})).toMatchObject({disabled:true,message:expect.stringContaining("up to date")});
    expect(portfolioSaveState(ready).disabled).toBe(false);
  });
  it("blocks unloaded or in-progress writes with a reason", () => {
    expect(portfolioSaveState({...ready,loaded:false})).toMatchObject({disabled:true,message:expect.stringContaining("latest market state")});
    expect(portfolioSaveState({...ready,busy:true})).toMatchObject({disabled:true,message:expect.stringContaining("Saving")});
  });
  it("never enables setup, paused, closed, settled, or past-deadline saves", () => {
    for (const phase of ["setup","paused","closed","settled"] as const)
      expect(portfolioSaveState({...ready,phase}).disabled).toBe(true);
    expect(portfolioSaveState({...ready,closed:true}).disabled).toBe(true);
  });
});
