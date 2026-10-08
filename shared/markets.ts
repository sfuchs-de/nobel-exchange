/** Fixed, server-owned market names. Never create rooms from arbitrary user input. */
export const markets = {
  original: {
    id: "original", label: "Original group", objectName: "economics-2026",
    path: "/nobel-exchange/", apiPrefix: "/api", sessionKey: "nobel-session",
  },
  public: {
    id: "public", label: "Public group", objectName: "economics-2026-public",
    path: "/nobel-exchange/public/", apiPrefix: "/api/public", sessionKey: "nobel-session-public",
  },
} as const;
export type MarketId = keyof typeof markets;
export type MarketDefinition = (typeof markets)[MarketId];

export function marketForPage(pathname: string): MarketDefinition | null {
  const path = pathname.replace(/\/index\.html$/, "/").replace(/\/?$/, "/");
  return Object.values(markets).find(market => market.path === path) ?? null;
}

const endpoints = new Set([
  "/config", "/auth/google", "/auth/redirect", "/auth/login", "/auth/callback", "/auth/redeem", "/market", "/live", "/me", "/portfolio",
  "/admin/state", "/admin/settlement-preview", "/admin/settle", "/admin/export",
]);
export function marketApiRoute(pathname: string): { market: MarketDefinition; path: string } | null {
  const market = pathname.startsWith("/api/public/") ? markets.public : markets.original;
  if (!pathname.startsWith(market.apiPrefix + "/")) return null;
  const endpoint = pathname.slice(market.apiPrefix.length);
  return endpoints.has(endpoint) ? { market, path: "/api" + endpoint } : null;
}

export function belongsToMarket(snapshot: {marketId?: string}, market: MarketDefinition): boolean {
  // Older original-market releases did not include the label. Never accept
  // an unlabelled original feed in the public market during a rolling release.
  return (snapshot.marketId ?? "original") === market.id;
}
