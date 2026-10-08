import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Globe2,
  HelpCircle,
  Layers3,
  LogOut,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
  WifiOff,
  Download,
} from "lucide-react";
import roster from "virtual:nobel-roster";
import type {
  Allocation,
  Candidate,
  Entry,
  Session,
  Snapshot,
  Winner,
  ContenderGroup,
} from "../shared/types";
import { projectedPayout, score } from "../shared/rules";
import { crowdRanking } from "../shared/market";
import { portfolioSaveState } from "../shared/portfolio";
import { belongsToMarket, marketForPage } from "../shared/markets";
import { authDigest, authReturnFragment, prefersRedirectSignIn, randomAuthValue, redirectStorageKey, validRedirectDraft } from "../shared/redirect-auth";
import type { RedirectDraft } from "../shared/redirect-auth";
import { MarketPulse } from "./MarketPulse";
import { catalogCandidates, contenderGroups, groupOrder, evidenceKinds, leadEvidence } from "../shared/catalog";

const candidates = roster.candidates as Candidate[];
const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
const fields = [...new Set(candidates.map((c) => c.field))];
const colors: Record<string, string> = {
  "Macro & growth": "#9a7837",
  Finance: "#496c73",
  "Trade & geography": "#52735f",
  "Theory & markets": "#756594",
  Econometrics: "#47768f",
  "Behavior & society": "#b46f52",
  "Labor & opportunity": "#997a87",
  Innovation: "#8b8353",
  Environment: "#54887c",
  "IO & digital": "#786b4a",
  "Urban & spatial": "#547a71",
  "Political economy": "#886359",
};
const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const selectedMarket = marketForPage(location.pathname);
if (!selectedMarket) throw new Error("Unknown Nobel Exchange market address.");
const activeMarket = selectedMarket;
const redirectKey = redirectStorageKey(activeMarket);
const mobileRedirect = prefersRedirectSignIn(navigator.userAgent, navigator.maxTouchPoints);
const loginReturn = authReturnFragment(location.hash);
// Remove the one-use code before Google scripts or any links can observe it.
if (location.hash.startsWith("#signin=")) history.replaceState(null, "", location.pathname + location.search);
function storedRedirectDraft(): RedirectDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(redirectKey) || "null");
    return validRedirectDraft(value, activeMarket) ? value : null;
  } catch { return null; }
}
const initialRedirectDraft = storedRedirectDraft();
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const initials = (n: string) =>
  n
    .split(" ")
    .filter((s) => s.length > 1)
    .filter(
      (s) =>
        !["M.", "A.", "B.", "C.", "D.", "F.", "G.", "H.", "J.", "W."].includes(
          s,
        ),
    )
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 1)
    .join("") + n.split(" ").at(-1)![0];
