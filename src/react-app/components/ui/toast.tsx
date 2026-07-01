import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/react-app/lib/utils";

type ToastType = "error" | "success" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (type: ToastType, title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const toastStyles: Record<ToastType, { bg: string; icon: typeof AlertCircle; iconColor: string }> = {
  error: {
    bg: "bg-destructive/10 border-destructive/30",
    icon: AlertCircle,
    iconColor: "text-destructive",
  },
  success: {
    bg: "bg-green-500/10 border-green-500/30",
    icon: CheckCircle,
    iconColor: "text-green-500",
  },
  info: {
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: Info,
    iconColor: "text-blue-500",
  },
  warning: {
    bg: "bg-yellow-500/10 border-yellow-500/30",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const style = toastStyles[toast.type];
  const Icon = style.icon;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 fade-in duration-200",
        style.bg
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", style.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-muted-foreground mt-1">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const showError = useCallback((title: string, message?: string) => {
    showToast("error", title, message);
  }, [showToast]);

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast("success", title, message);
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string) => {
    showToast("info", title, message);
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    showToast("warning", title, message);
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, showError, showSuccess, showInfo, showWarning, removeToast }}
    >
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
