import { DurableObject } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import {
  aggregate,
  validateAllocation,
  validateName,
  canonicalWinners,
  score,
  effectivePhase,
  RuleError,
} from "../shared/rules";
import type { Entry, Settlement, Snapshot, Winner } from "../shared/types";
import roster from "../public/candidates.json";

interface Env extends ProductionBindings {
  ADMIN_SUB: string;
  SESSION_SECRET: string;
  DEV_AUTH?: string;
}
type Identity = { sub: string; admin: boolean; name: string };
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const ids = new Set(
  roster.candidates.filter((c) => c.eligible).map((c) => c.id),
);
const rosterIdentity = JSON.stringify(
  roster.candidates
    .map((c) => ({ id: c.id, name: c.name, eligible: c.eligible }))
    .sort((a, b) => a.id.localeCompare(b.id)),
);
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function local(req: Request, env: Env) {
  return (
    env.DEV_AUTH === "local-only" &&
    ["localhost", "127.0.0.1", "::1"].includes(new URL(req.url).hostname)
  );
}
async function identity(req: Request, env: Env): Promise<Identity> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) throw new RuleError("Sign in to save your portfolio.", 401);
  if (local(req, env) && /^dev-[a-z0-9-]{1,40}$/.test(token))
    return {
      sub: token,
      admin: token === "dev-admin",
      name: token.replace("dev-", "Preview "),
    };
  if (!env.SESSION_SECRET)
    throw new RuleError("Sign-in has not been configured yet.", 503);
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SESSION_SECRET),
      {
        issuer: "nobel-exchange",
        audience: "nobel-exchange",
        algorithms: ["HS256"],
      },
    );
    if (!payload.sub) throw Error();
    return {
      sub: payload.sub,
      admin: payload.sub === env.ADMIN_SUB,
      name: String(payload.name || ""),
    };
  } catch {
    throw new RuleError("Your sign-in expired. Please sign in again.", 401);
  }
}
async function readJson(req: Request) {
  const reader = req.body?.getReader();
  const decoder = new TextDecoder();
  let raw = "",
    bytes = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12000) {
        await reader.cancel();
        throw new RuleError("Request is too large.", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  }
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
    return body;
  } catch {
    throw new RuleError("Invalid request.");
  }
}
function checkOrigin(req: Request, env: Env) {
  const origin = req.headers.get("Origin");
  if (!origin || !env.ALLOWED_ORIGINS.split(",").includes(origin))
    throw new RuleError("This origin is not allowed.", 403);
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const origin = req.headers.get("Origin");
    try {
      if (req.method === "OPTIONS") {
        checkOrigin(req, env);
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origin!,
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Max-Age": "600",
            Vary: "Origin",
          },
        });
      }
      if (req.method !== "GET") checkOrigin(req, env);
      let res: Response;
      const room = env.MARKET.get(env.MARKET.idFromName("economics-2026"));
      if (path === "/api/config")
        res = reply({
          googleClientId: env.GOOGLE_CLIENT_ID || null,
          authReady: Boolean(env.GOOGLE_CLIENT_ID && env.SESSION_SECRET),
          development: local(req, env),
          rosterVersion: roster.version,
        });
      else if (path === "/api/auth/google" && req.method === "POST") {
        if (!env.GOOGLE_CLIENT_ID || !env.SESSION_SECRET)
          throw new RuleError("Google sign-in is not configured.", 503);
        const body = await readJson(req);
        if (typeof body.credential !== "string")
          throw new RuleError(
            "Google sign-in did not provide a credential.",
            401,
          );
        let payload;
        try {
          payload = (
            await jwtVerify(body.credential, keys, {
              audience: env.GOOGLE_CLIENT_ID,
              issuer: ["https://accounts.google.com", "accounts.google.com"],
              algorithms: ["RS256"],
            })
          ).payload;
        } catch {
          throw new RuleError("Google sign-in could not be verified.", 401);
        }
        if (!payload.sub)
          throw new RuleError("Google sign-in could not be verified.", 401);
        const expiresAt = new Date(
          Date.now() + 8 * 60 * 60 * 1000,
        ).toISOString();
        const token = await new SignJWT({ name: String(payload.name || "") })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(payload.sub)
          .setIssuer("nobel-exchange")
          .setAudience("nobel-exchange")
          .setIssuedAt()
          .setExpirationTime("8h")
          .sign(new TextEncoder().encode(env.SESSION_SECRET));
        res = reply({
          id: payload.sub,
          displayName: String(payload.given_name || payload.name || ""),
          admin: payload.sub === env.ADMIN_SUB,
          token,
          expiresAt,
        });
      } else if (path === "/api/market" && req.method === "GET")
        res = reply(await room.snapshot());
      else if (path === "/api/live" && req.method === "GET") {
        checkOrigin(req, env);
        if (req.headers.get("Upgrade")?.toLowerCase() !== "websocket")
          throw new RuleError("WebSocket upgrade required.", 426);
        return room.fetch(req);
      } else if (path === "/api/me" && req.method === "GET") {
        const who = await identity(req, env);
        res = reply({ entry: await room.entry(who.sub), admin: who.admin });
      } else if (path === "/api/portfolio" && req.method === "PUT") {
        const who = await identity(req, env);
        const body = await readJson(req);
        const result = JSON.parse(
          await room.execute("save", JSON.stringify(body), who.sub),
        );
        res = reply(result.body, result.status);
      } else if (path.startsWith("/api/admin/")) {
        const who = await identity(req, env);
        if (!who.admin)
          throw new RuleError("Administrator access required.", 403);
        if (path === "/api/admin/export" && req.method === "GET") {
          const r = JSON.parse(await room.execute("export", "{}", who.sub));
          res = reply(r.body, r.status);
        } else if (
          [
            "/api/admin/state",
            "/api/admin/settlement-preview",
            "/api/admin/settle",
          ].includes(path) &&
          req.method === "POST"
        ) {
          const method = path.endsWith("/state")
            ? "control"
            : path.endsWith("/settle")
              ? "settle"
              : "preview";
          const r = JSON.parse(
            await room.execute(
              method,
              JSON.stringify(await readJson(req)),
              who.sub,
            ),
          );
          res = reply(r.body, r.status);
        } else throw new RuleError("Not found.", 404);
      } else throw new RuleError("Not found.", 404);
      const headers = new Headers(res.headers);
      if (origin && env.ALLOWED_ORIGINS.split(",").includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
      }
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(res.body, { status: res.status, headers });
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err.status || 500;
      const headers: Record<string, string> = {};
      if (origin && env.ALLOWED_ORIGINS.split(",").includes(origin))
        headers["Access-Control-Allow-Origin"] = origin;
      return Response.json(
        {
          error:
            status === 500
              ? "The server could not complete that request. Please retry."
              : err.message,
        },
        { status, headers },
      );
    }
  },
};

