import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import { ArrowLeft, Check, Loader2, Sparkle, Gift } from "lucide-react";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import { useToast } from "@/react-app/components/ui/toast";
import { startProCheckout, startTrial } from "@/react-app/lib/data";
import type { Tier } from "@/shared/types";

type PaidTier = "pro" | "business";
type Interval = "monthly" | "annual";

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

const RANK: Record<Tier, number> = { free: 0, pro: 1, business: 2 };

export default function UpgradePage() {
  const { config, tier, subscription } = useAppConfig();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading] = useState<PaidTier | null>(null);
  const [trialing, setTrialing] = useState(false);

  const currency = config.plans.currency;
  const perks: Record<PaidTier, { features: string[] }> = {
    pro: {
      features: [
        `Up to ${config.limits.maxPlayers.pro.toLocaleString()} players per game`,
        "Automatic (self-running) games",
        "Schedule an automatic start time",
        "Full-screen lobby cover image",
        "Sell your own sponsor ad slot",
        "No house ads on your games",
        `${config.limits.aiMonthlyQuota.pro} AI quiz generations / month`,
        "Full analytics dashboard",
      ],
    },
    business: {
      features: [
        `Up to ${config.limits.maxPlayers.business.toLocaleString()} players per game`,
        "Everything in Pro",
        "Unlimited AI quiz generations",
        "Multi-host / team seats",
        "White-label — remove app branding",
        "Priority support",
      ],
    },
  };

  const priceFor = (t: PaidTier) =>
    interval === "annual" ? config.plans[t].annualAmount : config.plans[t].monthlyAmount;

  const buy = async (t: PaidTier) => {
    setLoading(t);
    try {
      const link = await startProCheckout(t, interval);
      window.location.href = link; // Flutterwave hosted checkout
    } catch (e) {
      showError("Checkout failed", e instanceof Error ? e.message : "Please try again.");
      setLoading(null);
    }
  };

  const beginTrial = async () => {
    setTrialing(true);
    try {
      await startTrial();
      showSuccess("Trial started 🎉", `You have ${config.trialDays} days of Pro.`);
      navigate("/host");
    } catch (e) {
      showError("Couldn't start trial", e instanceof Error ? e.message : "Please try again.");
      setTrialing(false);
    }
  };

  const owns = (t: PaidTier) => RANK[tier] >= RANK[t];
  const showTrial = tier === "free" && config.trialDays > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/host" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Plans &amp; pricing</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/20 text-yellow-700 px-3 py-1 text-xs font-bold mb-3">
            <Sparkle className="w-3.5 h-3.5" /> NEIGHBOURS QUIZ ARENA
          </div>
          <h2 className="text-3xl sm:text-4xl font-black">Run bigger, better games.</h2>
          {tier !== "free" && (
            <p className="text-muted-foreground mt-2">
              You're on <span className="font-semibold capitalize text-primary">{tier}</span>
              {subscription?.expiresAt
                ? ` · renews ${new Date(subscription.expiresAt).toLocaleDateString()}`
                : ""}
              {subscription?.status === "trialing" ? " (trial)" : ""}.
            </p>
          )}
        </div>

        {/* Billing interval toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl border border-border overflow-hidden">
            {(["monthly", "annual"] as Interval[]).map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                  interval === iv ? "gradient-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {iv}
                {iv === "annual" && <span className="ml-1 text-[10px] text-yellow-600">2 months free</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {(["pro", "business"] as PaidTier[]).map((t) => (
            <Card
              key={t}
              className={`p-6 sm:p-8 rounded-3xl border-2 flex flex-col ${
                t === "business" ? "border-primary/40" : ""
              }`}
            >
              <div className="mb-4">
                <h3 className="text-2xl font-black capitalize">{t}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black">{formatPrice(priceFor(t), currency)}</span>
                  <span className="text-muted-foreground">/{interval === "annual" ? "yr" : "mo"}</span>
                </div>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {perks[t].features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {owns(t) ? (
                <Button disabled className="w-full h-12 rounded-xl" variant="outline">
                  <Check className="w-4 h-4 mr-2 text-green-500" /> Your current plan
                </Button>
              ) : (
                <Button
                  onClick={() => buy(t)}
                  disabled={loading !== null}
                  className="w-full gradient-primary text-white border-0 h-12 rounded-xl font-semibold"
                >
                  {loading === t ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    `Get ${t === "business" ? "Business" : "Pro"}`
                  )}
                </Button>
              )}
            </Card>
          ))}
        </div>

        {showTrial && (
          <div className="text-center mt-8">
            <Button
              onClick={beginTrial}
              disabled={trialing}
              variant="outline"
              className="rounded-xl border-yellow-400 text-yellow-700 h-11"
            >
              {trialing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
              Start your {config.trialDays}-day free Pro trial
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2">No card required. One per account.</p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center mt-8">
          Secure checkout on Flutterwave — card, bank transfer, mobile money &amp; more.
        </p>
      </main>
    </div>
  );
}
