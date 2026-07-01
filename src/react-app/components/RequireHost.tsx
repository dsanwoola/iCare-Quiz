import { ReactNode, useState } from "react";
import { Link } from "react-router";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { Button } from "@/react-app/components/ui/button";
import AuthDialog from "@/react-app/components/AuthDialog";

/** Gates host-only routes. Anonymous players and signed-out users can't enter. */
export default function RequireHost({ children }: { children: ReactNode }) {
  const { isHost, isPending } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Host sign-in required</h1>
          <p className="text-muted-foreground mb-6">
            Sign in with a host account to create and run quizzes.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              className="gradient-primary text-white border-0 rounded-xl"
              onClick={() => setAuthOpen(true)}
            >
              Sign In
            </Button>
            <Link to="/">
              <Button variant="outline" className="rounded-xl">
                Back home
              </Button>
            </Link>
          </div>
        </div>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  return <>{children}</>;
}
