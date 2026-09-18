// Lightweight client error reporter.
//
// Sends connection/runtime failures from players' phones to our own server
// (/api/client-log, same origin), NOT to Firebase — so a phone that can't reach
// Firebase can still tell us why. Deliberately dependency-free: it must keep
// working when Firebase is the thing that's broken.

const ENDPOINT = "/api/client-log";
const MAX_PER_PAGE = 20; // hard cap per page load
const DEDUPE_MS = 30_000; // same stage+code at most once per 30s

let sent = 0;
const recent = new Map<string, number>();

/** Name the browser, calling out in-app / data-saver browsers that commonly
 *  break Google's security check (reCAPTCHA / App Check). */
export function detectBrowser(ua: string = navigator.userAgent): string {
  if (/WhatsApp/i.test(ua)) return "WhatsApp in-app";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook in-app";
  if (/Instagram/i.test(ua)) return "Instagram in-app";
  if (/Opera Mini|OPiOS/i.test(ua)) return "Opera Mini";
  if (/UCBrowser/i.test(ua)) return "UC Browser";
  if (/PHX\//i.test(ua)) return "Phoenix";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/; wv\)/.test(ua)) return "Android WebView (in-app)";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/CriOS|Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Report a failure. `stage` says where it happened (auth, appcheck, join,
 * session, submit, notes, window…). Safe to call anywhere; never throws.
 */
export function reportError(stage: string, err: unknown, extra?: Record<string, string | number | boolean | null>) {
  try {
    if (sent >= MAX_PER_PAGE) return;
    const e = err as { code?: unknown; message?: unknown; name?: unknown } | null;
    const code = typeof e?.code === "string" ? e.code : typeof e?.name === "string" ? e.name : "";
    const message = typeof e?.message === "string" ? e.message : String(err ?? "");

    const key = `${stage}|${code}`;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - DEDUPE_MS) return;
    recent.set(key, now);
    sent++;

    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
    const payload = {
      stage,
      code,
      message: message.slice(0, 500),
      path: location.pathname.slice(0, 120),
      pin: location.pathname.match(/\/(?:join|play)\/(\d{6})/)?.[1] ?? null,
      sessionId: readSession("sessionId"),
      browser: detectBrowser(),
      ua: navigator.userAgent.slice(0, 300),
      online: navigator.onLine,
      network: conn?.effectiveType ?? null,
      extra: extra ? JSON.stringify(extra).slice(0, 300) : null,
    };
    const body = JSON.stringify(payload);

    // sendBeacon survives page unloads and flaky connections; fall back to fetch.
    const blob = new Blob([body], { type: "application/json" });
    if (!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob))) {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* reporting must never break the app */
  }
}

/** Only Firebase-style failures carry a `code` — plain Errors are ours
 *  ("Game not found", "nickname taken") and are user mistakes, not faults. */
export function isSystemError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.length > 0;
}

/** Catch anything that slips through: uncaught errors and rejected promises. */
export function installGlobalErrorReporting() {
  const noise = /ResizeObserver loop|Script error\.?$|extension:\/\//i;
  window.addEventListener("error", (ev) => {
    const msg = ev.message || String(ev.error ?? "");
    if (noise.test(msg) || noise.test(ev.filename ?? "")) return;
    reportError("window", ev.error ?? { message: msg }, { src: (ev.filename ?? "").slice(-80), line: ev.lineno ?? 0 });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const msg = String((ev.reason as { message?: unknown })?.message ?? ev.reason ?? "");
    if (noise.test(msg)) return;
    reportError("promise", ev.reason);
  });
}
