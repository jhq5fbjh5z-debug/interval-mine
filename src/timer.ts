// ============================================================
// Interval Mine — Timer Calculation Utilities
// ============================================================
// Pure functions for computing remaining time, formatting
// display, and recovering timer state after popup re-open.
//
// Design: chrome.alarms has 1-minute minimum granularity.
// We use Date.now() timestamps for display precision — the
// alarm is only a wake-up signal, not the source of truth.
// ============================================================

import type { TimerState, Phase, Config } from "./types";
import { transition } from "./state-machine";
import { loadState, saveState } from "./storage";

// ── Phase Duration Helpers ────────────────────────────────────

/**
 * Get the configured duration for a phase in milliseconds.
 */
export function getPhaseDurationMs(phase: Phase, config: Config): number {
  switch (phase) {
    case "focus":
      return config.focusMinutes * 60_000;
    case "break":
      return config.breakMinutes * 60_000;
    case "long_break":
      return config.longBreakMinutes * 60_000;
  }
}

/**
 * Get the alarm delay in whole minutes for chrome.alarms.create.
 * Minimum 1 minute (chrome.alarms constraint).
 */
export function getAlarmDelayMinutes(state: TimerState): number {
  if (!state.startedAt) return 0;
  const durationMs = getPhaseDurationMs(state.phase, state.config);
  const remainingMs = durationMs - (Date.now() - state.startedAt);
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

// ── Remaining Time ────────────────────────────────────────────

/**
 * Compute remaining milliseconds for the current phase.
 *
 * - Running:  duration - (Date.now() - startedAt)
 * - Paused:   duration - (pausedAt - startedAt)  (frozen)
 * - Idle/Complete: 0
 *
 * Returns 0 or negative if the phase has expired.
 */
export function getRemainingMs(state: TimerState): number {
  if (!state.startedAt) return 0;

  const durationMs = getPhaseDurationMs(state.phase, state.config);

  if (state.status === "paused" && state.pausedAt) {
    return durationMs - (state.pausedAt - state.startedAt);
  }

  if (state.status === "running") {
    return durationMs - (Date.now() - state.startedAt);
  }

  return 0;
}

/**
 * Whether the current phase's time has elapsed.
 */
export function isExpired(state: TimerState): boolean {
  if (state.status !== "running") return false;
  return getRemainingMs(state) <= 0;
}

// ── Display Formatting ────────────────────────────────────────

/**
 * Format milliseconds as "MM:SS" for the countdown display.
 * Floors to whole seconds. Returns "00:00" for zero/negative.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Human-readable label for the current phase.
 */
export function getPhaseLabel(phase: Phase): string {
  switch (phase) {
    case "focus":
      return "Focus";
    case "break":
      return "Break";
    case "long_break":
      return "Long Break";
  }
}

/**
 * Emoji indicator for the current phase.
 */
export function getPhaseEmoji(phase: Phase): string {
  switch (phase) {
    case "focus":
      return "🎯";
    case "break":
      return "☕";
    case "long_break":
      return "🌴";
  }
}

// ── Recovery ──────────────────────────────────────────────────

/**
 * Recover timer state when the popup opens.
 *
 * Handles edge cases:
 * - Service worker killed mid-transition
 * - System sleep/lock for hours (missed alarm)
 * - Multiple phase completions while away
 *
 * Reads fresh state from storage, checks if the current phase
 * has expired, and auto-transitions if needed. Chains transitions
 * until we reach a non-expired running state or idle/complete.
 *
 * @returns The recovered state (already persisted to storage),
 *          or null if no state exists in storage.
 */
export async function recoverTimerState(): Promise<TimerState | null> {
  let state = await loadState();
  if (!state) return null;

  // Only running states can be expired
  if (state.status !== "running") return state;

  // Chain transitions until we reach a non-expired state
  // or a terminal state (idle/complete).
  let safety = 10; // prevent infinite loops
  while (isExpired(state) && safety-- > 0) {
    const result = transition(state, { type: "COMPLETE" });
    state = result.state;
    await saveState(state);

    // If we transitioned to a new running state, it might
    // also be expired (system was asleep for hours).
    // Loop continues to check.
    if (state.status !== "running") break;
  }

  return state;
}