const sums = (a: Allocation) => Object.values(a).reduce((s, n) => s + n, 0);
const same = (a: Allocation, b: Allocation) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort());
const empty: Snapshot = {
  marketId: activeMarket.id,
  phase: "setup",
  closesAt: "2026-10-12T00:00:00Z",
  announcement: "2026-10-12T09:45:00Z",
  serverTime: new Date().toISOString(),
  revision: 0,
  participants: 0,
  pool: 0,
  totals: {},
  supporters: {},
  history: [],
};
async function request(
  path: string,
  options: RequestInit = {},
  token?: string,
) {
  const response = await fetch(apiBase + activeMarket.apiPrefix + path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  const responseMarket = response.headers.get("X-Nobel-Market");
  if (responseMarket !== activeMarket.id && !(responseMarket === null && activeMarket.id === "original"))
    throw new Error("The server returned a different market. Please refresh before saving.");
  if (!response.ok)
    throw Object.assign(
      new Error(body.error || "This request could not be completed."),
      { status: response.status },
    );
  return body;
}
function Sparkline({
  points,
  color = "#94752f",
  times,
  ceiling,
}: {
  points: number[];
  color?: string;
  times?: number[];
  ceiling?: number;
}) {
  const max = ceiling ?? Math.max(...points, 1),
    min = Math.min(...points, 0);
  const x = (i: number) =>
    times && times.length === points.length
      ? ((times[i] - times[0]) / (times[times.length - 1] - times[0] || 1)) *
        100
      : (i * 100) / (points.length - 1 || 1);
  return (
    <svg className="sparkline" viewBox="0 0 100 30" aria-hidden="true">
      <path
        d={points
          .map((p, i) => {
            const y = 27 - ((p - min) / (max - min || 1)) * 24;
            if (i === 0) return `M${x(i)},${y}`;
            return times ? `H${x(i)} V${y}` : `L${x(i)},${y}`;
          })
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const f = () => onClose();
    d.addEventListener("cancel", f);
    return () => {
      d.removeEventListener("cancel", f);
      d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={wide ? "modal wide" : "modal"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [view, setView] = useState(
      location.hash === "#results" ? "Results" : "Market",
    ),
    [query, setQuery] = useState(""),
    [field, setField] = useState("All fields"),
    [sort, setSort] = useState("Featured"),
    [group, setGroup] = useState<ContenderGroup | "all">("all"),
    [showAllLeaders, setShowAllLeaders] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  const [market, setMarket] = useState<Snapshot>(empty),
    [connection, setConnection] = useState("Connecting"),
    [config, setConfig] = useState<any>({});
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(activeMarket.sessionKey) || "null");
    } catch {
      return null;
    }
  });
  const [entry, setEntry] = useState<Entry | null>(null),
    [draft, setDraft] = useState<Allocation>(initialRedirectDraft?.allocation || {}),
    [name, setName] = useState(initialRedirectDraft?.displayName || ""),
    [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Candidate | null>(null),
    [modal, setModal] = useState(""),
    [tray, setTray] = useState(false),
    [clock, setClock] = useState(Date.now());
  const [adminPreview, setAdminPreview] = useState<any>(null),
    [winners, setWinners] = useState<Winner[]>([{ candidateId: "", share: 1 }]),
    [official, setOfficial] = useState(""),
    [reason, setReason] = useState("");
  const googleMount = useRef<HTMLDivElement>(null),
    redirectHandled = useRef(false),
    redirectRestore = useRef<RedirectDraft | null>(null),
    pendingSave = useRef<{ body: string; id: string } | null>(null),
    lastRevision = useRef(-1),
    serverOffset = useRef(0);
  const receive = (data: Snapshot) => {
    if (!belongsToMarket(data, activeMarket))
      throw new Error("The live feed belongs to a different market.");
    if (data.revision < lastRevision.current) return;
    lastRevision.current = data.revision;
    serverOffset.current = Date.parse(data.serverTime) - Date.now();
    setMarket(data);
  };
  useEffect(() => {
    let stopped = false,
      ws: WebSocket | undefined,
      reconnect: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const load = () =>
      request("/market")
        .then((s) => {
          if (!stopped) {
            receive(s);
            setConnection((c) => (c === "Live" ? "Live" : "Updated"));
          }
        })
        .catch(() => {
          if (!stopped) setConnection("Offline");
        });
    request("/config")
      .then((c) => !stopped && setConfig(c))
      .catch(() => {});
    load();
    const connect = () => {
      if (stopped) return;
      const url = new URL(apiBase + activeMarket.apiPrefix + "/live", location.origin);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(url);
      ws.onopen = () => {
        attempts = 0;
        setConnection("Live");
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        try {
          receive(JSON.parse(e.data));
          setConnection("Live");
        } catch {}
      };
      ws.onerror = () => ws?.close();
      ws.onclose = () => {
        if (stopped) return;
        setConnection("Reconnecting");
        reconnect = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** attempts++),
        );
      };
    };
    connect();
    const poll = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) load();
      else ws.send("ping");
    }, 30000);
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      clearInterval(poll);
      clearInterval(timer);
      ws?.close();
    };
  }, []);
  useEffect(() => {
    if (!loginReturn || redirectHandled.current) return;
    redirectHandled.current = true;
    const pending = storedRedirectDraft();
    if (!pending || pending.flowId !== loginReturn.flowId) {
      setError("This sign-in started in another browser or expired. Open the game directly in Safari and sign in again.");
      return;
    }
    setBusy(true);
    request("/auth/redeem", {method:"POST",body:JSON.stringify({
      flowId:pending.flowId, code:loginReturn.code, verifier:pending.verifier,
    })}).then((s: Session) => {
      redirectRestore.current = pending;
      sessionStorage.removeItem(redirectKey);
      setSession(s);
      setView("My portfolio");
      setNotice("Signed in. Your draft is ready; save it to enter this group.");
    }).catch(e => setError(e.message)).finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    setLoaded(false);
    if (!session) {
      setEntry(null);
      setLoaded(true);
      return;
    }
    sessionStorage.setItem(activeMarket.sessionKey, JSON.stringify(session));
    request("/me", {}, session.token)
      .then(({ entry: e, admin }) => {
        setEntry(e);
        const restored = redirectRestore.current;
        if (restored) {
          setDraft(Object.keys(restored.allocation).length ? restored.allocation : e?.allocation || {});
          setName(restored.displayName || e?.displayName || session.displayName);
          redirectRestore.current = null;
        } else {
          if (e) setDraft(e.allocation);
          setName((n) => e?.displayName || n || session.displayName);
        }
        setSession((s) => (s && s.admin !== admin ? { ...s, admin } : s));
        setLoaded(true);
      })
      .catch((e) => {
        setError(e.message);
        setLoaded(true);
        if (e.status === 401) {
          sessionStorage.removeItem(activeMarket.sessionKey);
          setSession(null);
        }
      });
  }, [session?.token]);
  useEffect(() => {
    if (modal !== "signin" || !config.googleClientId || mobileRedirect) return;
    const render = () => {
      const google = (window as any).google;
      if (!google || !googleMount.current) return;
      google.accounts.id.initialize({
        client_id: config.googleClientId,
        callback: async (r: any) => {
          try {
            const s = await request("/auth/google", {
              method: "POST",
              body: JSON.stringify({ credential: r.credential }),
            });
            setSession(s);
            setModal("");
            setNotice(
              "Signed in. Choose your display name and save when your 100 credits are ready.",
            );
          } catch (e: any) {
            setError(e.message);
          }
        },
      });
      google.accounts.id.renderButton(googleMount.current, {
        theme: "outline",
        size: "large",
        width: 280,
      });
    };
    if ((window as any).google) render();
    else {
      let script =
        document.querySelector<HTMLScriptElement>("#google-identity");
      if (!script) {
        script = document.createElement("script");
        script.id = "google-identity";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        document.head.append(script);
      }
      script.addEventListener("load", render, { once: true });
      const failed = () => setError("Google’s login button couldn’t load. Try full-page sign-in below, or open the game directly in Safari.");
      script.addEventListener("error", failed, {once:true});
      return () => {script?.removeEventListener("load", render); script?.removeEventListener("error", failed);};
    }
  }, [modal, config.googleClientId]);
  async function beginRedirectSignIn() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const verifier = randomAuthValue();
      const flow = await request("/auth/redirect", {method:"POST", body:JSON.stringify({challenge:await authDigest(verifier)})});
      const loginUrl = new URL(flow.loginUrl);
      // The login page must remain on this configured API, in this exact group.
      if (loginUrl.origin !== new URL(apiBase || location.origin).origin ||
          loginUrl.pathname !== activeMarket.apiPrefix + "/auth/login")
        throw new Error("Invalid sign-in address. Please refresh the game.");
      sessionStorage.setItem(redirectKey, JSON.stringify({marketId:activeMarket.id, flowId:flow.flowId,
        verifier, allocation:draft, displayName:name, createdAt:Date.now()} satisfies RedirectDraft));
      location.assign(loginUrl.href);
    } catch(e: any) {setError(e.message); setBusy(false);}
  }
  const total = sums(draft),
    picks = Object.keys(draft).length,
    remaining = 100 - total,
    dirty =
      !entry || !same(entry.allocation, draft) || entry.displayName !== name;
  const closed =
    ["closed", "settled"].includes(market.phase) ||
    clock + serverOffset.current >= Date.parse(market.closesAt);
  const saveState = portfolioSaveState({busy,closed,loaded,phase:market.phase,total,picks,signedIn:Boolean(session),displayName:name,dirty});
  const seconds = Math.max(
    0,
    Math.floor(
      (Date.parse(market.closesAt) - clock - serverOffset.current) / 1000,
    ),
  );
  const countdown = `${Math.floor(seconds / 86400)}d ${Math.floor(seconds / 3600) % 24}h ${Math.floor(seconds / 60) % 60}m`;
  const setAmount = (id: string, n: number) => {
    setNotice("");
    if (!draft[id] && picks >= 10) {
      setError(
        "Your portfolio can include up to 10 economists. Remove a pick first.",
      );
      return;
    }
    setDraft((d) => {
      const a = { ...d };
      const amount = Math.max(0, Math.min(100, Math.floor(Number(n) || 0)));
      if (amount) a[id] = amount;
      else delete a[id];
      return a;
    });
  };
  const add = (id: string) => {
    if (closed) return;
    setAmount(id, (draft[id] || 0) + Math.max(0, Math.min(10, remaining)));
  };
  const displayed = useMemo(
    () => catalogCandidates(candidates, { query, field, group, sort, totals: market.totals }),
    [query, field, group, sort, market.totals],
  );
  async function save() {
    if (!session) {
      setModal("signin");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    const body = JSON.stringify({
      allocation: draft,
      displayName: name,
      version: entry?.version || 0,
    });
    if (pendingSave.current?.body !== body)
      pendingSave.current = { body, id: crypto.randomUUID() };
    try {
      const result = await request(
        "/portfolio",
        {
          method: "PUT",
          body: JSON.stringify({
            ...JSON.parse(body),
            requestId: pendingSave.current.id,
          }),
        },
        session.token,
      );
      setEntry(result.entry);
      setDraft(result.entry.allocation);
      setName(result.entry.displayName);
      pendingSave.current = null;
      setNotice("Portfolio saved. Your credits are now in the shared market.");
      request("/market").then(receive);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    try {
      const r = await request("/me", {}, session?.token);
      setEntry(r.entry);
      setDraft(r.entry?.allocation || {});
      setName(r.entry?.displayName || name);
      setError("");
      setNotice("Loaded your latest saved portfolio.");
      pendingSave.current = null;
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function adminCall(path: string, data: any) {
    setBusy(true);
    setError("");
    try {
      const result = await request(
        "/admin/" + path,
        { method: "POST", body: JSON.stringify(data) },
        session?.token,
      );
      if (path === "settlement-preview") setAdminPreview(result);
      else {
        receive(result);
        setAdminPreview(null);
        setNotice("Administrator update saved.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const portfolio = (full = false) => (
    <section
      className={"portfolio " + (full ? "portfolio-full" : "")}
      aria-label="Portfolio editor"
    >
      <div className="portfolio-head">
        <div>
          <span className="eyebrow">YOUR LITTLE HEDGE FUND</span>
          <h2>
            My portfolio <span className="count-pill">{picks}/10</span>
          </h2>
        </div>
        <Coins size={25} />
      </div>
      <div className="credit-line">
        <strong className={remaining < 0 ? "danger-text" : ""}>
          {remaining}
        </strong>
        <span>
          credits left <small>of 100 imaginary credits</small>
        </span>
        <span
          className="credit-ring"
          style={{
            background: `conic-gradient(var(--gold) ${Math.min(total, 100)}%,var(--line) 0)`,
          }}
        >
          <span>{total}</span>
        </span>
      </div>
      <div className="budget-track">
        <i style={{ width: Math.min(100, total) + "%" }} />
      </div>
      {!picks ? (
        <div className="empty-portfolio">
          <Layers3 size={30} />
          <h3>Great minds. Your picks.</h3>
          <p>
            Add a few economists, split your 100 credits, and make your case.
          </p>
          <span>1–10 picks · whole credits only</span>
        </div>
      ) : (
        <div className="allocations">
          {Object.entries(draft).map(([id, n]) => (
            <div className="allocation" key={id}>
              <button
                className="allocation-person"
                onClick={() => setDetail(byId[id])}
              >
                <span
                  className="mini-avatar"
                  style={{ background: colors[byId[id]?.field] }}
                >
                  {initials(byId[id]?.name || id)}
                </span>
                <span>
                  <strong>{byId[id]?.name || id}</strong>
                  <small>
                    If sole winner:{" "}
                    {fmt.format(
                      projectedPayout(market, entry?.allocation, draft, id),
                    )}{" "}
                    pts
                  </small>
                </span>
              </button>
              <div className="stepper">
                <button
                  disabled={closed}
                  aria-label={`Subtract one credit from ${byId[id]?.name}`}
                  onClick={() => setAmount(id, n - 1)}
                >
                  <Minus size={13} />
                </button>
                <input
                  disabled={closed}
                  aria-label={`Credits for ${byId[id]?.name}`}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="100"
                  value={n}
                  onChange={(e) => setAmount(id, +e.target.value)}
                />
                <button
                  disabled={closed}
                  aria-label={`Add one credit to ${byId[id]?.name}`}
                  onClick={() => setAmount(id, n + 1)}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {picks > 0 && !closed && (
        <button
          className="text-button equal"
          onClick={() => {
            const keys = Object.keys(draft);
            setDraft(
              Object.fromEntries(
                keys.map((id, i) => [
                  id,
                  Math.floor(100 / keys.length) +
                    (i < 100 % keys.length ? 1 : 0),
                ]),
              ),
            );
          }}
        >
          Split evenly across my picks
        </button>
      )}
      <label className="display-label">
        Public display name
        <input
          placeholder="e.g. The Invisible Hands"
          maxLength={36}
          value={name}
          disabled={closed}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="primary save-button"
        disabled={saveState.disabled}
        aria-describedby={full ? "portfolio-save-help-full" : "portfolio-save-help"}
        onClick={save}
      >
        {busy
          ? "Saving…"
          : closed
            ? "Portfolio locked"
            : !session
              ? "Sign in & save"
              : !dirty
                ? "All changes saved"
                : "Save portfolio"}
        {!busy && <ArrowRight size={16} />}
      </button>
      <p className="save-guidance" id={full ? "portfolio-save-help-full" : "portfolio-save-help"} aria-live="polite">
        {saveState.message}
      </p>
      <p className="save-note">
        {entry ? (
          <>
            <Check size={13} /> Saved · version {entry.version}
            {dirty ? " · unsaved changes" : ""}
          </>
        ) : (
          <>Private until the market closes. Edit anytime before then.</>
        )}
      </p>
      {entry && dirty && (
        <button className="text-button" onClick={reload}>
          Discard draft / load latest saved version
        </button>
      )}
      <div className="payout-note">
        <Sparkles size={16} />
        <p>
          Back the winner with a smaller crowd, earn a larger share. Estimates
          include your draft and float until closing. Shared prizes reduce the
          payout.
        </p>
      </div>
    </section>
  );
  const candidateRow = (c: Candidate) => {
    const evidence = leadEvidence(c);
    const backing = market.pool
      ? ((market.totals[c.id] || 0) / market.pool) * 100
      : 0;
    return (
      <li
        className={"candidate-row " + (draft[c.id] ? "chosen" : "")}
        key={c.id}
        style={{ "--field": colors[c.field] } as any}
      >
        <button
          className="row-person"
          aria-label={`View research and sources for ${c.name}`}
          onClick={() => setDetail(c)}
        >
          <span className="row-avatar" aria-hidden="true">
            {initials(c.name)}
          </span>
          <span className="row-identity">
            <span className="row-name">
              {c.name} <ArrowUpRight size={12} />
            </span>
            <span className="row-institution" title={c.institution}>
              {c.institution
                .replace("Massachusetts Institute of Technology", "MIT")
                .replace("University of California,", "UC")
                .replace("University of Pennsylvania", "Penn")}
            </span>
            <span className="row-mobile-field"><i />{c.field}</span>
            <span className={"row-editorial group-" + c.editorial.group}>
              <span>{contenderGroups[c.editorial.group].short}</span>
              <span className="row-evidence" title={`${evidenceKinds[evidence.kind]} · ${evidence.note}`}>
                {evidence.label} · {evidence.dateLabel}
              </span>
            </span>
          </span>
        </button>
        <span className="row-field"><i />{c.field}</span>
        <div className={"row-backing " + (!backing ? "unbacked" : "")}>
          <strong aria-label={`${backing.toFixed(1)} percent of allocated credits`}>
            {backing.toFixed(1)}%
          </strong>
          <small>{market.supporters[c.id] || 0} {market.supporters[c.id] === 1 ? "backer" : "backers"}</small>
        </div>
        <div className="row-allocation">
          {draft[c.id] ? (
            <div className="stepper row-stepper">
              <button
                disabled={closed}
                aria-label={`Subtract one credit from ${c.name}`}
                onClick={() => setAmount(c.id, draft[c.id] - 1)}
              >
                <Minus size={14} />
              </button>
              <input
                disabled={closed}
                aria-label={`Market credits for ${c.name}`}
                inputMode="numeric"
                type="number"
                min="0"
                max="100"
                value={draft[c.id]}
                onChange={(e) => setAmount(c.id, +e.target.value)}
              />
              <button
                disabled={closed || remaining <= 0}
                aria-label={`Add one credit to ${c.name}`}
                onClick={() => setAmount(c.id, draft[c.id] + 1)}
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <button
              className="row-add"
              aria-label={`Back ${c.name} with ${Math.min(10, Math.max(0, remaining))} credits`}
              disabled={closed || remaining <= 0 || picks >= 10}
              onClick={() => add(c.id)}
            >
              <Plus size={14} /> Back
            </button>
          )}
        </div>
      </li>
    );
  };
  const final =
    market.settlement && market.entries
      ? score(market.entries, market.settlement.winners)
      : null;
  const leaders = crowdRanking(candidates, market);
  const ranked = leaders.map((row) => row.candidate);
  return (
    <>
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      {config.development && (
        <div className="preview-banner">
          LOCAL PREVIEW · Test accounts and sample portfolios only · Nothing is
          published
        </div>
      )}
      <header>
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setView("Market");
            }}
          >
            <span className="brand-mark">
              N<span>✳</span>
            </span>
            <span>
              The Nobel Exchange<small>ECONOMICS · 2026 <span className="market-label">{activeMarket.label}</span></small>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {["Market", "My portfolio", "Crowd", "Results"].map((v) => (
              <button
                key={v}
                aria-current={view === v ? "page" : undefined}
                onClick={() => {
                  setView(v);
                  setTray(false);
                }}
              >
                {v}
                {v === "My portfolio" && picks > 0 && (
                  <span className="nav-count">{picks}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="How to play"
              onClick={() => setModal("rules")}
            >
              <HelpCircle size={20} />
            </button>
            {session ? (
              <button className="sign-in" onClick={() => setModal("account")}>
                <span className="user-dot">{name.slice(0, 1) || "U"}</span>
                <span>{name || "Account"}</span>
              </button>
            ) : (
              <button className="sign-in" aria-label="Join the exchange" onClick={() => setModal("signin")}>
                <span className="join-full">Join the exchange</span>
                <span className="join-short">Join</span>
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="content">
        <div className="market-strip">
          <span className="edition-label">
            {activeMarket.label.toUpperCase()} · INDEPENDENT PICKS & PRIZE POOL
          </span>
          <span
            className={
              "connection " + (connection === "Live" ? "connected" : "")
            }
          >
            <i />
            {connection === "Offline" ? <WifiOff size={13} /> : null}
            {connection} <span className="strip-sep">/</span>{" "}
            {closed
              ? "Entries closed"
              : market.phase === "open"
                ? `Closes in ${countdown}`
                : market.phase === "paused"
                  ? "Entries paused"
                  : "Opening soon"}
          </span>
        </div>
        {error && (
          <div className="alert error" role="alert">
            <span>{error}</span>
            <button className="text-button" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {notice && (
          <div className="alert success" role="status">
            <Check size={16} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss message"
              className="icon-button"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {view === "Market" && (
          <>
            <section className="market-intro">
              <div>
                <h1>
                  Big ideas. <em>Bragging rights.</em>
                </h1>
                <p>
                  Split 100 imaginary credits among 1–10 economists.
                  <button className="text-button" onClick={() => setModal("rules")}>
                    How to play <ArrowUpRight size={12} />
                  </button>
                </p>
              </div>
              <div className="market-summary" aria-label="Market statistics">
                <span><strong>{candidates.length}</strong> economists</span>
                <span><strong>{market.participants}</strong> players</span>
                <span><strong>{fmt.format(market.pool)}</strong> point pool</span>
                <span className="market-deadline">Closes {new Date(market.closesAt).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", timeZone: "America/New_York",
                })} · {new Date(market.closesAt).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
                })} ET</span>
                <button className="text-button crowd-shortcut" onClick={() => setView("Crowd")}>
                  <TrendingUp size={13} /> Crowd leaderboard <ArrowRight size={12} />
                </button>
              </div>
            </section>
            {(market.rosterUpdates || []).map(update => (
              <aside className="roster-update" key={update.version} aria-label="Candidate list update">
                <strong>Candidate update · {new Date(update.at).toLocaleDateString("en-US", {month:"short",day:"numeric",timeZone:"America/New_York"})}</strong>
                <span>Added {update.additions.map(c=>c.name).join(", ")}. Existing picks are unchanged; you can revise yours until closing.</span>
              </aside>
            ))}
            <div className="market-layout">
              <div className="candidate-area">
                <div className="search-sort">
                  <label className="search">
                    <Search size={18} />
                    <input
                      placeholder="Find an economist, field, or big idea…"
                      aria-label="Search economists"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <label className="sort field-select">
                    <span className="sr-only">Filter by research field</span>
                    <select
                      aria-label="Filter by research field"
                      value={field}
                      onChange={(e) => setField(e.target.value)}
                    >
                      {["All fields", ...fields].map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  <label className="sort group-select">
                    <span className="sr-only">Filter by contender group</span>
                    <select aria-label="Filter by contender group" value={group}
                      onChange={(e) => setGroup(e.target.value as ContenderGroup | "all")}>
                      <option value="all">All contenders · {candidates.length}</option>
                      {groupOrder.map((g) => <option key={g} value={g}>{contenderGroups[g].label} · {candidates.filter((c) => c.editorial.group === g).length}</option>)}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  <label className="sort">
                    <span className="sr-only">Sort candidates</span>
                    <select
                      aria-label="Sort candidates"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      {["Featured", "Crowd backing", "Name", "Citations"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                <div className="catalog-caption">
                  <span>{displayed.length === candidates.length ? `${candidates.length} economists` : `${displayed.length} of ${candidates.length} economists`} · Tap a name for research & sources.</span>
                  <button className="text-button" onClick={() => setModal("sources")}>Editorial pool <ArrowUpRight size={12} /></button>
                </div>
                {group !== "all" && <p className="group-explanation">{contenderGroups[group].explanation} <span>Editorial judgment, not odds.</span></p>}
                <div className="candidate-list-head" aria-hidden="true">
                  <span>Economist</span><span>Field</span><span>Crowd backing</span><span>Your credits</span>
                </div>
                <ul className="candidate-list" aria-label="Economists">{displayed.map(candidateRow)}</ul>
                <p className="catalog-note list-note">
                  Backing is a share of allocated credits, not a winning probability.
                  Featured puts mature prize cases first, then the broader watchlist, future picks and outsiders—an editorial order, not odds.
                </p>
                {!displayed.length && (
                  <div className="empty-state">
                    <Search />
                    <h3>No economists found</h3>
                    <p>Try a different name or reset the field filter.</p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setField("All fields");
                        setGroup("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
              <aside className="desktop-portfolio">{portfolio()}</aside>
            </div>
          </>
        )}
        {view === "My portfolio" && (
          <>
            <PageHeading
              eyebrow="YOUR 100-CREDIT THESIS"
              title="Conviction, allocated."
              text="Your saved allocation counts. Your draft lets you see what would change before you commit."
            />
            <div className="portfolio-page">
              {portfolio(true)}
              <section className="explainer-panel">
                <span className="eyebrow">KNOW YOUR RETURN</span>
                <h2>A share of the glory.</h2>
                <p>
                  The pool is 100 points for each submitted player. A laureate’s
                  official share goes to their backers, in proportion to the
                  credits they put behind that person.
                </p>
                <div className="example">
                  <span>100 players → 10,000 points</span>
                  <strong>
                    10% of a sole winner’s backing
                    <br />= 1,000 points
                  </strong>
                  <span>Half the Nobel share? Then 500 points.</span>
                </div>
                <p>
                  These are alternative winning scenarios, not amounts to add
                  together. Other players’ edits and new entries change
                  estimates until closing.
                </p>
                <p>
                  No money changes hands. No shares are bought or sold. Being
                  early does not lock in a price.
                </p>
                <button
                  className="text-button"
                  onClick={() => setView("Market")}
                >
                  Back to the market <ArrowRight size={16} />
                </button>
              </section>
            </div>
          </>
        )}
        {view === "Crowd" && (
          <>
            <section className="crowd-heading">
              <div>
                <h1>The crowd’s picks.</h1>
                <p>Live backing from saved portfolios—not winning probabilities.</p>
              </div>
              <button className="text-button" onClick={() => setView("Results")}>
                {closed ? "Player portfolios & results" : "Player leaderboard after the result"}
                <ArrowRight size={14} />
              </button>
            </section>
            <section className="crowd-panel" aria-label="Crowd leaderboard">
              <div className="crowd-summary">
                <span><strong>{market.participants}</strong> {market.participants === 1 ? "player" : "players"}</span>
                <span><strong>{ranked.length}</strong> economists backed</span>
                <span><strong>{fmt.format(market.pool)}</strong> points in the pool</span>
                <span className="crowd-privacy">{closed ? "Locked player portfolios now public" : "Individual picks private until closing"}</span>
              </div>
              {leaders.length ? (
                <>
                  <table className="crowd-table">
                    <caption className="sr-only">Economists ranked by total saved credits. Equal backing shares a rank.</caption>
                    <thead>
                      <tr><th scope="col">Rank</th><th scope="col">Economist</th><th scope="col">Backing</th><th scope="col">Backers</th><th scope="col" className="crowd-change">Δ share</th></tr>
                    </thead>
                    <tbody>
                      {(showAllLeaders ? leaders : leaders.slice(0, 10)).map(({candidate: c, rank, credits, share, backers, change}) => (
                        <tr key={c.id}>
                          <td className="crowd-rank">{rank}</td>
                          <td>
                            <button className="crowd-person" onClick={() => setDetail(c)} aria-label={`View research and sources for ${c.name}`}>
                              <span>{c.name}</span><ArrowUpRight size={12} />
                            </button>
                            <span className="crowd-field" style={{"--field": colors[c.field]} as any}><i />{c.field}</span>
                          </td>
                          <td className="crowd-share" title={`${credits} saved credits`}>
                            <strong>{share.toFixed(1)}%</strong>
                            <span className="crowd-share-track" aria-hidden="true"><i style={{width: `${share}%`, background: colors[c.field]}} /></span>
                          </td>
                          <td className="crowd-backers">{backers}</td>
                          <td className={"crowd-change " + (change && Math.abs(change) >= 0.05 ? (change > 0 ? "positive" : "negative") : "muted")}>
                            {change === null ? "—" : `${Math.abs(change) < 0.05 ? "0.0" : (change > 0 ? "+" : "") + change.toFixed(1)} pp`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {leaders.length > 10 && (
                    <button className="text-button crowd-expand" onClick={() => setShowAllLeaders(!showAllLeaders)}>
                      {showAllLeaders ? "Show top 10" : `Show all ${leaders.length} backed economists`} <ChevronDown size={14} />
                    </button>
                  )}
                  <p className="crowd-table-note">Backing is the share of all saved credits. Ties share a rank. <span className="crowd-change">Δ share compares the last two portfolio updates, in percentage points.</span> Unsaved drafts do not affect this table.</p>
                </>
              ) : (
                <div className="empty-state"><Users /><h3>No portfolios saved yet</h3><p>The first submitted portfolio starts the crowd leaderboard.</p><button onClick={() => setView("Market")}>Make your picks <ArrowRight size={14} /></button></div>
              )}
            </section>
            <MarketPulse candidates={candidates} market={market} colors={colors}
              onField={(f) => { setView("Market"); setField(f); setQuery(""); setGroup("all"); }}
              onPortfolio={() => setView("My portfolio")} />
            <details className="crowd-explore">
              <summary>Backing history & changing minds</summary>
            <div className="explore-grid">
              <section className="panel">
                <div className="panel-title">
                  <h2>Backing over time</h2>
                  <Layers3 size={22} />
                </div>
                {market.history.length > 1 ? (
                  <>
                    <div className="history-chart">
                      {ranked.slice(0, 4).map((c) => (
                        <div className="history-row" key={c.id}>
                          <span>
                            <i style={{ background: colors[c.field] }} />
                            {c.name}
                          </span>
                          <Sparkline
                            color={colors[c.field]}
                            times={market.history.map((h) => Date.parse(h.at))}
                            ceiling={100}
                            points={market.history.map((h) =>
                              h.pool
                                ? ((h.totals[c.id] || 0) / h.pool) * 100
                                : 0,
                            )}
                          />
                          <strong>
                            {(
                              ((market.totals[c.id] || 0) / market.pool) *
                              100
                            ).toFixed(1)}
                            %
                          </strong>
                        </div>
                      ))}
                    </div>
                    <p className="muted">
                      Share of all credits at each saved market update. Last{" "}
                      {market.history.length} updates. All rows use the same
                      0–100% scale; horizontal position is elapsed time and
                      changes are steps.{" "}
                      {new Date(market.history[0].at).toLocaleString()} —{" "}
                      {new Date(market.history.at(-1)!.at).toLocaleString()}{" "}
                      (your local time).
                    </p>
                    <details>
                      <summary>View the data table</summary>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Time (UTC)</th>
                              {ranked.slice(0, 4).map((c) => (
                                <th key={c.id}>{c.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {market.history.map((h, i) => (
                              <tr key={i}>
                                <td>
                                  {new Date(h.at)
                                    .toISOString()
                                    .slice(0, 19)
                                    .replace("T", " ")}
                                </td>
                                {ranked.slice(0, 4).map((c) => (
                                  <td key={c.id}>
                                    {h.pool
                                      ? (
                                          ((h.totals[c.id] || 0) / h.pool) *
                                          100
                                        ).toFixed(1)
                                      : 0}
                                    %
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                ) : (
                  <p className="empty-state">
                    A history begins with the first two saved portfolios.
                  </p>
                )}
              </section>
              <section className="panel">
                <div className="panel-title">
                  <h2>Changing minds</h2>
                  <Sparkles size={22} />
                </div>
                <p className="muted">
                  Largest percentage-point changes since the earliest retained
                  market update.
                </p>
                {market.history.length > 1 ? (
                  candidates
                    .map((c) => {
                      const first = market.history[0];
                      return {
                        c,
                        delta:
                          (market.pool
                            ? (market.totals[c.id] || 0) / market.pool
                            : 0) -
                          (first.pool
                            ? (first.totals[c.id] || 0) / first.pool
                            : 0),
                      };
                    })
                    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                    .filter(({ delta }) => Math.abs(delta) > 0.00001)
                    .slice(0, 5)
                    .map(({ c, delta }) => (
                      <button
                        className="mover"
                        key={c.id}
                        onClick={() => setDetail(c)}
                      >
                        <span>{c.name}</span>
                        <strong
                          className={delta >= 0 ? "positive" : "negative"}
                        >
                          {delta >= 0 ? "+" : ""}
                          {(delta * 100).toFixed(1)} pp
                        </strong>
                      </button>
                    ))
                ) : (
                  <p className="empty-state">
                    Watch this space as portfolios change.
                  </p>
                )}
              </section>
            </div>
            </details>
          </>
        )}
        {view === "Results" && (
          <>
            <PageHeading
              eyebrow="THE CALL FROM STOCKHOLM"
              title={
                final ? "And the points go to…" : "The best is yet to come."
              }
              text={
                final
                  ? "Official prize shares, transparent scoring, and a little well-earned bragging."
                  : "Prize announcement: Monday, October 12, 5:45 am Eastern at the earliest."
              }
            />
            {!closed ? (
              <div className="results-wait">
                <div className="results-icon">
                  <Trophy size={42} />
                </div>
                <h2>Let the ideas compete.</h2>
                <p>
                  Individual portfolios stay private until closing.
                  <br />
                  After the announcement, Simon will enter the official result.
                </p>
                <button className="primary" onClick={() => setView("Market")}>
                  Explore the market <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="settlement-summary">
                  {market.settlement ? (
                    <>
                      <h2>
                        {market.settlement.winners
                          .map(
                            (w) =>
                              `${byId[w.candidateId]?.name || w.name || w.candidateId} · ${fmt.format(w.share * 100)}%`,
                          )
                          .join(" / ")}
                      </h2>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={market.settlement.source}
                      >
                        Official result <ArrowUpRight size={14} />
                      </a>
                      <p>
                        Settlement revision {market.settlement.revision} ·{" "}
                        {market.settlement.reason}
                      </p>
                      <p>
                        {final!.unawarded === 0 ? "All points awarded." : `${fmt.format(final!.unawarded)} points unawarded because those laureates had no backers.`}
                        {final!.pool > 0 && final!.unawarded === final!.pool &&
                          " Nobody backed a winner this time."}
                      </p>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              `${location.origin}${activeMarket.path}#results`,
                            );
                            setNotice("Results link copied.");
                          } catch {
                            setNotice(
                              "Share this page’s address to share the results.",
                            );
                          }
                        }}
                      >
                        Copy leaderboard link <ArrowUpRight size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <h2>Portfolios are locked.</h2>
                      <p>
                        The official result has not been published in this game
                        yet.
                      </p>
                    </>
                  )}
                </div>
                <div className="table-scroll panel">
                  <table className="leaderboard">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Portfolio</th>
                        <th>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        final?.rows ||
                        market.entries?.map((e) => ({
                          ...e,
                          rank: 0,
                          points: 0,
                        })) ||
                        []
                      ).map((r) => (
                        <tr key={r.id}>
                          <td>{final ? r.rank : "—"}</td>
                          <td>
                            <strong>{r.displayName}</strong>
                          </td>
                          <td>
                            {Object.entries(r.allocation).map(([id, n]) => (
                              <button
                                className="portfolio-chip"
                                key={id}
                                onClick={() => setDetail(byId[id])}
                              >
                                {byId[id]?.name || id} <b>{n}</b>
                              </button>
                            ))}
                          </td>
                          <td>{final ? fmt.format(r.points) : "Pending"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        {view === "Admin" && session?.admin && (
          <>
            <PageHeading
              eyebrow={"ADMINISTRATOR · " + activeMarket.label.toUpperCase()}
              title="The referee’s desk."
              text={"Controls and results apply only to the " + activeMarket.label.toLowerCase() + ". Every change is recorded; always preview before publishing."}
            />
            <div className="explore-grid">
              <section className="panel">
                <h2>Market controls</h2>
                <p>
                  Current state: <b>{market.phase}</b>. Deadline:{" "}
                  {new Date(market.closesAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}{" "}
                  Eastern.
                </p>
                <div className="button-row">
                  {["open", "paused", "closed"].map((phase) => (
                    <button
                      disabled={busy}
                      key={phase}
                      onClick={() => {
                        if (phase === "closed") {
                          setModal("close-market");
                          return;
                        }
                        adminCall("state", {
                          phase,
                          reason: "Administrator control",
                        });
                      }}
                    >
                      {phase}
                    </button>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      const data = await request(
                        "/admin/export",
                        {},
                        session.token,
                      );
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      a.download = `nobel-exchange-${activeMarket.id}-export.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  <Download size={15} />
                  Export portfolios and audit
                </button>
              </section>
              <section className="panel">
                <h2>Official laureates</h2>
                {winners.map((w, i) => (
                  <div className="winner-row" key={i}>
                    <label>
                      Laureate
                      <select
                        value={
                          w.candidateId.startsWith("outside-")
                            ? "outside-roster"
                            : w.candidateId
                        }
                        onChange={(e) => {
                          setWinners((ws) =>
                            ws.map((x, j) =>
                              j === i
                                ? { ...x, candidateId: e.target.value }
                                : x,
                            ),
                          );
                          setAdminPreview(null);
                        }}
                      >
                        <option value="">Select economist</option>
                        {candidates.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="outside-roster">
                          Not on this roster
                        </option>
                      </select>
                    </label>
                    {w.candidateId.startsWith("outside-") && (
                      <label>
                        Official name
                        <input
                          value={w.name || ""}
                          onChange={(e) => {
                            setWinners((ws) =>
                              ws.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      name: e.target.value,
                                      candidateId: `outside-${i}`,
                                    }
                                  : x,
                              ),
                            );
                            setAdminPreview(null);
                          }}
                        />
                      </label>
                    )}
                    <label>
                      Prize share
                      <select
                        value={w.share}
                        onChange={(e) => {
                          setWinners((ws) =>
                            ws.map((x, j) =>
                              j === i ? { ...x, share: +e.target.value } : x,
                            ),
                          );
                          setAdminPreview(null);
                        }}
                      >
                        {[1, 0.5, 1 / 3, 0.25].map((n) => (
                          <option value={n} key={n}>
                            {n === 1 / 3
                              ? "1/3"
                              : n === 0.5
                                ? "1/2"
                                : n === 0.25
                                  ? "1/4"
                                  : "1"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="icon-button"
                      aria-label="Remove laureate"
                      onClick={() => {
                        setWinners((ws) => ws.filter((_, j) => i !== j));
                        setAdminPreview(null);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div className="button-row">
                  <button
                    disabled={winners.length >= 3}
                    onClick={() => {
                      setWinners((w) => [
                        ...w,
                        { candidateId: "", share: 1 / 3 },
                      ]);
                      setAdminPreview(null);
                    }}
                  >
                    Add laureate
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => adminCall("settlement-preview", { winners })}
                  >
                    Preview settlement
                  </button>
                </div>
                {adminPreview && (
                  <div className="settlement-preview">
                    <strong>
                      {fmt.format(adminPreview.pool - adminPreview.unawarded)}{" "}
                      awarded · {fmt.format(adminPreview.unawarded)} unawarded
                    </strong>
                    {adminPreview.rows.slice(0, 5).map((r: any) => (
                      <p key={r.id}>
                        #{r.rank} {r.displayName} — {fmt.format(r.points)}{" "}
                        points
                      </p>
                    ))}
                    <label>
                      Official Nobel result URL
                      <input
                        type="url"
                        value={official}
                        onChange={(e) => setOfficial(e.target.value)}
                        placeholder="https://www.nobelprize.org/…"
                      />
                    </label>
                    <label>
                      Settlement / correction note
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={busy || reason.length < 8 || !official}
                      onClick={() =>
                        adminCall("settle", {
                          winners,
                          source: official,
                          reason,
                          expectedRevision: adminPreview.revision,
                        })
                      }
                    >
                      Publish this settlement
                    </button>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
        <footer>
          <div className="footer-brand">
            The Nobel Exchange
            <span>Economics, with a little friendly competition.</span>
          </div>
          <div>
            <button onClick={() => setModal("rules")}>How to play</button>
            <button onClick={() => setModal("sources")}>Sources & data</button>
            <button onClick={() => setModal("privacy")}>Privacy</button>
            {session?.admin && (
              <button onClick={() => setView("Admin")}>
                <ShieldCheck size={13} /> Admin
              </button>
            )}
          </div>
          <p>
            Independent, unofficial, and strictly imaginary. Not affiliated with
            the Nobel Foundation. No stakes, cash prizes, or purchases.
          </p>
        </footer>
      </main>
      {view === "Market" && (
        <div className="mobile-tray">
          <button onClick={() => setTray(true)}>
            <span className="tray-icon">
              <Layers3 size={20} />
            </span>
            <span>
              <strong>
                My portfolio <b>{picks} picks</b>
              </strong>
              <small>
                {remaining} credits left
                {entry && !dirty ? " · saved" : " · draft"}
              </small>
            </span>
            <span className="tray-action">
              Review <ChevronRight size={17} />
            </span>
          </button>
        </div>
      )}
      {tray && (
        <Modal title="My portfolio" onClose={() => setTray(false)}>
          {portfolio(true)}
        </Modal>
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} wide>
          <div className="candidate-detail">
            <div className="detail-intro">
              <div
                className="avatar large"
                style={{ "--field": colors[detail.field] } as any}
              >
                {initials(detail.name)}
              </div>
              <div>
                <span
                  className="field-label"
                  style={{ color: colors[detail.field] }}
                >
                  {detail.field}
                </span>
                <p>{detail.institution}</p>
                <small>{detail.institutionBasis === "current-profile" ? "Primary profile checked October 8, 2026" : "Institution at award recognition; may not be current"}</small>
              </div>
            </div>
            <h3 className="detail-contribution">{detail.summary}</h3>
            <section className={"editorial-assessment group-" + detail.editorial.group}>
              <div className="editorial-heading"><strong>{contenderGroups[detail.editorial.group].label}</strong><span>Editorial review · Oct 8, 2026</span></div>
              <p>{detail.editorial.reason}</p>
              <div className="evidence-badges">
                {detail.editorial.evidence.map((e, i) => <a key={`${e.url}-${i}`} href={e.url} target="_blank" rel="noreferrer" title={e.note}>
                  <small>{evidenceKinds[e.kind]}{e.kind === "forecast" && e.targetYear ? ` · for ${e.targetYear}` : ""}</small><span>{e.label} · {e.dateLabel} <ArrowUpRight size={11} /></span>
                </a>)}
              </div>
              <details className="evidence-notes"><summary>What these signals mean</summary>
                <p>{contenderGroups[detail.editorial.group].explanation} These groups are not probabilities or official nominations.</p>
                <ul>{detail.editorial.evidence.map((e, i) => <li key={i}><b>{e.label} · {e.dateLabel}:</b> {e.note} <span>Checked {e.retrievedOn}.</span></li>)}</ul>
              </details>
            </section>
            <div className="honors">
              {detail.honors.map((h) => (
                <span key={h}>
                  <Trophy size={13} />
                  {h}
                </span>
              ))}
            </div>
            <div className="detail-columns">
              <section>
                <div className="article-heading"><h3>Most cited indexed articles</h3><span>Citations</span></div>
                {detail.mostCitedArticles?.status === "available" ? <>
                  <ol className="cited-articles">
                    {detail.mostCitedArticles.articles.map((p, i) => <li key={p.id}>
                      <span className="article-rank">{i + 1}</span>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        <span>{p.title} <ArrowUpRight size={11} /></span>
                        <small>{p.verification === "openalex" ? "Indexed " : ""}{p.year} · {p.venue}</small>
                      </a>
                      <span className="article-count" aria-label={`${fmt.format(p.citations)} citations`}>{fmt.format(p.citations)}</span>
                    </li>)}
                  </ol>
                  <p className="small muted article-source"><a href={detail.mostCitedArticles.queryUrl} target="_blank" rel="noreferrer">OpenAlex</a> · {detail.mostCitedArticles.retrievedOn}. Up to five distinct journal articles in the matched author record, ranked by recorded citations. Identified book reviews excluded; version counts are not combined. Publisher metadata checked where available; “Indexed” dates are database dates. Coverage can be incomplete.</p>
                  {detail.mostCitedArticles.reason && <p className="article-gap">{detail.mostCitedArticles.reason}</p>}
                </> : <p className="muted article-gap">Article ranking not yet verified. {detail.mostCitedArticles?.reason || "Publication metadata is unavailable."}</p>}
                <details className="landmark-works" open={detail.mostCitedArticles?.status !== "available"}><summary>Two selected landmark works</summary>
                {detail.papers.length ? (
                  detail.papers.map((p) => (
                    <a
                      className="paper-link"
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      key={p.url}
                    >
                      <span>
                        {p.title}
                        <small>{p.year} · publication record</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </a>
                  ))
                ) : (
                  <p className="muted">
                    Publication matching is not yet verified. Follow the source
                    profile below.
                  </p>
                )}
                <p className="small muted">
                  Selected publication examples, cross-checked against author
                  records. These may include books as well as papers.
                </p>
                </details>
              </section>
              <section>
                <h3>The citation trail</h3>
                {detail.citations ? (
                  <>
                    <strong className="citation-total">
                      {fmt.format(detail.citations.total)}
                    </strong>
                    <p className="small muted">
                      Total recorded citations · retrieved{" "}
                      {detail.citations.retrieved}
                    </p>
                    {detail.citations.years.length > 0 ? (
                      <>
                        <p className="small">
                          <b>Two selected landmarks · 2021–2025</b>
                        </p>
                        <Sparkline
                          points={detail.citations.years.map((y) => y.count)}
                          color={colors[detail.field]}
                        />
                        <table className="citation-table">
                          <thead>
                            <tr>
                              {detail.citations.years.map((y) => (
                                <th key={y.year}>{y.year}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {detail.citations.years.map((y) => (
                                <td key={y.year}>{compact.format(y.count)}</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                        <p className="small muted">
                          {detail.citations.trendScope} OpenAlex coverage can be
                          incomplete; these are not a quality score or winning
                          probability.
                        </p>
                      </>
                    ) : (
                      <p className="small muted">
                        Yearly citation trend unavailable.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Full-author citation total not yet verified. This is separate
                    from the article-level ranking.
                  </p>
                )}
              </section>
            </div>
            <section className="detail-market">
              <div>
                <span>Current backing</span>
                <strong>
                  {market.pool
                    ? (
                        ((market.totals[detail.id] || 0) / market.pool) *
                        100
                      ).toFixed(1)
                    : "0.0"}
                  %
                </strong>
              </div>
              <div>
                <span>Supporters</span>
                <strong>{market.supporters[detail.id] || 0}</strong>
              </div>
              <div>
                <span>Your draft / if sole winner</span>
                <strong>
                  {draft[detail.id] || 0} cr /{" "}
                  {fmt.format(
                    projectedPayout(
                      market,
                      entry?.allocation,
                      draft,
                      detail.id,
                    ),
                  )}{" "}
                  pts
                </strong>
              </div>
              <button
                className="primary"
                disabled={
                  closed || remaining <= 0 || (!draft[detail.id] && picks >= 10)
                }
                onClick={() => add(detail.id)}
              >
                Back with 10 <Plus size={16} />
              </button>
            </section>
            <details className="source-detail">
              <summary>Sources and matching notes</summary>
              <ul>
                {detail.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.label} <ArrowUpRight size={12} />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="small">{detail.citations?.matchEvidence}</p>
              <p className="small">
                Record prepared {detail.verifiedOn}. Candidate inclusion is
                editorial. There is no public list of current Nobel nominees.
              </p>
            </details>
          </div>
        </Modal>
      )}
      {modal === "rules" && (
        <Modal title="Small portfolio. Big ideas." onClose={() => setModal("")}>
          <div className="rules-content">
            <ol className="how-steps">
              <li>
                <b>Pick 1–10 economists.</b>
                <span>
                  Everyone can back the same people. Explore the research, or go
                  with a hunch.
                </span>
              </li>
              <li>
                <b>Split 100 whole credits.</b>
                <span>
                  Join with Google, choose a display name, and save. One
                  portfolio per Google account in this group.
                </span>
              </li>
              <li>
                <b>Change your mind, anytime.</b>
                <span>
                  Until Sunday, October 11 at 8 pm Eastern. Estimates update as
                  people enter and edit.
                </span>
              </li>
              <li>
                <b>Share the glory.</b>
                <span>
                  Each laureate’s official share of the pool is divided among
                  their backers, proportional to their credits.
                </span>
              </li>
            </ol>
            <p>
              You’re in the <b>{activeMarket.label.toLowerCase()}</b>. Each group
              has its own portfolios, backing, prize pool and leaderboard. You
              may join both with the same Google account; entries do not carry over.
            </p>
            <div className="example">
              <span>100 players → 10,000 points</span>
              <strong>10% of a sole winner’s backing = 1,000 points.</strong>
              <span>
                If they receive half the Nobel prize, you get 500 points.
              </span>
            </div>
            <p>
              Popularity is share of credits, not probability. Returns are
              conditional estimates, not locked odds. There are no trades,
              clearing rounds, or early-buyer gains.
            </p>
            <p>
              Equal point totals share a rank. Unbacked winners’ portions remain
              unawarded. If nobody picked a winner, we say so.
            </p>
            <p>
              Private portfolios become public at closing. Official results are
              entered by Simon, with a preview and an audit trail for
              corrections.
            </p>
            <button className="primary" onClick={() => setModal("")}>
              I’m ready to pick <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "sources" && (
        <Modal title="A little source criticism." onClose={() => setModal("")}>
          <div className="rules-content">
            <p>
              This is an editorial candidate pool, not a list of actual Nobel
              nominees. Nominations are confidential for 50 years.
            </p>
            <p>
              The roster starts with living, non-winning economics Citation
              Laureates in the Clarivate archive, supplemented by John Bates
              Clark medalists. The underlying inventory retains exclusions for
              prior winners and deceased economists. Nine further additions have
              primary biographical, research and inclusion-source checks.
            </p>
            <p>
              <b>Featured is editorial, not a probability ranking.</b> Established contenders appear first,
              followed by a broad watchlist, future contenders and outsiders. The groups express
              research-case judgments, not age eligibility rules. A recent medal alone does not make someone a 2026 favorite.
            </p>
            <p>
              Dated badges distinguish public previews and predictions from research awards,
              broad future longlists and market listings. Clarivate recognizes Nobel-class research,
              not winners for a particular year. Market listing is not expert endorsement.
              Historical predictions keep their original dates; each profile explains the evidence.
            </p>
            <p>
              Institutions are at award recognition, not necessarily current
              positions; new additions label their checked primary profiles instead.
              Field labels and short explanations are editorial.
              Publication examples come from author-matched OpenAlex records or reviewed primary sources; a
              citation total is not a quality ranking.
            </p>
            <p>
              Initials are used throughout. No unlicensed portraits are
              reproduced. Missing citation data is left unavailable rather than
              guessed.
            </p>
            <p>
              <b>Snapshot:</b> {roster.retrieved} · <b>Roster:</b>{" "}
              {roster.version} · <b>Review:</b> {roster.status}
            </p>
            <ul>
              <li>
                <a
                  href="https://clarivate.com/citation-laureates/hall-of-citation-laureates/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Clarivate Citation Laureates
                </a>
              </li>
              <li>
                <a
                  href="https://www.aeaweb.org/about-aea/honors-awards/bates-clark"
                  target="_blank"
                  rel="noreferrer"
                >
                  AEA John Bates Clark Medal
                </a>
              </li>
              <li>
                <a
                  href="https://www.nobelprize.org/nomination/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Nobel nomination rules
                </a>
              </li>
              <li>
                <a
                  href="https://help.openalex.org/data/authors/"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenAlex author data
                </a>
              </li>
              <li>
                <a
                  href="https://www.nobelprize.org/prizes/about/prize-announcement-dates/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Official announcement schedule
                </a>
              </li>
            </ul>
          </div>
        </Modal>
      )}
      {modal === "privacy" && (
        <Modal title="Your picks, your privacy." onClose={() => setModal("")}>
          <div className="rules-content">
            <p>
              Google verifies your account. The server stores your account’s
              stable identifier, chosen display name, allocation, version
              history for saved requests, and administrative audit events. It
              does not publish your Google email or account identifier.
            </p>
            <p>
              Aggregate backing is public immediately. Your chosen display name
              and final portfolio become public at closing. Choose a pseudonym
              if you prefer.
            </p>
            <p>
              A temporary app token stays in this browser tab’s session storage.
              Sign out on shared devices. Google and Cloudflare process sign-in
              and network requests under their own policies.
            </p>
            <p>
              No analytics, advertising trackers, payments, or data from Family
              Planner or Task Manager. Public candidate information is separate
              from participant records.
            </p>
            <p>
              Questions or private deletion requests: <a href="mailto:sfuchs.de@gmail.com">sfuchs.de@gmail.com</a>.
              Account-linked data will be removed manually by January 10, 2027.
              Public nicknames, final picks and scores may remain as the edition’s archive.
              Please do not post private account information in GitHub issues.
            </p>
          </div>
        </Modal>
      )}
      {modal === "signin" && (
        <Modal title="Your seat at the exchange." onClose={() => setModal("")}>
          <div className="signin-content">
            <div className="results-icon">
              <Coins size={34} />
            </div>
            <p>
              One Google account. One 100-credit portfolio in this group.
              <br />
              Joining the {activeMarket.label.toLowerCase()}. Your display name is up to you.
            </p>
            {!mobileRedirect && <div ref={googleMount} />}
            {config.redirectAuthReady && (
              <button className={mobileRedirect ? "primary" : "secondary"} onClick={beginRedirectSignIn} disabled={busy}>
                {busy ? "Opening secure sign-in…" : mobileRedirect ? "Continue with Google" : "Use full-page sign-in"}
                <ArrowRight size={17}/>
              </button>
            )}
            {error && <p className="setup-note" role="alert">{error}</p>}
            {config.redirectAuthReady && <small>Your picks stay in this browser. Keep the same browser open until you return. On iPhone, use Safari rather than an embedded app browser.</small>}
            {!config.authReady && (
              <p className="setup-note">
                Google sign-in is not connected in this preview. It must be
                configured before the public game can open.
              </p>
            )}
            {config.development && (
              <div className="dev-accounts">
                <span className="eyebrow">LOCAL TEST ACCOUNTS</span>
                {["alice", "bob", "admin"].map((id) => (
                  <button
                    key={id}
                    onClick={() => {
                      setSession({
                        id: "dev-" + id,
                        token: "dev-" + id,
                        displayName:
                          id === "alice"
                            ? "The Invisible Hands"
                            : id === "bob"
                              ? "Pareto Pirates"
                              : "Simon · preview",
                        admin: id === "admin",
                        expiresAt: "2026-12-31T00:00:00Z",
                      });
                      setModal("");
                    }}
                  >
                    Preview as {id}
                  </button>
                ))}
              </div>
            )}
            <small>
              By saving, you agree to your display name and final portfolio
              being public after closing. No real money.
            </small>
          </div>
        </Modal>
      )}
      {modal === "account" && (
        <Modal title={"Your account · " + activeMarket.label} onClose={() => setModal("")}>
          <div className="rules-content">
            <p>
              Signed in as <b>{name || session?.displayName}</b>.
            </p>
            <details>
              <summary>Private account details</summary>
              <p>Your account ID is used for support and administrator setup. It is never included in public portfolios.</p>
              <p><code>{session?.id}</code></p>
            </details>
            {session?.admin && (
              <button
                onClick={() => {
                  setView("Admin");
                  setModal("");
                }}
              >
                <ShieldCheck size={16} />
                Administrator desk
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                sessionStorage.removeItem(activeMarket.sessionKey);
                setSession(null);
                setDraft({});
                setName("");
                setView("Market");
                setModal("");
              }}
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </Modal>
      )}
      {modal === "close-market" && (
        <Modal title={"Close the " + activeMarket.label.toLowerCase() + "?"} onClose={() => setModal("")}>
          <div className="rules-content">
            <p>
              This locks every portfolio in the {activeMarket.label.toLowerCase()} and makes its display names and allocations
              public. The other group is unchanged. A closed market cannot be reopened.
            </p>
            <div className="button-row">
              <button onClick={() => setModal("")}>Keep it open</button>
              <button
                className="primary"
                onClick={() => {
                  adminCall("state", {
                    phase: "closed",
                    reason: "Administrator manually closed entries",
                  });
                  setModal("");
                }}
              >
                Close and publish portfolios
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
export default App;
