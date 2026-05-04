// ============================================================
// Interval Mine — Domain Types
// ============================================================
// Design interfaces per sdd/design. Two-axis state model:
//   Phase = WHAT the user is doing (focus, break, long break)
//   Status = HOW the timer behaves (idle, running, paused, complete)
// ============================================================

/** Which work/rest phase the user is in. */
export type Phase = "focus" | "break" | "long_break";

/** Timer behaviour status. */
export type Status = "idle" | "running" | "paused" | "complete";

/** Full timer state persisted to chrome.storage.local. */
export interface TimerState {
  phase: Phase;
  status: Status;
  /** Date.now() when the current phase started (null when idle/complete). */
  startedAt: number | null;
  /** Date.now() when the timer was paused (null when not paused). */
  pausedAt: number | null;
  /** Number of focus sessions completed in the current cycle. */
  sessionsCompleted: number;
  config: Config;
}

/** User-configurable timer settings. */
export interface Config {
  /** Focus duration in minutes (default 25). */
  focusMinutes: number;
  /** Short break duration in minutes (default 5). */
  breakMinutes: number;
  /** Long break duration in minutes (default 15). */
  longBreakMinutes: number;
  /** Number of focus sessions before a long break (default 4). */
  sessionsBeforeLongBreak: number;
  /** Whether long breaks are enabled (default false). */
  longBreakEnabled: boolean;
}

/** Events that drive the state machine. */
export type TimerEvent =
  | { type: "START" }
  | { type: "COMPLETE" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SKIP" }
  | { type: "RESET" }
  | { type: "CONFIG_CHANGE"; payload: { config: Config } };

/** Side effects produced by state transitions. */
export type Effect = "notify" | "setAlarm" | "clearAlarm";

/** Result of a state machine transition. */
export interface TransitionResult {
  state: TimerState;
  effects: Effect[];
}

/** Default configuration values. */
export const DEFAULT_CONFIG: Config = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  longBreakEnabled: false,
};

/** Create a fresh idle TimerState with default config. */
export function createInitialState(config: Config = DEFAULT_CONFIG): TimerState {
  return {
    phase: "focus",
    status: "idle",
    startedAt: null,
    pausedAt: null,
    sessionsCompleted: 0,
    config,
  };
}
