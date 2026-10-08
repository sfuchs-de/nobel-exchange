import type { Allocation } from "./types";
import type { MarketDefinition } from "./markets";

export const AUTH_FLOW_MS = 10 * 60 * 1000;
export const AUTH_HANDOFF_MS = 2 * 60 * 1000;
export const opaqueAuthValue = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export const flowIdValue = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
export function randomAuthValue(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function authDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const redirectStorageKey = (market: MarketDefinition) => market.sessionKey + "-redirect";
export type RedirectDraft = {
  marketId: string; flowId: string; verifier: string;
  allocation: Allocation; displayName: string; createdAt: number;
};
export function validRedirectDraft(value: unknown, market: MarketDefinition, now = Date.now()): value is RedirectDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as RedirectDraft;
  return d.marketId === market.id && flowIdValue(d.flowId) && opaqueAuthValue(d.verifier) &&
    Number.isFinite(d.createdAt) && now >= d.createdAt && now - d.createdAt < AUTH_FLOW_MS &&
    typeof d.displayName === "string" && d.displayName.length <= 200 &&
    !!d.allocation && typeof d.allocation === "object" && !Array.isArray(d.allocation) &&
    Object.entries(d.allocation).every(([id, n]) => /^[a-z0-9-]+$/.test(id) && Number.isInteger(n) && n >= 1 && n <= 100);
}
export function prefersRedirectSignIn(userAgent: string, touchPoints = 0): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1);
}
export function authReturnFragment(hash: string): { flowId: string; code: string } | null {
  if (!hash.startsWith("#signin=")) return null;
  const params = new URLSearchParams(hash.slice(1));
  const flowId = params.get("signin"), code = params.get("code");
  return flowIdValue(flowId) && opaqueAuthValue(code) ? {flowId, code} : null;
}
