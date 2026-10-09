import { describe, expect, it } from "vitest";
import { markets } from "../shared/markets";
import { newQuickCode, quickSessionKey, restoreBrowserSession, validQuickCode, QUICK_SESSION_MS } from "../shared/quick-auth";
import type { Session } from "../shared/types";

const now = Date.now();
const quick: Session = {id:"quick:example", displayName:"Test", token:"opaque-test-session",
  admin:false, authMethod:"quick", marketId:"public", expiresAt:new Date(now+QUICK_SESSION_MS).toISOString()};
const google: Session = {id:"google-example", displayName:"Google test", token:"opaque-test-google",
  admin:false, expiresAt:new Date(now+1000).toISOString()};
describe("Quick join credentials and browser persistence", () => {
  it("generates 256-bit opaque, distinct codes for both markets", () => {
    const values = new Set<string>();
    for (const market of Object.values(markets)) for(let i=0;i<100;i++) {
      const code = newQuickCode(market);
      expect(validQuickCode(code, market)).toBe(true); expect(code).toHaveLength(48);
      values.add(code);
    }
    expect(values.size).toBe(200);
  });
  it("does not accept a code in the other market", () => {
    expect(validQuickCode(newQuickCode(markets.public), markets.original)).toBe(false);
    expect(validQuickCode(newQuickCode(markets.original), markets.public)).toBe(false);
  });
  it.each([null, {}, "", "NX-P.short", "NX-P."+"x".repeat(44), "NX-P."+" ".repeat(43)])("rejects malformed code %s", value => {
    expect(validQuickCode(value, markets.public)).toBe(false);
  });
  it("keeps remembered sessions in distinct browser keys", () => {
    expect(quickSessionKey(markets.public)).not.toBe(quickSessionKey(markets.original));
    expect(quickSessionKey(markets.public)).not.toBe(markets.public.sessionKey);
  });
  it("restores a remembered quick account without a tab session", () => {
    expect(restoreBrowserSession(null, JSON.stringify(quick), markets.public, now)).toEqual(quick);
  });
  it("preserves an existing Google tab sign-in", () => {
    expect(restoreBrowserSession(JSON.stringify(google), JSON.stringify(quick), markets.public, now)).toEqual(google);
  });
  it("never restores a quick account into the other group or as administrator", () => {
    expect(restoreBrowserSession(JSON.stringify(quick), null, markets.original, now)).toBeNull();
    expect(restoreBrowserSession(null, JSON.stringify({...quick,admin:true}), markets.public, now)).toBeNull();
  });
  it("expires remembered sign-ins but leaves recovery possible", () => {
    expect(restoreBrowserSession(null, JSON.stringify(quick), markets.public, now+QUICK_SESSION_MS)).toBeNull();
  });
  it("falls back past corrupt storage and rejects non-quick persistent sessions", () => {
    expect(restoreBrowserSession("bad-json", JSON.stringify(quick), markets.public, now)).toEqual(quick);
    expect(restoreBrowserSession(null, JSON.stringify(google), markets.public, now)).toBeNull();
    expect(restoreBrowserSession(null, "{}", markets.public, now)).toBeNull();
  });
});
