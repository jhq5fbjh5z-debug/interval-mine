// ============================================================
// Interval Mine — Cycle State Machine
// ============================================================
//
// Pure-function state machine governing the focus/break/long-break cycle.
//
// Two-Axis Model
// ──────────────
// The machine tracks two independent axes:
//   Phase  — WHAT the user is doing: "focus", "break", "long_break"
//   Status — HOW the timer behaves:  "idle", "running", "paused", "complete"
//
// Combined, these axes produce 8 reachable states:
//   idle             = phase: focus,       status: idle
//   focusing         = phase: focus,       status: running
//   paused_focusing  = phase: focus,       status: paused
//   break            = phase: break,       status: running
//   paused_break     = phase: break,       status: paused
//   long_break       = phase: long_break,  status: running
//   paused_long_break= phase: long_break,  status: paused
//   cycle_complete   = phase: long_break,  status: complete
//
// All transitions are deterministic and pure — same input always produces
// the same output. Side effects (notify, setAlarm, clearAlarm) are returned
// as an array for the caller to execute.
// ============================================================

import type {
  TimerState,
  TimerEvent,
  TransitionResult,
  Config,
} from "./types";
import { DEFAULT_CONFIG } from "./types";

// ── Public API ────────────────────────────────────────────────

/**
 * Create a fresh idle TimerState.
 *
 * @param config - Optional partial config merged with defaults.
 * @returns A new TimerState at idle with zero sessions.
 */
export function createInitialState(
  config?: Partial<Config>,
): TimerState {
  return {
    phase: "focus",
    status: "idle",
    startedAt: null,
    pausedAt: null,
    sessionsCompleted: 0,
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

/**
 * Pure state machine transition.
 *
 * Given the current TimerState and a TimerEvent, returns the next state
 * and any side effects the caller should execute.
 *
 * @param state - Current timer state.
 * @param event - Event to process.
 * @returns New state + effects array.
 */
export function transition(
  state: TimerState,
  event: TimerEvent,
): TransitionResult {
  // ── CONFIG_CHANGE ──────────────────────────────────────────
  // When idle: update config in place.
  // When active: reset to idle with new config.
  if (event.type === "CONFIG_CHANGE") {
    const newConfig = event.payload.config;
    if (state.status === "idle") {
      return { state: { ...state, config: newConfig }, effects: [] };
    }
    return {
      state: {
        ...createInitialState(newConfig),
        config: newConfig,
      },
      effects: ["clearAlarm"],
    };
  }

  // ── RESET from any non-idle state → idle ───────────────────
  if (event.type === "RESET" && state.status !== "idle") {
    return {
      state: {
        ...state,
        phase: "focus",
        status: "idle",
        startedAt: null,
        pausedAt: null,
        sessionsCompleted: 0,
      },
      effects: ["clearAlarm"],
    };
  }

  // ── START from idle ────────────────────────────────────────
  if (event.type === "START" && state.status === "idle") {
    return {
      state: {
        ...state,
        phase: "focus",
        status: "running",
        startedAt: Date.now(),
        pausedAt: null,
      },
      effects: ["setAlarm"],
    };
  }

  // ── START from cycle_complete → new cycle ──────────────────
  if (event.type === "START" && state.status === "complete") {
    return {
      state: {
        ...state,
        phase: "focus",
        status: "running",
        startedAt: Date.now(),
        pausedAt: null,
        sessionsCompleted: 0,
      },
      effects: ["setAlarm"],
    };
  }

  // ── PAUSE from running → paused ────────────────────────────
  if (event.type === "PAUSE" && state.status === "running") {
    return {
      state: {
        ...state,
        status: "paused",
        pausedAt: Date.now(),
      },
      effects: ["clearAlarm"],
    };
  }

  // ── RESUME from paused → running (adjust startedAt) ───────
  if (event.type === "RESUME" && state.status === "paused") {
    const now = Date.now();
    const pauseDuration = now - state.pausedAt!;
    return {
      state: {
        ...state,
        status: "running",
        startedAt: state.startedAt! + pauseDuration,
        pausedAt: null,
      },
      effects: ["setAlarm"],
    };
  }

  // ── COMPLETE (PHASE_COMPLETE) ──────────────────────────────
  if (event.type === "COMPLETE") {
    return handlePhaseComplete(state);
  }

  // ── SKIP from active state → next phase ────────────────────
  if (event.type === "SKIP" && state.status !== "idle" && state.status !== "complete") {
    return handleSkip(state);
  }

  // ── Fallback: no valid transition ──────────────────────────
  return { state, effects: [] };
}

// ── Internal Helpers ──────────────────────────────────────────

/**
 * Determine the next phase after a break or skip,
 * considering long break config and session count.
 */
function nextPhaseAfterBreak(config: Config, sessionsCompleted: number): "focus" | "long_break" {
  if (
    config.longBreakEnabled &&
    sessionsCompleted >= config.sessionsBeforeLongBreak
  ) {
    return "long_break";
  }
  return "focus";
}

/**
 * Handle COMPLETE event — transitions depend on current phase.
 */
function handlePhaseComplete(state: TimerState): TransitionResult {
  const now = Date.now();

  switch (state.phase) {
    // focusing COMPLETE → break (increment sessions)
    case "focus": {
      const newSessions = state.sessionsCompleted + 1;
      return {
        state: {
          ...state,
          phase: "break",
          status: "running",
          startedAt: now,
          pausedAt: null,
          sessionsCompleted: newSessions,
        },
        effects: ["notify", "setAlarm"],
      };
    }

    // break COMPLETE → focusing or long_break
    case "break": {
      const nextPhase = nextPhaseAfterBreak(
        state.config,
        state.sessionsCompleted,
      );
      return {
        state: {
          ...state,
          phase: nextPhase,
          status: "running",
          startedAt: now,
          pausedAt: null,
        },
        effects: ["notify", "setAlarm"],
      };
    }

    // long_break COMPLETE → cycle_complete (reset sessions)
    case "long_break": {
      return {
        state: {
          ...state,
          status: "complete",
          startedAt: null,
          pausedAt: null,
          sessionsCompleted: 0,
        },
        effects: ["notify", "clearAlarm"],
      };
    }

    default:
      return { state, effects: [] };
  }
}

/**
 * Handle SKIP event — skip current phase, move to next.
 * Per spec: skip transitions silently (no notification).
 */
function handleSkip(state: TimerState): TransitionResult {
  switch (state.phase) {
    case "focus":
      return {
        state: {
          ...state,
          phase: "break",
          status: "running",
          startedAt: Date.now(),
          pausedAt: null,
        },
        effects: ["setAlarm"],
      };

    case "break": {
      const nextPhase = nextPhaseAfterBreak(
        state.config,
        state.sessionsCompleted,
      );
      return {
        state: {
          ...state,
          phase: nextPhase,
          status: "running",
          startedAt: Date.now(),
          pausedAt: null,
        },
        effects: ["setAlarm"],
      };
    }

    case "long_break":
      return {
        state: {
          ...state,
          status: "complete",
          startedAt: null,
          pausedAt: null,
          sessionsCompleted: 0,
        },
        effects: ["clearAlarm"],
      };

    default:
      return { state, effects: [] };
  }
}
