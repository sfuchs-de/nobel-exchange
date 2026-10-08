import { RuleError } from "../shared/rules";
import type { MarketDefinition } from "../shared/markets";
import { AUTH_FLOW_MS, AUTH_HANDOFF_MS, authDigest, flowIdValue, opaqueAuthValue, randomAuthValue } from "../shared/redirect-auth";
import type { Session } from "../shared/types";

export type AuthFlow = {
  id: string; nonce: string; challenge: string; origin: string;
  expires: number; codeHash?: string; session?: Session;
};
export interface AuthFlowStore {
  createAuthFlow(flow: AuthFlow): Promise<void>;
  readAuthFlow(id: string): Promise<AuthFlow | null>;
  completeAuthFlow(id: string, codeHash: string, session: Session): Promise<void>;
  redeemAuthFlow(id: string, codeHash: string, challenge: string, origin: string): Promise<Session>;
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
function page(title: string, body: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escape(title)} · Nobel Exchange</title><style>body{margin:0;background:#f6f3ec;color:#232c34;font:17px/1.6 system-ui,sans-serif;min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box}main{box-sizing:border-box;width:min(100%,440px);padding:32px;background:#fffdf8;border:1px solid #dfd9c9;border-radius:18px}h1{font-family:Georgia,serif;font-size:32px;line-height:1.15;margin:12px 0}small{color:#6b716f}a{color:#755b20}#login{min-height:48px;margin:24px 0}.badge{font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:#755b20}.help{font-size:14px;margin-top:24px}</style></head><body><main>${body}</main></body></html>`, {status, headers:{
    "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store",
    "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff",
    "Content-Security-Policy":"base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
  }});
}
export function authErrorPage(message: string, market: MarketDefinition, origin: string, status = 400): Response {
  return page("Let’s try that again", `<span class="badge">${escape(market.label)}</span><h1>Let’s try that again.</h1><p>${escape(message)}</p><p><a href="${escape(origin + market.path)}">Return to the game and sign in again</a></p><p class="help">On iPhone, open the game itself in Safari. Keep the same browser open until you return. Your saved portfolio is unchanged.</p>`, status);
}
export function googleRedirectPage(clientId: string, callback: string, flow: AuthFlow, market: MarketDefinition): Response {
  return page("Sign in", `<span class="badge">${escape(market.label)}</span><h1>Your seat at the exchange.</h1><p>Continue with Google, then you’ll return to this group with your draft ready.</p><div id="g_id_onload" data-client_id="${escape(clientId)}" data-ux_mode="redirect" data-login_uri="${escape(callback)}" data-nonce="${escape(flow.nonce)}" data-flow_id="${escape(flow.id)}" data-auto_prompt="false"></div><div id="login" class="g_id_signin" data-type="standard" data-size="large" data-theme="outline" data-state="${escape(flow.id)}"></div><script src="https://accounts.google.com/gsi/client" async defer></script><p><a href="${escape(flow.origin + market.path)}">Back to the game</a></p><p class="help">No popup. No Gmail or calendar access. Signing in does not submit picks or join the other group.</p><p class="help">If Google doesn’t load, open the game directly in Safari or Chrome rather than an embedded browser.</p>`);
}
export async function createRedirectFlow(challenge: unknown, origin: string, store: AuthFlowStore): Promise<AuthFlow> {
  if (!opaqueAuthValue(challenge)) throw new RuleError("Invalid sign-in request.");
  const flow: AuthFlow = {id:crypto.randomUUID(), nonce:randomAuthValue(), challenge, origin, expires:Date.now()+AUTH_FLOW_MS};
  await store.createAuthFlow(flow);
  return flow;
}
export async function verifyRedirectForm(request: Request, raw: string, store: AuthFlowStore): Promise<{ flow: AuthFlow; credential: string }> {
  if (!(request.headers.get("Content-Type") || "").startsWith("application/x-www-form-urlencoded"))
    throw new RuleError("Invalid Google sign-in response.", 400);
  const form = new URLSearchParams(raw);
  for (const key of ["credential", "g_csrf_token", "flow_id", "state"])
    if (form.getAll(key).length > 1) throw new RuleError("Invalid Google sign-in response.");
  const csrf = form.get("g_csrf_token");
  const cookies = (request.headers.get("Cookie") || "").split(";").map(v => v.trim()).filter(v => v.startsWith("g_csrf_token="));
  const cookie = cookies.length === 1 ? cookies[0].slice("g_csrf_token=".length) : "";
  if (!csrf || !cookie || csrf.length > 256 || cookie.length > 256 || await authDigest(csrf) !== await authDigest(cookie))
    throw new RuleError("Google’s security check could not be completed. Please start sign-in again in the same browser.", 403);
  const id = form.get("flow_id") || form.get("state");
  if (!flowIdValue(id) || (form.get("flow_id") && form.get("state") && form.get("flow_id") !== form.get("state")))
    throw new RuleError("The sign-in response belongs to a different attempt.", 403);
  const flow = await store.readAuthFlow(id);
  const credential = form.get("credential");
  if (!flow || flow.expires <= Date.now() || flow.session)
    throw new RuleError("This sign-in attempt expired or was already used. Please try again.", 410);
  if (!credential || credential.length > 10000) throw new RuleError("Google did not return a valid sign-in response.", 401);
  return {flow, credential};
}
export async function finishRedirectFlow(flow: AuthFlow, session: Session, store: AuthFlowStore, market: MarketDefinition): Promise<Response> {
  const code = randomAuthValue();
  await store.completeAuthFlow(flow.id, await authDigest(code), session);
  // Only a two-minute, one-use code is in the fragment; never a Google or app token.
  // Redemption also requires the random verifier retained by the initiating tab.
  const fragment = new URLSearchParams({signin:flow.id, code});
  return new Response(null, {status:303, headers:{Location:flow.origin+market.path+"#"+fragment.toString(), "Cache-Control":"no-store", "Referrer-Policy":"no-referrer"}});
}
export async function redeemRedirectFlow(body: Record<string, unknown>, origin: string, store: AuthFlowStore): Promise<Session> {
  if (!flowIdValue(body.flowId) || !opaqueAuthValue(body.code) || !opaqueAuthValue(body.verifier))
    throw new RuleError("Invalid sign-in return. Start sign-in from the game again.", 400);
  return store.redeemAuthFlow(body.flowId, await authDigest(body.code), await authDigest(body.verifier), origin);
}
export { AUTH_HANDOFF_MS };
