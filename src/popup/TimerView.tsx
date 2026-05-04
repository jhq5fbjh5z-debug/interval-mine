// ============================================================
// Interval Mine — Timer View Component
// ============================================================
// Displays the active timer: phase indicator, countdown,
// session count, and phase-aware controls.
//
// Reads state from useTimerState hook. Sends events to
// background via chrome.runtime.sendMessage.
// ============================================================

import React from "react";
import type { TimerState } from "../types";
import {
  getPhaseLabel,
  getPhaseEmoji,
  formatTime,
} from "../timer";
import type { UseTimerStateResult } from "./hooks/useTimerState";

interface TimerViewProps {
  /** Timer state and helpers from useTimerState. */
  timer: UseTimerStateResult;
}

/**
 * Active timer display with phase indicator, countdown,
 * session count, and phase-aware controls.
 */
export function TimerView({ timer }: TimerViewProps) {
  const { state, remainingMs, sendEvent } = timer;

  if (!state) return null;

  const isActive = state.status === "running" || state.status === "paused";

  return (
    <div className={`timer-view timer-view--${state.phase}`}>
      {/* Phase indicator */}
      <div className="timer-view__phase">
        <span className="timer-view__emoji" role="img" aria-label={getPhaseLabel(state.phase)}>
          {state.status === "complete" ? "✅" : getPhaseEmoji(state.phase)}
        </span>
        <span className="timer-view__label">
          {state.status === "complete" ? "Cycle Complete" : getPhaseLabel(state.phase)}
        </span>
      </div>

      {/* Countdown — only when not idle or complete */}
      {isActive && (
        <div className="timer-view__countdown" aria-live="polite" aria-atomic="true">
          {formatTime(remainingMs)}
        </div>
      )}

      {/* Session count — only when long break is enabled */}
      {state.config.longBreakEnabled && (
        <div className="timer-view__sessions">
          {state.sessionsCompleted} / {state.config.sessionsBeforeLongBreak} sessions
        </div>
      )}

      {/* Controls */}
      <div className="timer-view__controls">
        <Controls state={state} sendEvent={sendEvent} />
      </div>
    </div>
  );
}

// ── Phase-Aware Controls ───────────────────────────────────

interface ControlsProps {
  state: TimerState;
  sendEvent: UseTimerStateResult["sendEvent"];
}

function Controls({ state, sendEvent }: ControlsProps) {
  switch (state.status) {
    case "idle":
      return (
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => sendEvent({ type: "START" })}
        >
          ▶ Start
        </button>
      );

    case "running":
      return (
        <>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => sendEvent({ type: "PAUSE" })}
          >
            ⏸ Pause
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => sendEvent({ type: "SKIP" })}
          >
            ⏭ Skip
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => sendEvent({ type: "RESET" })}
          >
            ↺ Reset
          </button>
        </>
      );

    case "paused":
      return (
        <>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => sendEvent({ type: "RESUME" })}
          >
            ▶ Resume
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => sendEvent({ type: "SKIP" })}
          >
            ⏭ Skip
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => sendEvent({ type: "RESET" })}
          >
            ↺ Reset
          </button>
        </>
      );

    case "complete":
      return (
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => sendEvent({ type: "START" })}
        >
          ▶ Start New Cycle
        </button>
      );

    default:
      return null;
  }
}
