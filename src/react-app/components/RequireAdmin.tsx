import { ReactNode } from "react";
import { Link } from "react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { Button } from "@/react-app/components/ui/button";

/** Gates admin-only routes (email allow-list; also enforced by Firestore rules). */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Admins only</h1>
          <p className="text-muted-foreground mb-6">You don't have access to this page.</p>
          <Link to="/">
            <Button variant="outline" className="rounded-xl">Back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
