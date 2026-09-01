import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { AppConfig, Subscription, Tier } from "@/shared/types";
import { DEFAULT_APP_CONFIG, isProEmail, isAdminEmail, tierAtLeast } from "@/shared/types";
import { subscribeAppConfig, subscribeSubscription } from "@/react-app/lib/data";
import { useAuth } from "@/react-app/hooks/useAuth";

interface AppConfigContextValue {
  config: AppConfig;
  loading: boolean;
  /** The signed-in user's paid subscription (null if none). */
  subscription: Subscription | null;
  /** The signed-in user's effective tier (admin → business; comp → pro; else sub or free). */
  tier: Tier;
  /** True when the signed-in user is an app super-admin (ADMIN_EMAILS). */
  isAdmin: boolean;
  /** True when the effective tier is at least `min`. */
  atLeast: (min: Tier) => boolean;
  /** Is the signed-in user Pro or higher? (back-compat convenience) */
  isProUser: boolean;
  /** Is the given email Pro via admin/comp list (not per-user subscription)? */
  isPro: (email?: string | null) => boolean;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const { user, isHost } = useAuth();
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    return subscribeAppConfig((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isHost || !user) {
      setSubscription(null);
      return;
    }
    return subscribeSubscription(user.id, setSubscription);
  }, [isHost, user?.id]);

  const email = user?.email ?? null;
  const isAdmin = isAdminEmail(email);
  const tier: Tier = isAdmin
    ? "business"
    : isProEmail(email, config.proEmails)
    ? "pro"
    : subscription?.tier ?? "free";
  const atLeast = (min: Tier) => tierAtLeast(tier, min);

  return (
    <AppConfigContext.Provider
      value={{
        config,
        loading,
        subscription,
        tier,
        isAdmin,
        atLeast,
        isProUser: atLeast("pro"),
        isPro: (e) => isProEmail(e ?? null, config.proEmails),
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within an AppConfigProvider");
  return ctx;
}
