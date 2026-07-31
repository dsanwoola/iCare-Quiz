import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { AppConfig, Subscription } from "@/shared/types";
import { DEFAULT_APP_CONFIG, isProEmail, isAdminEmail } from "@/shared/types";
import { subscribeAppConfig, subscribeSubscription } from "@/react-app/lib/data";
import { useAuth } from "@/react-app/hooks/useAuth";

interface AppConfigContextValue {
  config: AppConfig;
  loading: boolean;
  /** The signed-in user's paid subscription (null if none). */
  subscription: Subscription | null;
  /** Is the signed-in user Pro? (admin, comped email, or an active subscription) */
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
  const isProUser =
    isAdminEmail(email) ||
    isProEmail(email, config.proEmails) ||
    subscription?.status === "active";

  return (
    <AppConfigContext.Provider
      value={{
        config,
        loading,
        subscription,
        isProUser,
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
