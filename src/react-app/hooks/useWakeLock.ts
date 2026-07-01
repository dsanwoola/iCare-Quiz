import { useEffect, useRef } from "react";

/**
 * Hook to keep the screen awake during gameplay using the Screen Wake Lock API.
 * Automatically requests a wake lock when mounted and releases it when unmounted.
 * Also handles re-acquiring the lock when the page becomes visible again.
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    // Check if the Wake Lock API is supported
    if (!("wakeLock" in navigator)) {
      console.log("Wake Lock API not supported");
      return;
    }

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        console.log("Wake lock acquired");

        wakeLockRef.current.addEventListener("release", () => {
          console.log("Wake lock released");
        });
      } catch (err) {
        // Wake lock request failed - usually due to low battery or system restrictions
        console.log("Wake lock request failed:", err);
      }
    };

    // Request wake lock on mount
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup: release wake lock and remove event listener
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);
}
