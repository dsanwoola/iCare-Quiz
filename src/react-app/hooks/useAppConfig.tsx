import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { AppConfig } from "@/shared/types";
import { DEFAULT_APP_CONFIG, isProEmail } from "@/shared/types";
import { subscribeAppConfig } from "@/react-app/lib/data";

interface AppConfigContextValue {
  config: AppConfig;
  loading: boolean;
  /** Whether the given email is a Pro (paid) user under the current config. */
  isPro: (email?: string | null) => boolean;
}

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeAppConfig((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  return (
    <AppConfigContext.Provider
      value={{ config, loading, isPro: (email) => isProEmail(email ?? null, config.proEmails) }}
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
