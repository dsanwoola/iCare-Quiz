import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import { ArrowLeft, Check, Loader2, Sparkle, Zap, Megaphone, ShieldCheck } from "lucide-react";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import { startProCheckout } from "@/react-app/lib/data";

const perks = [
  { icon: Zap, title: "Automatic mode", desc: "The game runs itself — no clicking through questions and reveals." },
  { icon: Megaphone, title: "Sponsor the countdown", desc: "Put your own sponsor's ad on the between-question screen." },
  { icon: ShieldCheck, title: "Priority everything", desc: "Support your favourite quiz app and unlock new Pro features first." },
];

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function UpgradePage() {
  const { config, isProUser, subscription } = useAppConfig();
  const plan = config.proPlan;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async () => {
    setError(null);
    setLoading(true);
    try {
      const link = await startProCheckout();
      window.location.href = link; // Flutterwave hosted checkout
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/host" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Upgrade to Pro</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/20 text-yellow-700 px-3 py-1 text-xs font-bold mb-3">
            <Sparkle className="w-3.5 h-3.5" /> NEIGHBOURS QUIZ PRO
          </div>
          <h2 className="text-3xl sm:text-4xl font-black">Run better games, effortlessly.</h2>
        </div>

        <Card className="p-6 sm:p-8 rounded-3xl border-2 max-w-md mx-auto">
          {isProUser ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                <Check className="w-7 h-7 text-green-500" />
              </div>
              <h3 className="text-xl font-bold mb-1">You're Pro! 🎉</h3>
              <p className="text-muted-foreground">
                {subscription?.expiresAt
                  ? `Your subscription renews on ${new Date(subscription.expiresAt).toLocaleDateString()}.`
                  : "All Pro features are unlocked."}
              </p>
              <Link to="/host">
                <Button className="mt-6 gradient-primary text-white border-0 rounded-xl">Back to Dashboard</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="text-4xl font-black">{formatPrice(plan.amount, plan.currency)}</div>
                <div className="text-muted-foreground">per {plan.interval === "annual" ? "year" : "month"}</div>
              </div>

              <ul className="space-y-3 mb-6">
                {perks.map((p) => {
                  const Icon = p.icon;
                  return (
                    <li key={p.title} className="flex items-start gap-3">
                      <div className="gradient-primary w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{p.title}</div>
                        <div className="text-sm text-muted-foreground">{p.desc}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {error && (
                <div className="bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-sm text-center mb-3">
                  {error}
                </div>
              )}

              <Button
                onClick={upgrade}
                disabled={loading}
                className="w-full gradient-primary text-white border-0 h-12 rounded-xl font-semibold"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pay with Flutterwave"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Secure checkout on Flutterwave. Card, bank transfer, mobile money & more.
              </p>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
