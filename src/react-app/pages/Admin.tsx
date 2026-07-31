import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Card } from "@/react-app/components/ui/card";
import { Switch } from "@/react-app/components/ui/switch";
import { useToast } from "@/react-app/components/ui/toast";
import { ArrowLeft, ShieldCheck, Loader2, Save, Zap, Hand, Megaphone } from "lucide-react";
import type { GameMode } from "@/shared/types";
import { GET_READY_OPTIONS } from "@/shared/types";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import { updateAppConfig } from "@/react-app/lib/data";

export default function AdminPage() {
  const { config, loading } = useAppConfig();
  const { showSuccess, showError } = useToast();

  const [gameMode, setGameMode] = useState<GameMode>("manual");
  const [seconds, setSeconds] = useState(10);
  const [sound, setSound] = useState(true);
  const [adText, setAdText] = useState("");
  const [adImage, setAdImage] = useState("");
  const [adUrl, setAdUrl] = useState("");
  const [proEmails, setProEmails] = useState("");
  const [planName, setPlanName] = useState("Pro");
  const [planAmount, setPlanAmount] = useState("5000");
  const [planCurrency, setPlanCurrency] = useState("NGN");
  const [planInterval, setPlanInterval] = useState<"monthly" | "annual">("monthly");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    setGameMode(config.defaultGameMode);
    setSeconds(config.defaultCountdownSeconds);
    setSound(config.countdownSoundEnabled);
    setAdText(config.defaultAd?.text ?? "");
    setAdImage(config.defaultAd?.imageUrl ?? "");
    setAdUrl(config.defaultAd?.url ?? "");
    setProEmails(config.proEmails.join("\n"));
    setPlanName(config.proPlan.name);
    setPlanAmount(String(config.proPlan.amount));
    setPlanCurrency(config.proPlan.currency);
    setPlanInterval(config.proPlan.interval);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true);
    try {
      const emails = proEmails
        .split(/[\n,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      await updateAppConfig({
        defaultGameMode: gameMode,
        defaultCountdownSeconds: seconds,
        countdownSoundEnabled: sound,
        defaultAd: adText.trim()
          ? { text: adText.trim(), imageUrl: adImage.trim() || null, url: adUrl.trim() || null }
          : null,
        proEmails: emails,
        proPlan: {
          name: planName.trim() || "Pro",
          amount: Math.max(0, Number(planAmount) || 0),
          currency: (planCurrency.trim() || "NGN").toUpperCase(),
          interval: planInterval,
        },
      });
      showSuccess("Settings saved", "Applies to new games across the app");
    } catch {
      showError("Failed to save", "Please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/host" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Admin settings</h1>
            </div>
          </div>
          <Button onClick={save} disabled={saving || loading} className="gradient-primary text-white border-0 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Game pacing */}
            <Card className="p-6 rounded-2xl border-2">
              <h2 className="font-bold text-lg mb-1">Default game pacing</h2>
              <p className="text-sm text-muted-foreground mb-4">The default for new games run by Pro hosts.</p>
              <div className="inline-flex rounded-xl border border-border overflow-hidden">
                {(["manual", "auto"] as GameMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setGameMode(m)}
                    className={`px-5 py-2 text-sm font-semibold flex items-center gap-2 transition-colors ${
                      gameMode === m ? "gradient-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m === "auto" ? <Zap className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
                    {m === "auto" ? "Automatic" : "Manual"}
                  </button>
                ))}
              </div>
            </Card>

            {/* Countdown */}
            <Card className="p-6 rounded-2xl border-2">
              <h2 className="font-bold text-lg mb-4">Get-ready countdown</h2>
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-medium">Default interval</span>
                <div className="inline-flex rounded-xl border border-border overflow-hidden">
                  {GET_READY_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeconds(s)}
                      className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                        seconds === s ? "gradient-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Countdown sound</span>
                  <p className="text-xs text-muted-foreground">Tick + go sound on the get-ready screen.</p>
                </div>
                <Switch checked={sound} onCheckedChange={setSound} />
              </div>
            </Card>

            {/* Default ad */}
            <Card className="p-6 rounded-2xl border-2">
              <div className="flex items-center gap-2 mb-1">
                <Megaphone className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Default ad slot</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Shown on the get-ready countdown when a host hasn't set their own sponsor. Leave blank to show the
                built-in "advertise here" invite.
              </p>
              <div className="space-y-3">
                <Input placeholder="Ad text" value={adText} onChange={(e) => setAdText(e.target.value)} className="rounded-xl" />
                <Input placeholder="Image URL (optional)" value={adImage} onChange={(e) => setAdImage(e.target.value)} className="rounded-xl" />
                <Input placeholder="Link URL (optional)" value={adUrl} onChange={(e) => setAdUrl(e.target.value)} className="rounded-xl" />
              </div>
            </Card>

            {/* Pro plan pricing (Flutterwave) */}
            <Card className="p-6 rounded-2xl border-2">
              <h2 className="font-bold text-lg mb-1">Pro plan pricing</h2>
              <p className="text-sm text-muted-foreground mb-4">
                What hosts pay to unlock Pro, charged via Flutterwave.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Plan name</label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Amount</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={planAmount}
                    onChange={(e) => setPlanAmount(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Currency</label>
                  <Input
                    value={planCurrency}
                    onChange={(e) => setPlanCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="NGN"
                    className="rounded-xl uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">Billing interval</label>
                  <div className="inline-flex rounded-xl border border-border overflow-hidden">
                    {(["monthly", "annual"] as const).map((iv) => (
                      <button
                        key={iv}
                        onClick={() => setPlanInterval(iv)}
                        className={`px-5 py-2 text-sm font-semibold capitalize transition-colors ${
                          planInterval === iv ? "gradient-primary text-white" : "bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {iv}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Pro subscribers */}
            <Card className="p-6 rounded-2xl border-2">
              <h2 className="font-bold text-lg mb-1">Pro subscribers</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Emails granted Pro features (automatic mode, custom sponsor ads). One per line. Admins are always Pro.
              </p>
              <Textarea
                placeholder="alice@example.com&#10;bob@example.com"
                value={proEmails}
                onChange={(e) => setProEmails(e.target.value)}
                rows={5}
                className="rounded-xl font-mono text-sm"
              />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
