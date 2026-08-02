import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Card } from "@/react-app/components/ui/card";
import { Switch } from "@/react-app/components/ui/switch";
import { useToast } from "@/react-app/components/ui/toast";
import { ArrowLeft, ShieldCheck, Loader2, Save, Zap, Hand, Megaphone, ImagePlus, Trash2 } from "lucide-react";
import type { GameMode } from "@/shared/types";
import { GET_READY_OPTIONS } from "@/shared/types";
import { useAppConfig } from "@/react-app/hooks/useAppConfig";
import { updateAppConfig, uploadLogo } from "@/react-app/lib/data";

export default function AdminPage() {
  const { config, loading } = useAppConfig();
  const { showSuccess, showError } = useToast();

  const [gameMode, setGameMode] = useState<GameMode>("manual");
  const [seconds, setSeconds] = useState(10);
  const [sound, setSound] = useState(true);
  const [adText, setAdText] = useState("");
  const [adImage, setAdImage] = useState("");
  const [adUrl, setAdUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [proEmails, setProEmails] = useState("");
  const [catCurrency, setCatCurrency] = useState("NGN");
  const [proMo, setProMo] = useState("5000");
  const [proYr, setProYr] = useState("50000");
  const [bizMo, setBizMo] = useState("20000");
  const [bizYr, setBizYr] = useState("200000");
  const [capFree, setCapFree] = useState("10");
  const [capPro, setCapPro] = useState("300");
  const [capBiz, setCapBiz] = useState("2000");
  const [aiFree, setAiFree] = useState("3");
  const [aiPro, setAiPro] = useState("50");
  const [aiBiz, setAiBiz] = useState("-1");
  const [trialDays, setTrialDays] = useState("7");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    setGameMode(config.defaultGameMode);
    setSeconds(config.defaultCountdownSeconds);
    setSound(config.countdownSoundEnabled);
    setAdText(config.defaultAd?.text ?? "");
    setAdImage(config.defaultAd?.imageUrl ?? "");
    setAdUrl(config.defaultAd?.url ?? "");
    setCoverUrl(config.defaultCoverImageUrl ?? "");
    setProEmails(config.proEmails.join("\n"));
    setCatCurrency(config.plans.currency);
    setProMo(String(config.plans.pro.monthlyAmount));
    setProYr(String(config.plans.pro.annualAmount));
    setBizMo(String(config.plans.business.monthlyAmount));
    setBizYr(String(config.plans.business.annualAmount));
    setCapFree(String(config.limits.maxPlayers.free));
    setCapPro(String(config.limits.maxPlayers.pro));
    setCapBiz(String(config.limits.maxPlayers.business));
    setAiFree(String(config.limits.aiMonthlyQuota.free));
    setAiPro(String(config.limits.aiMonthlyQuota.pro));
    setAiBiz(String(config.limits.aiMonthlyQuota.business));
    setTrialDays(String(config.trialDays));
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
        defaultCoverImageUrl: coverUrl.trim() || null,
        proEmails: emails,
        proPlan: {
          name: "Pro",
          amount: Math.max(0, Number(proMo) || 0),
          currency: (catCurrency.trim() || "NGN").toUpperCase(),
          interval: "monthly",
        },
        plans: {
          currency: (catCurrency.trim() || "NGN").toUpperCase(),
          pro: { monthlyAmount: Math.max(0, Number(proMo) || 0), annualAmount: Math.max(0, Number(proYr) || 0) },
          business: { monthlyAmount: Math.max(0, Number(bizMo) || 0), annualAmount: Math.max(0, Number(bizYr) || 0) },
        },
        limits: {
          maxPlayers: {
            free: Math.max(1, Number(capFree) || 1),
            pro: Math.max(1, Number(capPro) || 1),
            business: Math.max(1, Number(capBiz) || 1),
          },
          aiMonthlyQuota: {
            free: Number(aiFree) || 0,
            pro: Number(aiPro) || 0,
            business: Number(aiBiz), // -1 = unlimited
          },
        },
        trialDays: Math.max(0, Number(trialDays) || 0),
      });
      showSuccess("Settings saved", "Applies to new games across the app");
    } catch {
      showError("Failed to save", "Please try again");
    } finally {
      setSaving(false);
    }
  };

  const pickCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      setCoverUrl(await uploadLogo(file));
    } catch {
      showError("Couldn't upload image", "Please try a different file");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
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

            {/* Default lobby cover image */}
            <Card className="p-6 rounded-2xl border-2">
              <div className="flex items-center gap-2 mb-1">
                <ImagePlus className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Default lobby cover</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Full-screen image shown on players' phones in the waiting lobby when a host hasn't uploaded their own
                cover. Leave empty for no default.
              </p>
              {coverUrl ? (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={coverUrl} alt="Default cover" className="w-full h-44 object-cover" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCoverUrl("")}
                    className="absolute top-2 right-2 h-8 rounded-lg bg-card/90"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground hover:border-primary disabled:opacity-60"
                >
                  {uploadingCover ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  {uploadingCover ? "Uploading…" : "Upload a default cover"}
                </button>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={pickCover} />
              <p className="text-[11px] text-muted-foreground mt-2">Click Save to apply.</p>
            </Card>

            {/* Plans, tiers & limits */}
            <Card className="p-6 rounded-2xl border-2">
              <h2 className="font-bold text-lg mb-1">Plans, tiers &amp; limits</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Prices (charged via Flutterwave), player caps and AI quotas per tier. AI quota −1 = unlimited.
              </p>

              <div className="mb-4">
                <label className="text-sm font-medium mb-1.5 block">Currency</label>
                <Input
                  value={catCurrency}
                  onChange={(e) => setCatCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="NGN"
                  className="rounded-xl uppercase w-32"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-y-1">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="font-medium pb-1"></th>
                      <th className="font-medium pb-1">Free</th>
                      <th className="font-medium pb-1">Pro</th>
                      <th className="font-medium pb-1">Business</th>
                    </tr>
                  </thead>
                  <tbody className="[&_input]:rounded-lg [&_input]:h-9">
                    <tr>
                      <td className="pr-3 font-medium">Price / mo</td>
                      <td className="pr-2 text-muted-foreground">—</td>
                      <td className="pr-2"><Input type="number" value={proMo} onChange={(e) => setProMo(e.target.value)} /></td>
                      <td><Input type="number" value={bizMo} onChange={(e) => setBizMo(e.target.value)} /></td>
                    </tr>
                    <tr>
                      <td className="pr-3 font-medium">Price / yr</td>
                      <td className="pr-2 text-muted-foreground">—</td>
                      <td className="pr-2"><Input type="number" value={proYr} onChange={(e) => setProYr(e.target.value)} /></td>
                      <td><Input type="number" value={bizYr} onChange={(e) => setBizYr(e.target.value)} /></td>
                    </tr>
                    <tr>
                      <td className="pr-3 font-medium">Players / game</td>
                      <td className="pr-2"><Input type="number" value={capFree} onChange={(e) => setCapFree(e.target.value)} /></td>
                      <td className="pr-2"><Input type="number" value={capPro} onChange={(e) => setCapPro(e.target.value)} /></td>
                      <td><Input type="number" value={capBiz} onChange={(e) => setCapBiz(e.target.value)} /></td>
                    </tr>
                    <tr>
                      <td className="pr-3 font-medium">AI / month</td>
                      <td className="pr-2"><Input type="number" value={aiFree} onChange={(e) => setAiFree(e.target.value)} /></td>
                      <td className="pr-2"><Input type="number" value={aiPro} onChange={(e) => setAiPro(e.target.value)} /></td>
                      <td><Input type="number" value={aiBiz} onChange={(e) => setAiBiz(e.target.value)} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <label className="text-sm font-medium">Free trial (days)</label>
                <Input
                  type="number"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  className="rounded-lg h-9 w-24"
                />
                <span className="text-xs text-muted-foreground">0 = no trial</span>
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
