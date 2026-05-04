// ============================================================
// Interval Mine — useTimerState Hook
// ============================================================
// Reads timer state from chrome.storage.local, listens for
// real-time updates, computes remaining time, and provides
// a function to send events to the background service worker.
//
// Design: The popup is EPHEMERAL — it can close at any time.
// State lives in background/storage. This hook is read-only
// except for sending events via chrome.runtime.sendMessage.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import type { TimerState, TimerEvent } from "../../types";
import { createInitialState } from "../../types";
import { getRemainingMs, recoverTimerState } from "../../timer";

export interface UseTimerStateResult {
  /** Current timer state (null while loading). */
  state: TimerState | null;
  /** Remaining milliseconds for the current phase. */
  remainingMs: number;
  /** Send an event to the background service worker. */
  sendEvent: (event: TimerEvent) => void;
}

/**
 * Hook that manages timer state for the popup.
 *
 * - Loads initial state from storage (with recovery for expired phases)
 * - Listens for storage changes (real-time sync from background)
 * - Polls remaining time every second for countdown display
 * - Provides sendEvent to dispatch events to background
 */
export function useTimerState(): UseTimerStateResult {
  const [state, setState] = useState<TimerState | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load initial state on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const recovered = await recoverTimerState();
      if (cancelled) return;
      if (recovered) {
        setState(recovered);
        setRemainingMs(getRemainingMs(recovered));
      } else {
        const initial = createInitialState();
        setState(initial);
        setRemainingMs(0);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Listen for storage changes from background ───────────
  useEffect(() => {
    function handleStorageChange(
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) {
      if (area !== "local") return;
      if (!changes["interval-mine-state"]) return;

      const newState = changes["interval-mine-state"].newValue as
        | TimerState
        | undefined;
      if (newState) {
        setState(newState);
        setRemainingMs(getRemainingMs(newState));
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // ── Poll remaining time every second ─────────────────────
  useEffect(() => {
    if (!state || state.status !== "running") {
      // No polling needed when idle, paused, or complete
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        // Recompute from state to avoid stale closures
        if (!state) return prev;
        const ms = getRemainingMs(state);
        return Math.max(0, ms);
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state?.status, state?.startedAt, state?.pausedAt, state?.phase]);

  // ── Send event to background ─────────────────────────────
  const sendEvent = useCallback((event: TimerEvent) => {
    chrome.runtime.sendMessage({ type: "TIMER_EVENT", event });
  }, []);

  return { state, remainingMs, sendEvent };
}
