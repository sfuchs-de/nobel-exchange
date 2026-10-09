import type { MarketDefinition } from "./markets";
import type { Session } from "./types";
import { randomAuthValue } from "./redirect-auth";

export const QUICK_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const quickSessionKey = (market: MarketDefinition) => market.sessionKey + "-quick";
export const quickCodePrefix = (market: MarketDefinition) => market.id === "public" ? "NX-P." : "NX-O.";
export const newQuickCode = (market: MarketDefinition) => quickCodePrefix(market) + randomAuthValue();
export function validQuickCode(value: unknown, market: MarketDefinition): value is string {
  return typeof value === "string" && value.startsWith(quickCodePrefix(market)) &&
    /^[A-Za-z0-9_-]{43}$/.test(value.slice(5));
}
export function restoreBrowserSession(tabValue: string | null, quickValue: string | null,
  market: MarketDefinition, now = Date.now()): Session | null {
  for (const raw of [tabValue, quickValue]) {
    try {
      const s = JSON.parse(raw || "null") as Session | null;
      if (!s || typeof s.id !== "string" || typeof s.token !== "string" ||
          typeof s.displayName !== "string" || typeof s.admin !== "boolean" ||
          !Number.isFinite(Date.parse(s.expiresAt)) || Date.parse(s.expiresAt) <= now) continue;
      if (s.authMethod === "quick" && (s.marketId !== market.id || s.admin || !s.id.startsWith("quick:"))) continue;
      if (raw === quickValue && raw !== tabValue && s.authMethod !== "quick") continue;
      return s;
    } catch { /* Malformed or expired storage never authenticates a request. */ }
  }
  return null;
}
