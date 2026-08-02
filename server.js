// Production server for Firebase App Hosting.
// - Serves the static Vite SPA (client-side-routing fallback to index.html).
// - Hosts the Flutterwave billing API (checkout / verify / webhook), granting
//   Pro subscriptions via the Firebase Admin SDK.
//
// Required env (set as App Hosting secrets):
//   FLW_SECRET_KEY   – Flutterwave v3 Secret Key (FLWSECK-...)
//   FLW_WEBHOOK_HASH – the "verif-hash" secret you set in the FLW dashboard
// If FLW_SECRET_KEY is unset, the billing routes return 503 (app still serves).
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const port = process.env.PORT || 8080;

const FLW_SECRET = process.env.FLW_SECRET_KEY;
const FLW_WEBHOOK_HASH = process.env.FLW_WEBHOOK_HASH;
const FLW_BASE = "https://api.flutterwave.com/v3";

// Firebase Admin uses Application Default Credentials on App Hosting.
if (!getApps().length) initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

const app = express();

// Canonical host: once the custom domain is verified and serving, set
// CANONICAL_HOST (e.g. "neighbours.cloud") to 301-redirect every other host —
// the default *.hosted.app URL and www.neighbours.cloud — to it. App Hosting
// terminates the custom domain at its load balancer and forwards the INTERNAL
// host in the plain Host header, so we read the true external host from
// x-forwarded-host and deliberately do NOT fall back to Host: if that header
// is absent we simply skip the redirect, so an apex request can never be
// redirected to itself (no loop). /api/ is exempt so the Flutterwave webhook
// (a server-to-server POST) is never redirected.
const CANONICAL_HOST = (process.env.CANONICAL_HOST || "").toLowerCase();
if (CANONICAL_HOST) {
  app.use((req, res, next) => {
    const ext = (req.headers["x-forwarded-host"] || "")
      .split(",")[0]
      .trim()
      .split(":")[0]
      .toLowerCase();
    if (ext && ext !== CANONICAL_HOST && !req.path.startsWith("/api/")) {
      return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
    }
    next();
  });
}

app.use(express.json());

// ---- helpers -------------------------------------------------------------

async function verifyCaller(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) return null;
  try {
    return await adminAuth.verifyIdToken(m[1]);
  } catch {
    return null;
  }
}

const normTier = (t) => (t === "business" ? "business" : "pro");
const normInterval = (i) => (i === "annual" ? "annual" : "monthly");

// Read the plan catalog + trial length from config/app, with safe fallbacks.
async function getBillingConfig() {
  const snap = await db.doc("config/app").get();
  const c = snap.exists ? snap.data() : {};
  const plans = c.plans || {};
  const pro = plans.pro || {};
  const business = plans.business || {};
  const n = (v, f) => (Number(v) > 0 ? Number(v) : f);
  return {
    currency: typeof plans.currency === "string" && plans.currency ? plans.currency : "NGN",
    amounts: {
      pro: { monthly: n(pro.monthlyAmount, 5000), annual: n(pro.annualAmount, 50000) },
      business: { monthly: n(business.monthlyAmount, 20000), annual: n(business.annualAmount, 200000) },
    },
    trialDays: Number(c.trialDays) > 0 ? Number(c.trialDays) : 7,
  };
}

// Grant/extend a tier: write the subscribers doc AND set a self-expiring
// { tier, proUntil } custom claim (consumed by Firestore rules + the client).
async function grantTier(uid, email, tier, days, { status = "active", txRef = null } = {}) {
  const proUntil = Date.now() + days * 86400000;
  await db.doc(`subscribers/${uid}`).set(
    {
      uid,
      email: email || null,
      tier,
      plan: tier === "business" ? "Business" : "Pro",
      provider: "flutterwave",
      status,
      expiresAt: new Date(proUntil),
      lastTxRef: txRef,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  try {
    await adminAuth.setCustomUserClaims(uid, { tier, proUntil });
  } catch (e) {
    console.error("setCustomUserClaims failed (client gating still applies):", e?.message);
  }
}

async function flwVerify(transactionId) {
  const r = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET}` },
  });
  return r.json();
}

// A payment is good if it succeeded and covered at least the expected price.
function paymentIsGood(verifyResp, expectedAmount, currency) {
  const d = verifyResp?.data;
  return (
    verifyResp?.status === "success" &&
    d &&
    d.status === "successful" &&
    Number(d.amount) >= expectedAmount &&
    d.currency === currency
  );
}

// ---- billing API ---------------------------------------------------------

// Create a Flutterwave hosted-checkout link for the signed-in host's tier.
app.post("/api/billing/checkout", async (req, res) => {
  if (!FLW_SECRET) return res.status(503).json({ error: "Billing is not configured yet." });
  const user = await verifyCaller(req);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  try {
    const tier = normTier(req.body?.tier);
    const interval = normInterval(req.body?.interval);
    const cfg = await getBillingConfig();
    const amount = cfg.amounts[tier][interval];
    const txRef = `nqa-${user.uid}-${Date.now()}`;
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const label = tier === "business" ? "Business" : "Pro";
    const r = await fetch(`${FLW_BASE}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FLW_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: cfg.currency,
        redirect_url: `${origin}/billing/callback`,
        customer: { email: user.email, name: user.name || user.email },
        customizations: {
          title: `Neighbours Quiz Arena ${label}`,
          description: `${label} subscription (${interval})`,
        },
        meta: { uid: user.uid, tier, interval },
      }),
    });
    const j = await r.json();
    if (j.status === "success" && j.data?.link) return res.json({ link: j.data.link });
    return res.status(502).json({ error: j.message || "Could not start checkout." });
  } catch (e) {
    return res.status(500).json({ error: "Checkout failed. Please try again." });
  }
});

