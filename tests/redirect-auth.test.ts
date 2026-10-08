import { describe, expect, it } from "vitest";
import { AUTH_FLOW_MS, authDigest, authReturnFragment, prefersRedirectSignIn, randomAuthValue, redirectStorageKey, validRedirectDraft } from "../shared/redirect-auth";
import { markets } from "../shared/markets";
import { createRedirectFlow, googleRedirectPage, verifyRedirectForm } from "../worker/redirect-auth";
import type { AuthFlow, AuthFlowStore } from "../worker/redirect-auth";

const flow: AuthFlow = {id:crypto.randomUUID(),nonce:randomAuthValue(),challenge:randomAuthValue(),origin:"https://sfuchs-de.github.io",expires:Date.now()+AUTH_FLOW_MS};
const store: AuthFlowStore = {createAuthFlow:async()=>{},readAuthFlow:async id=>id===flow.id?flow:null,
  completeAuthFlow:async()=>{},redeemAuthFlow:async()=>{throw Error("unused");}};
const draft = {marketId:"public",flowId:flow.id,verifier:randomAuthValue(),allocation:{"ariel-pakes":100},displayName:"Test player",createdAt:Date.now()};
const form = (csrf="csrf", id=flow.id) => new URLSearchParams({credential:"test-id-token",g_csrf_token:csrf,state:id}).toString();
const req = (cookie="g_csrf_token=csrf",type="application/x-www-form-urlencoded") => new Request("https://example.com/api/public/auth/callback",{method:"POST",headers:{Cookie:cookie,"Content-Type":type}});
describe("Mobile redirect sign-in",()=>{
  it("uses redirect on iPhones and iPads",()=>{
    expect(prefersRedirectSignIn("Mozilla iPhone Safari")).toBe(true);
    expect(prefersRedirectSignIn("Mozilla iPad")).toBe(true);
    expect(prefersRedirectSignIn("Macintosh Safari",5)).toBe(true);
  });
  it("retains desktop/Android popup support",()=>{
    expect(prefersRedirectSignIn("Macintosh Safari",0)).toBe(false);
    expect(prefersRedirectSignIn("Android Chrome",5)).toBe(false);
  });
  it("uses separate browser records for each group",()=>expect(redirectStorageKey(markets.public)).not.toBe(redirectStorageKey(markets.original)));
  it("generates 256-bit URL-safe independent verifiers",()=>{
    const a=randomAuthValue(),b=randomAuthValue();expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);expect(a).not.toBe(b);
  });
  it("uses SHA-256 S256 challenges",async()=>expect(await authDigest("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0"));
  it("restores a current draft only in its own group",()=>{
    expect(validRedirectDraft(draft,markets.public)).toBe(true);expect(validRedirectDraft(draft,markets.original)).toBe(false);
  });
  it("rejects expired and malformed stored drafts",()=>{
    expect(validRedirectDraft({...draft,createdAt:Date.now()-AUTH_FLOW_MS},markets.public)).toBe(false);
    expect(validRedirectDraft({...draft,createdAt:Date.now()+1000},markets.public)).toBe(false);
    expect(validRedirectDraft({...draft,allocation:{"ariel-pakes":0.5}},markets.public)).toBe(false);
    expect(validRedirectDraft({...draft,verifier:"short"},markets.public)).toBe(false);
  });
  it("parses only valid one-use returns, not tokens or unrelated hashes",()=>{
    const code=randomAuthValue();expect(authReturnFragment(`#signin=${flow.id}&code=${code}`)).toEqual({flowId:flow.id,code});
    expect(authReturnFragment("#results")).toBeNull();expect(authReturnFragment(`#signin=${flow.id}&code=short`)).toBeNull();
  });
  it("requires a real challenge when creating an attempt",async()=>{
    await expect(createRedirectFlow("short",flow.origin,store)).rejects.toThrow("Invalid");
    const created=await createRedirectFlow(draft.verifier,flow.origin,store);expect(created.nonce).not.toBe(created.challenge);
  });
  it("renders full-page GIS with no popup or callback",async()=>{
    const r=googleRedirectPage("public-client","https://api.example/api/public/auth/callback",flow,markets.public);const html=await r.text();
    expect(html).toContain('data-ux_mode="redirect"');expect(html).toContain('data-flow_id=');expect(html).toContain('data-nonce=');expect(html).not.toContain("data-callback");expect(html).toContain("Public group");
    expect(r.headers.get("Cache-Control")).toBe("no-store");expect(r.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
  it("validates Google's double-submit cookie before accepting the form",async()=>expect((await verifyRedirectForm(req(),form(),store)).flow.id).toBe(flow.id));
  it.each(["","g_csrf_token=wrong","g_csrf_token=csrf; g_csrf_token=csrf"])("rejects absent, wrong or duplicate CSRF cookies %s",async cookie=>{
    await expect(verifyRedirectForm(req(cookie),form(),store)).rejects.toThrow("security check");
  });
  it("rejects unknown/mixed attempt IDs and duplicate fields",async()=>{
    await expect(verifyRedirectForm(req(),form("csrf",crypto.randomUUID()),store)).rejects.toThrow("expired");
    await expect(verifyRedirectForm(req(),form()+"&flow_id="+crypto.randomUUID(),store)).rejects.toThrow("different");
    await expect(verifyRedirectForm(req(),form()+"&credential=another",store)).rejects.toThrow("Invalid");
  });
  it("rejects completed attempts and invalid content types",async()=>{
    await expect(verifyRedirectForm(req("g_csrf_token=csrf","application/json"),form(),store)).rejects.toThrow("Invalid");
    await expect(verifyRedirectForm(req(),form(),{...store,readAuthFlow:async()=>({...flow,expires:0})})).rejects.toThrow("expired");
  });
});
