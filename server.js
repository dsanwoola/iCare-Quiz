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

async function getProPlan() {
  const snap = await db.doc("config/app").get();
  const p = (snap.exists ? snap.data().proPlan : null) || {};
  return {
    name: typeof p.name === "string" && p.name ? p.name : "Pro",
    amount: Number(p.amount) > 0 ? Number(p.amount) : 5000,
    currency: typeof p.currency === "string" && p.currency ? p.currency : "NGN",
    interval: p.interval === "annual" ? "annual" : "monthly",
  };
}

async function grantPro(uid, email, plan, txRef) {
  const days = plan.interval === "annual" ? 365 : 30;
  await db.doc(`subscribers/${uid}`).set(
    {
      uid,
      email: email || null,
      plan: plan.name,
      provider: "flutterwave",
      status: "active",
      expiresAt: new Date(Date.now() + days * 86400000),
      lastTxRef: txRef || null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function flwVerify(transactionId) {
  const r = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET}` },
  });
  return r.json();
}

function paymentIsGood(verifyResp, plan) {
  const d = verifyResp?.data;
  return (
    verifyResp?.status === "success" &&
    d &&
    d.status === "successful" &&
    Number(d.amount) >= plan.amount &&
    d.currency === plan.currency
  );
}

// ---- billing API ---------------------------------------------------------

// Create a Flutterwave hosted-checkout link for the signed-in host.
app.post("/api/billing/checkout", async (req, res) => {
  if (!FLW_SECRET) return res.status(503).json({ error: "Billing is not configured yet." });
  const user = await verifyCaller(req);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  try {
    const plan = await getProPlan();
    const txRef = `nqa-${user.uid}-${Date.now()}`;
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const r = await fetch(`${FLW_BASE}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FLW_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: plan.amount,
        currency: plan.currency,
        redirect_url: `${origin}/billing/callback`,
        customer: { email: user.email, name: user.name || user.email },
        customizations: {
          title: "Neighbours Quiz Arena Pro",
          description: `${plan.name} subscription (${plan.interval})`,
        },
        meta: { uid: user.uid, plan: plan.name },
      }),
    });
    const j = await r.json();
    if (j.status === "success" && j.data?.link) return res.json({ link: j.data.link });
    return res.status(502).json({ error: j.message || "Could not start checkout." });
  } catch (e) {
    return res.status(500).json({ error: "Checkout failed. Please try again." });
  }
});

// Verify a transaction after redirect and grant Pro if it's this user's.
app.get("/api/billing/verify", async (req, res) => {
  if (!FLW_SECRET) return res.status(503).json({ error: "Billing is not configured yet." });
  const user = await verifyCaller(req);
  if (!user) return res.status(401).json({ error: "Please sign in." });
  const transactionId = req.query.transaction_id;
  if (!transactionId) return res.json({ status: "failed" });
  try {
    const v = await flwVerify(transactionId);
    const plan = await getProPlan();
    const d = v?.data;
    const uid = d?.meta?.uid || (typeof d?.tx_ref === "string" && d.tx_ref.startsWith(`nqa-${user.uid}-`) ? user.uid : null);
    if (paymentIsGood(v, plan) && uid === user.uid) {
      await grantPro(user.uid, user.email, plan, d.tx_ref);
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
      const plan = await getProPlan();
      const uid = v?.data?.meta?.uid;
      if (paymentIsGood(v, plan) && uid) {
        await grantPro(uid, v.data.customer?.email, plan, v.data.tx_ref);
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