export class Market extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep idle browser heartbeats in the hibernation layer instead of waking
    // the market object and billing active duration for each ping.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS entries (subject TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, allocation TEXT NOT NULL, version INTEGER NOT NULL, updated TEXT NOT NULL, last_ms INTEGER NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS receipts (subject TEXT NOT NULL, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(subject,request_id))",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, data TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, data TEXT NOT NULL)",
    );
  }
  async execute(
    method: string,
    payload: string,
    actor: string,
  ): Promise<string> {
    try {
      const body = JSON.parse(payload);
      let result: unknown;
      if (method === "save") result = await this.save(actor, body);
      else if (method === "control") result = await this.control(body, actor);
      else if (method === "preview") result = await this.preview(body);
      else if (method === "settle") result = await this.settle(body, actor);
      else if (method === "export") result = await this.exportData();
      else throw new RuleError("Not found.", 404);
      return JSON.stringify({ body: result, status: 200 });
    } catch (e) {
      const err = e as Error & { status?: number };
      return JSON.stringify({
        status: err.status || 500,
        body: {
          error: err.status
            ? err.message
            : "The server could not complete that request. Please retry.",
        },
      });
    }
  }
  private meta(key: string, fallback: string) {
    return (
      this.ctx.storage.sql
        .exec<{ value: string }>("SELECT value FROM metadata WHERE key=?", key)
        .toArray()[0]?.value || fallback
    );
  }
  private put(key: string, value: string) {
    this.ctx.storage.sql.exec(
      "INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  }
  private all(): Entry[] {
    return this.ctx.storage.sql
      .exec<{
        public_id: string;
        name: string;
        allocation: string;
        version: number;
        updated: string;
      }>(
        "SELECT public_id,name,allocation,version,updated FROM entries ORDER BY public_id",
      )
      .toArray()
      .map((r) => ({
        id: r.public_id,
        displayName: r.name,
        allocation: JSON.parse(r.allocation),
        version: r.version,
        updatedAt: r.updated,
      }));
  }
  async entry(sub: string): Promise<Entry | null> {
    const r = this.ctx.storage.sql
      .exec<{
        public_id: string;
        name: string;
        allocation: string;
        version: number;
        updated: string;
      }>(
        "SELECT public_id,name,allocation,version,updated FROM entries WHERE subject=?",
        sub,
      )
      .toArray()[0];
    return r
      ? {
          id: r.public_id,
          displayName: r.name,
          allocation: JSON.parse(r.allocation),
          version: r.version,
          updatedAt: r.updated,
        }
      : null;
  }
  async snapshot(): Promise<Snapshot> {
    const entries = this.all();
    const raw = this.meta("settlement", "");
    const settlement: Settlement | undefined = raw
      ? JSON.parse(raw)
      : undefined;
    const closesAt = this.meta("close", this.env.MARKET_CLOSE);
    const phase = effectivePhase(
      this.meta("phase", "setup"),
      closesAt,
      Date.now(),
      Boolean(settlement),
    );
    const history = this.ctx.storage.sql
      .exec<{ at: string; data: string }>(
        "SELECT at,data FROM history ORDER BY id DESC LIMIT 240",
      )
      .toArray()
      .reverse()
      .map((r) => ({ at: r.at, ...JSON.parse(r.data) }));
    return {
      ...aggregate(entries),
      phase,
      closesAt,
      announcement: this.env.ANNOUNCEMENT,
      serverTime: new Date().toISOString(),
      revision: Number(this.meta("revision", "0")),
      history,
      ...(["closed", "settled"].includes(phase) ? { entries } : {}),
      ...(settlement ? { settlement } : {}),
    };
  }
  async save(
    sub: string,
    body: {
      allocation: unknown;
      displayName: unknown;
      version: number;
      requestId: string;
    },
  ) {
    if (this.meta("roster", "") !== rosterIdentity)
      throw new RuleError(
        "The candidate roster changed after opening. Saving is paused for administrator review.",
        409,
      );
    const allocation = validateAllocation(body.allocation, ids),
      name = validateName(body.displayName);
    if (
      !Number.isInteger(body.version) ||
      body.version < 0 ||
      typeof body.requestId !== "string" ||
      !/^[a-zA-Z0-9-]{8,80}$/.test(body.requestId)
    )
      throw new RuleError("Invalid save request.");
    const fingerprint = JSON.stringify({
      allocation: Object.fromEntries(Object.entries(allocation).sort()),
      name,
      version: body.version,
    });
    const receipt = this.ctx.storage.sql
      .exec<{
        fingerprint: string;
        response: string;
      }>(
        "SELECT fingerprint,response FROM receipts WHERE subject=? AND request_id=?",
        sub,
        body.requestId,
      )
      .toArray()[0];
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw new RuleError(
          "This save identifier was already used for a different edit.",
          409,
        );
      return JSON.parse(receipt.response);
    }
    const phase = effectivePhase(
      this.meta("phase", "setup"),
      this.meta("close", this.env.MARKET_CLOSE),
      Date.now(),
      Boolean(this.meta("settlement", "")),
    );
    if (phase !== "open")
      throw new RuleError(
        phase === "closed" || phase === "settled"
          ? "The market is closed. Your saved portfolio is locked."
          : "The market is not accepting changes right now.",
        409,
      );
    const now = Date.now();
    let result: unknown;
    this.ctx.storage.transactionSync(() => {
      const row = this.ctx.storage.sql
        .exec<{
          version: number;
          public_id: string;
          last_ms: number;
        }>("SELECT version,public_id,last_ms FROM entries WHERE subject=?", sub)
        .toArray()[0];
      if ((row?.version || 0) !== body.version)
        throw new RuleError(
          "Your portfolio changed in another tab. Reload the saved version before trying again.",
          409,
        );
      if (row && now - row.last_ms < 600)
        throw new RuleError("Please wait a moment before saving again.", 429);
      const id = row?.public_id || crypto.randomUUID(),
        version = (row?.version || 0) + 1,
        at = new Date(now).toISOString();
      this.ctx.storage.sql.exec(
        "INSERT INTO entries(subject,public_id,name,allocation,version,updated,last_ms) VALUES(?,?,?,?,?,?,?) ON CONFLICT(subject) DO UPDATE SET name=excluded.name,allocation=excluded.allocation,version=excluded.version,updated=excluded.updated,last_ms=excluded.last_ms",
        sub,
        id,
        name,
        JSON.stringify(allocation),
        version,
        at,
        now,
      );
      const revision = Number(this.meta("revision", "0")) + 1;
      this.put("revision", String(revision));
      const a = aggregate(this.all());
      this.ctx.storage.sql.exec(
        "INSERT INTO history(at,data) VALUES(?,?)",
        at,
        JSON.stringify({ totals: a.totals, pool: a.pool }),
      );
      result = {
        entry: { id, displayName: name, allocation, version, updatedAt: at },
        revision,
      };
      this.ctx.storage.sql.exec(
        "INSERT INTO receipts VALUES(?,?,?,?)",
        sub,
        body.requestId,
        fingerprint,
        JSON.stringify(result),
      );
    });
    await this.broadcast();
    return result;
  }
  private audit(actor: string, action: string, data: unknown) {
    this.ctx.storage.sql.exec(
      "INSERT INTO audit(at,actor,action,data) VALUES(?,?,?,?)",
      new Date().toISOString(),
      actor,
      action,
      JSON.stringify(data),
    );
  }
  async control(
    body: { phase: string; closesAt?: string; reason?: string },
    actor: string,
  ) {
    if (
      body.phase === "open" &&
      this.env.DEV_AUTH !== "local-only" &&
      (!roster.launchReady ||
        !this.env.GOOGLE_CLIENT_ID ||
        !this.env.SESSION_SECRET ||
        !this.env.ADMIN_SUB)
    )
      throw new RuleError(
        "Public opening requires reviewed candidate data and completed sign-in configuration.",
        409,
      );
    if (!["open", "paused", "closed"].includes(body.phase))
      throw new RuleError("Choose open, paused, or closed.");
    if (this.meta("settlement", ""))
      throw new RuleError("A settled market cannot be reopened.", 409);
    const prev = this.meta("phase", "setup");
    if (prev === "closed" && body.phase !== "closed")
      throw new RuleError("A closed market cannot be reopened or paused.", 409);
    const oldClose = this.meta("close", this.env.MARKET_CLOSE);
    if (body.closesAt) {
      if (!Number.isFinite(Date.parse(body.closesAt)))
        throw new RuleError("Use a valid closing date.");
      if (this.all().length > 0 && body.closesAt !== oldClose)
        throw new RuleError(
          "The deadline is frozen after the first entry.",
          409,
        );
    }
    if (
      (prev === "closed" || Date.now() >= Date.parse(oldClose)) &&
      body.phase === "open"
    )
      throw new RuleError("A closed market cannot be reopened.", 409);
    if (
      body.phase === "open" &&
      this.meta("roster", "") &&
      this.meta("roster", "") !== rosterIdentity
    )
      throw new RuleError(
        "Restore the frozen candidate roster before opening.",
        409,
      );
    this.ctx.storage.transactionSync(() => {
      this.put("phase", body.phase);
      if (body.phase === "open" && !this.meta("roster", ""))
        this.put("roster", rosterIdentity);
      if (body.closesAt) this.put("close", body.closesAt);
      this.audit(actor, "phase", {
        from: prev,
        to: body.phase,
        closesAt: body.closesAt || oldClose,
        reason: body.reason || "",
      });
      this.put("revision", String(Number(this.meta("revision", "0")) + 1));
    });
    if (body.phase === "open")
      await this.ctx.storage.setAlarm(
        Date.parse(this.meta("close", this.env.MARKET_CLOSE)),
      );
    await this.broadcast();
    return this.snapshot();
  }
  private checkedWinners(input: Winner[]) {
    return canonicalWinners(input, Object.fromEntries(roster.candidates.filter(c => c.eligible).map(c => [c.id, c.name])));
  }
  async preview(body: { winners: Winner[] }) {
    const winners = this.checkedWinners(body.winners);
    return {
      ...score(this.all(), winners),
      revision: Number(this.meta("revision", "0")),
    };
  }
  async settle(
    body: {
      winners: Winner[];
      source: string;
      reason: string;
      expectedRevision: number;
    },
    actor: string,
  ) {
    const winners = this.checkedWinners(body.winners),
      snapshot = await this.snapshot();
    if (!["closed", "settled"].includes(snapshot.phase))
      throw new RuleError("Close the market before settling.", 409);
    if (
      Date.now() < Date.parse(this.env.ANNOUNCEMENT) &&
      this.env.DEV_AUTH !== "local-only"
    )
      throw new RuleError(
        "Settlement opens at the scheduled prize announcement.",
        409,
      );
    if (body.expectedRevision !== snapshot.revision)
      throw new RuleError("The market changed. Preview settlement again.", 409);
    let source: URL;
    try {
      source = new URL(body.source);
    } catch {
      throw new RuleError("Add the official result URL.");
    }
    if (
      source.protocol !== "https:" ||
      !(
        source.hostname === "www.nobelprize.org" ||
        source.hostname === "nobelprize.org"
      )
    )
      throw new RuleError("Link the official NobelPrize.org result.");
    if (typeof body.reason !== "string" || body.reason.trim().length < 8)
      throw new RuleError("Record a short settlement or correction note.");
    const next = {
      winners,
      source: source.href,
      reason: body.reason.trim(),
      publishedAt: new Date().toISOString(),
      revision: (snapshot.settlement?.revision || 0) + 1,
    };
    this.ctx.storage.transactionSync(() => {
      if (Number(this.meta("revision", "0")) !== body.expectedRevision)
        throw new RuleError(
          "The market changed. Preview settlement again.",
          409,
        );
      this.audit(actor, "settlement", {
        previous: snapshot.settlement || null,
        next,
      });
      this.put("settlement", JSON.stringify(next));
      this.put("revision", String(snapshot.revision + 1));
    });
    await this.broadcast();
    return this.snapshot();
  }
  async exportData() {
    return {
      snapshot: await this.snapshot(),
      entries: this.all(),
      audit: this.ctx.storage.sql
        .exec("SELECT at,action,data FROM audit ORDER BY id")
        .toArray(),
      rosterVersion: roster.version,
    };
  }
  async fetch(req: Request) {
    if (this.ctx.getWebSockets().length >= 500)
      throw new RuleError(
        "Live connection capacity reached. Refresh for the latest market.",
        503,
      );
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify(await this.snapshot()));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message === "ping") socket.send("pong");
    else socket.close(1008, "Read-only market feed");
  }
  async alarm() {
    await this.broadcast();
  }
  private async broadcast() {
    const data = JSON.stringify(await this.snapshot());
    for (const s of this.ctx.getWebSockets())
      try {
        s.send(data);
      } catch {
        s.close(1011, "Reconnect");
      }
  }
}
