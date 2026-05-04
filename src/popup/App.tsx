// ============================================================
// Interval Mine — Root Popup Component
// ============================================================
// Wires up TimerView and ConfigView based on current state.
//
// State flow:
// - idle → show ConfigView (editable)
// - running/paused/complete → show TimerView
//
// All state reads from useTimerState hook (storage + polling).
// Events sent to background via chrome.runtime.sendMessage.
// ============================================================

import React, { useCallback } from "react";
import { useTimerState } from "./hooks/useTimerState";
import { TimerView } from "./TimerView";
import { ConfigView } from "./ConfigView";
import type { Config } from "../types";
import "./styles.css";

export function App() {
  const timer = useTimerState();
  const { state, sendEvent } = timer;

  const handleConfigChange = useCallback(
    (config: Config) => {
      sendEvent({ type: "CONFIG_CHANGE", payload: { config } });
    },
    [sendEvent],
  );

  // Loading state
  if (!state) {
    return (
      <div className="app">
        <div className="loading">Loading…</div>
      </div>
    );
  }

  const isIdle = state.status === "idle";

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">⛏️ Interval Mine</h1>
      </header>

      {/* Config view — only when idle */}
      {isIdle && (
        <ConfigView
          config={state.config}
          onConfigChange={handleConfigChange}
          disabled={false}
        />
      )}

      {/* Timer view — always shown (controls adapt to state) */}
      <TimerView timer={timer} />
    </div>
  );
}
