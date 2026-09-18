import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Card } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import type { ClientErrorReport } from "@/shared/types";
import { getClientErrors } from "@/react-app/lib/data";

/** What each reporting stage means, in plain words, for the admin. */
const STAGE_LABEL: Record<string, string> = {
  appcheck: "Security check failed",
  auth: "Sign-in failed",
  "join-link": "Join link failed",
  "join-pin": "PIN lookup failed",
  join: "Joining failed",
  session: "Lost live connection",
  submit: "Answer not sent",
  notes: "Sticky note not sent",
  render: "Screen crashed",
  window: "Script error",
  promise: "Background error",
};

function topCounts(items: string[], n = 5): [string, number][] {
  const m = new Map<string, number>();
  items.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function ClientErrorsPanel() {
  const [reports, setReports] = useState<ClientErrorReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinFilter, setPinFilter] = useState("");

  const load = () => {
    setError(null);
    setReports(null);
    getClientErrors(200)
      .then(setReports)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load reports"));
  };
  useEffect(load, []);

  const shown = useMemo(
    () => (reports ?? []).filter((r) => !pinFilter || r.pin === pinFilter.trim()),
    [reports, pinFilter]
  );
  const dayAgo = Date.now() - 86_400_000;
  const lastDay = shown.filter((r) => new Date(r.createdAt).getTime() > dayAgo);
  const byStage = topCounts(lastDay.map((r) => STAGE_LABEL[r.stage] ?? r.stage));
  const byBrowser = topCounts(lastDay.map((r) => r.browser ?? "Unknown"));

  return (
    <Card className="p-6 rounded-2xl border-2">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Player connection errors</h2>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Failures reported by players' phones — what broke, on which browser and network. Kept 30 days.
      </p>

      <input
        value={pinFilter}
        onChange={(e) => setPinFilter(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="Filter by game PIN"
        inputMode="numeric"
        className="w-full sm:w-48 h-9 rounded-lg border border-border bg-card px-3 text-sm mb-4 focus:outline-none focus:border-primary"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!reports && !error && (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {reports && shown.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No errors reported. 🎉</p>
      )}

      {reports && shown.length > 0 && (
        <>
          {/* Last-24h summary */}
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Last 24h · {lastDay.length} reports
              </p>
              {byStage.map(([k, n]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">By browser</p>
              {byBrowser.map(([k, n]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Individual reports */}
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {shown.map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                  <span className="font-semibold">{STAGE_LABEL[r.stage] ?? r.stage}</span>
                  {r.code && (
                    <code className="text-xs bg-muted rounded px-1.5 py-0.5">{r.code}</code>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1">
                  {r.pin && <span>PIN {r.pin}</span>}
                  <span>{r.browser ?? "Unknown browser"}</span>
                  {r.online === false ? (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <WifiOff className="w-3 h-3" /> offline
                    </span>
                  ) : (
                    r.network && <span>{r.network}</span>
                  )}
                  {r.ipHash && <span title="Same value = same connection/venue">conn {r.ipHash}</span>}
                </div>
                {r.message && <p className="text-xs break-words line-clamp-2">{r.message}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
