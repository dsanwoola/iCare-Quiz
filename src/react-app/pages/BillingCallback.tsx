import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { Card } from "@/react-app/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { verifyProPayment } from "@/react-app/lib/data";
import { useAuth } from "@/react-app/hooks/useAuth";

type State = "checking" | "success" | "failed";

export default function BillingCallback() {
  const [params] = useSearchParams();
  const { isPending, isHost } = useAuth();
  const [state, setState] = useState<State>("checking");

  const status = params.get("status");
  const transactionId = params.get("transaction_id");

  useEffect(() => {
    if (isPending) return;
    if (!isHost) {
      setState("failed");
      return;
    }
    if ((status && status !== "successful" && status !== "completed") || !transactionId) {
      setState("failed");
      return;
    }
    verifyProPayment(transactionId)
      .then((s) => setState(s === "success" ? "success" : "failed"))
      .catch(() => setState("failed"));
  }, [isPending, isHost, status, transactionId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-8 rounded-3xl border-2 max-w-md w-full text-center">
        {state === "checking" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-1">Confirming your payment…</h1>
            <p className="text-muted-foreground">Just a moment.</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-green-500" />
            </div>
            <h1 className="text-2xl font-black mb-2">Welcome to Pro! 🎉</h1>
            <p className="text-muted-foreground mb-6">
              Automatic mode and sponsor ads are unlocked on your account.
            </p>
            <Link to="/host">
              <Button className="gradient-primary text-white border-0 rounded-xl">Go to Dashboard</Button>
            </Link>
          </>
        )}
        {state === "failed" && (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-destructive" />
            </div>
            <h1 className="text-xl font-bold mb-2">Payment not completed</h1>
            <p className="text-muted-foreground mb-6">
              If you were charged, your account will update automatically within a minute. Otherwise, try again.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/upgrade">
                <Button className="gradient-primary text-white border-0 rounded-xl">Try again</Button>
              </Link>
              <Link to="/host">
                <Button variant="outline" className="rounded-xl">Dashboard</Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