// One-time free trial: grants Pro for config.trialDays, guarded by trialedAt.
// Does NOT require Flutterwave (trials are free), so it works before secrets.
app.post("/api/billing/trial", async (req, res) => {
  const user = await verifyCaller(req);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  try {
    const ref = db.doc(`subscribers/${user.uid}`);
    const snap = await ref.get();
    if (snap.exists && snap.data().trialedAt) {
      return res.status(409).json({ error: "You've already used your free trial." });
    }
    const cfg = await getBillingConfig();
    await grantTier(user.uid, user.email, "pro", cfg.trialDays, { status: "trialing" });
    await ref.set({ trialedAt: FieldValue.serverTimestamp() }, { merge: true });
    return res.json({ ok: true, days: cfg.trialDays });
  } catch (e) {
    return res.status(500).json({ error: "Could not start your trial." });
  }
});

// Verify a transaction after redirect and grant the tier if it's this user's.
app.get("/api/billing/verify", async (req, res) => {
  if (!FLW_SECRET) return res.status(503).json({ error: "Billing is not configured yet." });
  const user = await verifyCaller(req);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  const transactionId = req.query.transaction_id;
  if (!transactionId) return res.json({ status: "failed" });
  try {
    const v = await flwVerify(transactionId);
    const d = v?.data;
    const meta = d?.meta || {};
    const uid =
      meta.uid || (typeof d?.tx_ref === "string" && d.tx_ref.startsWith(`nqa-${user.uid}-`) ? user.uid : null);
    if (uid !== user.uid) return res.json({ status: "failed" });
    const tier = normTier(meta.tier);
    const interval = normInterval(meta.interval);
    const cfg = await getBillingConfig();
    if (paymentIsGood(v, cfg.amounts[tier][interval], cfg.currency)) {
      await grantTier(user.uid, user.email, tier, interval === "annual" ? 365 : 30, { txRef: d.tx_ref });
      return res.json({ status: "success" });
    }
    return res.json({ status: "failed" });
  } catch (e) {
    return res.status(500).json({ status: "error" });
  }
});

// Flutterwave webhook (authoritative). Verified via the verif-hash secret.
app.post("/api/webhook/flutterwave", async (req, res) => {
  if (FLW_WEBHOOK_HASH && req.headers["verif-hash"] !== FLW_WEBHOOK_HASH) {
    return res.status(401).end();
  }
  const d = req.body?.data;
  try {
    if (d?.status === "successful" && d.id) {
      const v = await flwVerify(d.id);
      const meta = v?.data?.meta || {};
      const uid = meta.uid;
      const tier = normTier(meta.tier);
      const interval = normInterval(meta.interval);
      const cfg = await getBillingConfig();
      if (uid && paymentIsGood(v, cfg.amounts[tier][interval], cfg.currency)) {
        await grantTier(uid, v.data.customer?.email, tier, interval === "annual" ? 365 : 30, { txRef: v.data.tx_ref });
      }
    }
  } catch (e) {
    /* swallow — respond 200 so FLW doesn't hammer retries */
  }
  res.status(200).end();
});

// ---- static site ---------------------------------------------------------

app.use(
  express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  })
);

// SPA fallback: every non-API, non-asset route returns the app shell.
app.get("*", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Neighbours Quiz Arena listening on port ${port}`);
});
