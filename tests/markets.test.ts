import { describe, expect, it } from "vitest";
import { belongsToMarket, marketApiRoute, marketForPage, markets } from "../shared/markets";

describe("Independent market routing", () => {
  it("preserves the original persistent name and session key", () => {
    expect(markets.original.objectName).toBe("economics-2026");
    expect(markets.original.sessionKey).toBe("nobel-session");
  });
  it("gives the public market its own object and session storage", () => {
    expect(markets.public.objectName).not.toBe(markets.original.objectName);
    expect(markets.public.sessionKey).not.toBe(markets.original.sessionKey);
  });
  it.each(["/nobel-exchange/", "/nobel-exchange", "/nobel-exchange/index.html"])("resolves original page %s", path => {
    expect(marketForPage(path)?.id).toBe("original");
  });
  it.each(["/nobel-exchange/public/", "/nobel-exchange/public", "/nobel-exchange/public/index.html"])("resolves public page %s", path => {
    expect(marketForPage(path)?.id).toBe("public");
  });
  it("does not silently put unknown URLs into the original group", () => {
    for (const path of ["/nobel-exchange/other/", "/public/", "/nobel-exchange/public/more/"])
      expect(marketForPage(path)).toBeNull();
  });
  it("scopes every endpoint including auth, admin and live feeds", () => {
    for (const endpoint of ["config", "auth/google", "auth/redirect", "auth/login", "auth/callback", "auth/redeem", "auth/quick/register", "auth/quick/recover", "market", "live", "me", "portfolio", "admin/state", "admin/settlement-preview", "admin/settle", "admin/export"]) {
      expect(marketApiRoute("/api/" + endpoint)).toEqual({market: markets.original, path: "/api/" + endpoint});
      expect(marketApiRoute("/api/public/" + endpoint)).toEqual({market: markets.public, path: "/api/" + endpoint});
    }
  });
  it("rejects arbitrary rooms, similar prefixes and unknown endpoints", () => {
    for (const path of ["/api/other/market", "/api/publicity/market", "/api/public", "/api/public/public/market", "/api/public/bogus", "/api/public/admin/unknown"])
      expect(marketApiRoute(path)).toBeNull();
  });
  it("accepts only the selected feed, with backward compatibility for original", () => {
    expect(belongsToMarket({}, markets.original)).toBe(true);
    expect(belongsToMarket({}, markets.public)).toBe(false);
    expect(belongsToMarket({marketId:"public"}, markets.public)).toBe(true);
    expect(belongsToMarket({marketId:"original"}, markets.public)).toBe(false);
    expect(belongsToMarket({marketId:"public"}, markets.original)).toBe(false);
  });
  it("keeps results sharing within the selected group", () => {
    expect(markets.public.path + "#results").toBe("/nobel-exchange/public/#results");
    expect(markets.original.path + "#results").toBe("/nobel-exchange/#results");
  });
});
