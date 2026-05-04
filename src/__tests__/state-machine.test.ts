// ============================================================
// State Machine — Exhaustive Transition Tests
// ============================================================
// Two-axis model: Phase (what) + Status (how).
// 8 reachable states: idle, focusing, break, long_break,
//   cycle_complete, paused_focusing, paused_break, paused_long_break.
// 6 core events: START, PAUSE, RESUME, COMPLETE, SKIP, RESET + CONFIG_CHANGE.
//
// Design spec: sdd/Installable version in opera with initials features/spec/cycle-state-machine
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { transition, createInitialState } from "../state-machine";
import type { TimerState, Config } from "../types";

// ── Test Helpers ──────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  longBreakEnabled: false,
};

/** Build a state from explicit axis values. */
function makeState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    phase: "focus",
    status: "idle",
    startedAt: null,
    pausedAt: null,
    sessionsCompleted: 0,
    config: DEFAULT_CONFIG,
    ...overrides,
  };
}

// ── 18 Test Cases ─────────────────────────────────────────────

describe("State Machine", () => {
  // ── 1. idle + START → focusing ────────────────────────────
  it("1. idle + START → focusing (running, startedAt set, duration from config)", () => {
    const idle = makeState({ phase: "focus", status: "idle" });
    const result = transition(idle, { type: "START" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("running");
    expect(result.state.startedAt).toBeTypeOf("number");
    expect(result.state.pausedAt).toBeNull();
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.effects).toContain("setAlarm");
  });

  // ── 2. focusing + PAUSE → paused_focusing ─────────────────
  it("2. focusing + PAUSE → paused (pausedAt stored)", () => {
    const now = Date.now();
    const focusing = makeState({
      phase: "focus",
      status: "running",
      startedAt: now - 60_000,
    });
    const result = transition(focusing, { type: "PAUSE" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("paused");
    expect(result.state.pausedAt).toBeTypeOf("number");
    expect(result.state.startedAt).toBe(now - 60_000);
  });

  // ── 3. paused_focusing + RESUME → focusing ────────────────
  it("3. paused focusing + RESUME → focusing (startedAt adjusted by pause duration)", () => {
    const now = 1_000_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const startedAt = now - 120_000; // 2 min ago
    const pausedAt = now - 20_000; // paused 20s ago
    const pausedFocusing = makeState({
      phase: "focus",
      status: "paused",
      startedAt,
      pausedAt,
    });
    const result = transition(pausedFocusing, { type: "RESUME" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("running");
    expect(result.state.pausedAt).toBeNull();
    // startedAt should be shifted forward by pause duration (20s)
    expect(result.state.startedAt).toBe(startedAt + (now - pausedAt));
    expect(result.effects).toContain("setAlarm");
    vi.restoreAllMocks();
  });

  // ── 4. focusing + COMPLETE → break (increment sessions) ───
  it("4. focusing + COMPLETE → break (sessionsCompleted incremented)", () => {
    const focusing = makeState({
      phase: "focus",
      status: "running",
      startedAt: Date.now() - 25 * 60_000,
      sessionsCompleted: 2,
    });
    const result = transition(focusing, { type: "COMPLETE" });

    expect(result.state.phase).toBe("break");
    expect(result.state.status).toBe("running");
    expect(result.state.sessionsCompleted).toBe(3);
    expect(result.state.startedAt).toBeTypeOf("number");
    expect(result.state.pausedAt).toBeNull();
    expect(result.effects).toContain("notify");
    expect(result.effects).toContain("setAlarm");
  });

  // ── 5. break + PAUSE → paused_break ──────────────────────
  it("5. break + PAUSE → paused (pausedAt stored)", () => {
    const now = Date.now();
    const breakState = makeState({
      phase: "break",
      status: "running",
      startedAt: now - 60_000,
      sessionsCompleted: 1,
    });
    const result = transition(breakState, { type: "PAUSE" });

    expect(result.state.phase).toBe("break");
    expect(result.state.status).toBe("paused");
    expect(result.state.pausedAt).toBeTypeOf("number");
  });

  // ── 6. paused_break + RESUME → break ─────────────────────
  it("6. paused break + RESUME → break (startedAt adjusted)", () => {
    const now = 1_000_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const startedAt = now - 300_000;
    const pausedAt = now - 30_000;
    const pausedBreak = makeState({
      phase: "break",
      status: "paused",
      startedAt,
      pausedAt,
      sessionsCompleted: 1,
    });
    const result = transition(pausedBreak, { type: "RESUME" });

    expect(result.state.phase).toBe("break");
    expect(result.state.status).toBe("running");
    expect(result.state.pausedAt).toBeNull();
    expect(result.state.startedAt).toBe(startedAt + (now - pausedAt));
    expect(result.effects).toContain("setAlarm");
    vi.restoreAllMocks();
  });

  // ── 7. break + COMPLETE → focusing (long break disabled or sessions < threshold) ──
  it("7. break + COMPLETE → focusing when long break disabled", () => {
    const breakState = makeState({
      phase: "break",
      status: "running",
      startedAt: Date.now() - 5 * 60_000,
      sessionsCompleted: 1,
      config: { ...DEFAULT_CONFIG, longBreakEnabled: false },
    });
    const result = transition(breakState, { type: "COMPLETE" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("running");
    expect(result.state.sessionsCompleted).toBe(1);
    expect(result.effects).toContain("notify");
    expect(result.effects).toContain("setAlarm");
  });

  // ── 8. break + COMPLETE → long_break (long break enabled AND sessions >= threshold) ──
  it("8. break + COMPLETE → long_break when enabled and sessions = threshold", () => {
    const breakState = makeState({
      phase: "break",
      status: "running",
      startedAt: Date.now() - 5 * 60_000,
      sessionsCompleted: 4,
      config: { ...DEFAULT_CONFIG, longBreakEnabled: true, sessionsBeforeLongBreak: 4 },
    });
    const result = transition(breakState, { type: "COMPLETE" });

    expect(result.state.phase).toBe("long_break");
    expect(result.state.status).toBe("running");
    expect(result.state.sessionsCompleted).toBe(4);
    expect(result.effects).toContain("notify");
    expect(result.effects).toContain("setAlarm");
  });

  // ── 9. long_break + PAUSE → paused_long_break ────────────
  it("9. long_break + PAUSE → paused (pausedAt stored)", () => {
    const now = Date.now();
    const longBreak = makeState({
      phase: "long_break",
      status: "running",
      startedAt: now - 60_000,
      sessionsCompleted: 4,
    });
    const result = transition(longBreak, { type: "PAUSE" });

    expect(result.state.phase).toBe("long_break");
    expect(result.state.status).toBe("paused");
    expect(result.state.pausedAt).toBeTypeOf("number");
  });

  // ── 10. paused_long_break + RESUME → long_break ──────────
  it("10. paused long break + RESUME → long_break (startedAt adjusted)", () => {
    const now = 1_000_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const startedAt = now - 900_000;
    const pausedAt = now - 60_000;
    const pausedLongBreak = makeState({
      phase: "long_break",
      status: "paused",
      startedAt,
      pausedAt,
      sessionsCompleted: 4,
    });
    const result = transition(pausedLongBreak, { type: "RESUME" });

    expect(result.state.phase).toBe("long_break");
    expect(result.state.status).toBe("running");
    expect(result.state.pausedAt).toBeNull();
    expect(result.state.startedAt).toBe(startedAt + (now - pausedAt));
    expect(result.effects).toContain("setAlarm");
    vi.restoreAllMocks();
  });

  // ── 11. long_break + COMPLETE → cycle_complete (reset sessions) ──
  it("11. long_break + COMPLETE → cycle_complete (sessionsCompleted resets)", () => {
    const longBreak = makeState({
      phase: "long_break",
      status: "running",
      startedAt: Date.now() - 15 * 60_000,
      sessionsCompleted: 4,
    });
    const result = transition(longBreak, { type: "COMPLETE" });

    expect(result.state.phase).toBe("long_break");
    expect(result.state.status).toBe("complete");
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.state.startedAt).toBeNull();
    expect(result.effects).toContain("notify");
    expect(result.effects).toContain("clearAlarm");
  });

  // ── 12. cycle_complete + START → focusing (new cycle) ─────
  it("12. cycle_complete + START → focusing (new cycle begins)", () => {
    const cycleComplete = makeState({
      phase: "long_break",
      status: "complete",
      startedAt: null,
      sessionsCompleted: 0,
    });
    const result = transition(cycleComplete, { type: "START" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("running");
    expect(result.state.startedAt).toBeTypeOf("number");
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.effects).toContain("setAlarm");
  });

  // ── 13. ANY active state + RESET → idle ──────────────────
  it("13. ANY active state + RESET → idle (everything reset)", () => {
    const activeStates = [
      makeState({ phase: "focus", status: "running", startedAt: Date.now() }),
      makeState({ phase: "break", status: "running", startedAt: Date.now(), sessionsCompleted: 2 }),
      makeState({ phase: "long_break", status: "running", startedAt: Date.now(), sessionsCompleted: 4 }),
      makeState({ phase: "focus", status: "paused", startedAt: Date.now(), pausedAt: Date.now() }),
      makeState({ phase: "break", status: "paused", startedAt: Date.now(), pausedAt: Date.now() }),
      makeState({ phase: "long_break", status: "paused", startedAt: Date.now(), pausedAt: Date.now() }),
    ];

    for (const active of activeStates) {
      const result = transition(active, { type: "RESET" });
      expect(result.state.phase).toBe("focus");
      expect(result.state.status).toBe("idle");
      expect(result.state.startedAt).toBeNull();
      expect(result.state.pausedAt).toBeNull();
      expect(result.state.sessionsCompleted).toBe(0);
      expect(result.effects).toContain("clearAlarm");
    }
  });

  // ── 14. ANY active state + SKIP → next phase ─────────────
  it("14. SKIP from focusing → break", () => {
    const focusing = makeState({
      phase: "focus",
      status: "running",
      startedAt: Date.now(),
      sessionsCompleted: 1,
    });
    const result = transition(focusing, { type: "SKIP" });

    expect(result.state.phase).toBe("break");
    expect(result.state.status).toBe("running");
    expect(result.effects).toContain("setAlarm");
    expect(result.effects).not.toContain("notify");
  });

  it("14b. SKIP from break → focusing (long break disabled)", () => {
    const breakState = makeState({
      phase: "break",
      status: "running",
      startedAt: Date.now(),
      sessionsCompleted: 1,
      config: { ...DEFAULT_CONFIG, longBreakEnabled: false },
    });
    const result = transition(breakState, { type: "SKIP" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("running");
    expect(result.effects).toContain("setAlarm");
    expect(result.effects).not.toContain("notify");
  });

  it("14c. SKIP from break → long_break (enabled AND sessions >= threshold)", () => {
    const breakState = makeState({
      phase: "break",
      status: "running",
      startedAt: Date.now(),
      sessionsCompleted: 4,
      config: { ...DEFAULT_CONFIG, longBreakEnabled: true, sessionsBeforeLongBreak: 4 },
    });
    const result = transition(breakState, { type: "SKIP" });

    expect(result.state.phase).toBe("long_break");
    expect(result.state.status).toBe("running");
    expect(result.effects).toContain("setAlarm");
    expect(result.effects).not.toContain("notify");
  });

  it("14d. SKIP from long_break → cycle_complete", () => {
    const longBreak = makeState({
      phase: "long_break",
      status: "running",
      startedAt: Date.now(),
      sessionsCompleted: 4,
    });
    const result = transition(longBreak, { type: "SKIP" });

    expect(result.state.phase).toBe("long_break");
    expect(result.state.status).toBe("complete");
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.effects).toContain("clearAlarm");
    expect(result.effects).not.toContain("notify");
  });

  it("14e. SKIP from paused focusing → break", () => {
    const paused = makeState({
      phase: "focus",
      status: "paused",
      startedAt: Date.now(),
      pausedAt: Date.now(),
      sessionsCompleted: 2,
    });
    const result = transition(paused, { type: "SKIP" });

    expect(result.state.phase).toBe("break");
    expect(result.state.status).toBe("running");
    expect(result.effects).toContain("setAlarm");
    expect(result.effects).not.toContain("notify");
  });

  // ── 15. idle + CONFIG_CHANGE → idle (config updated) ─────
  it("15. idle + CONFIG_CHANGE → idle (config updated, no side effects)", () => {
    const idle = makeState({ phase: "focus", status: "idle" });
    const newConfig: Config = {
      focusMinutes: 50,
      breakMinutes: 10,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 6,
      longBreakEnabled: true,
    };
    const result = transition(idle, { type: "CONFIG_CHANGE", payload: { config: newConfig } });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("idle");
    expect(result.state.config).toEqual(newConfig);
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.effects).toEqual([]);
  });

  // ── 16. focusing + CONFIG_CHANGE → idle (reset, apply new config) ──
  it("16. focusing + CONFIG_CHANGE → idle (reset, new config applied)", () => {
    const focusing = makeState({
      phase: "focus",
      status: "running",
      startedAt: Date.now(),
      sessionsCompleted: 2,
    });
    const newConfig: Config = {
      focusMinutes: 40,
      breakMinutes: 8,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 5,
      longBreakEnabled: true,
    };
    const result = transition(focusing, { type: "CONFIG_CHANGE", payload: { config: newConfig } });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("idle");
    expect(result.state.startedAt).toBeNull();
    expect(result.state.pausedAt).toBeNull();
    expect(result.state.sessionsCompleted).toBe(0);
    expect(result.state.config).toEqual(newConfig);
    expect(result.effects).toContain("clearAlarm");
  });

  // ── 17. createInitialState() returns correct defaults ─────
  it("17. createInitialState() returns correct defaults", () => {
    const state = createInitialState();

    expect(state.phase).toBe("focus");
    expect(state.status).toBe("idle");
    expect(state.startedAt).toBeNull();
    expect(state.pausedAt).toBeNull();
    expect(state.sessionsCompleted).toBe(0);
    expect(state.config.focusMinutes).toBe(25);
    expect(state.config.breakMinutes).toBe(5);
    expect(state.config.longBreakMinutes).toBe(15);
    expect(state.config.sessionsBeforeLongBreak).toBe(4);
    expect(state.config.longBreakEnabled).toBe(false);
  });

  it("17b. createInitialState(partialConfig) merges with defaults", () => {
    const state = createInitialState({ focusMinutes: 50, longBreakEnabled: true });

    expect(state.config.focusMinutes).toBe(50);
    expect(state.config.longBreakEnabled).toBe(true);
    // defaults preserved
    expect(state.config.breakMinutes).toBe(5);
    expect(state.config.longBreakMinutes).toBe(15);
    expect(state.config.sessionsBeforeLongBreak).toBe(4);
  });

  // ── 18. Long break disabled: break + PHASE_COMPLETE at threshold → focusing ──
  it("18. break + COMPLETE with sessions=4 and longBreakEnabled=false → focusing (not long_break)", () => {
    const breakState = makeState({
      phase: "break",
      status: "running",
      startedAt: Date.now() - 5 * 60_000,
      sessionsCompleted: 4,
      config: { ...DEFAULT_CONFIG, longBreakEnabled: false, sessionsBeforeLongBreak: 4 },
    });
    const result = transition(breakState, { type: "COMPLETE" });

    expect(result.state.phase).toBe("focus");
    expect(result.state.status).toBe("running");
    expect(result.state.sessionsCompleted).toBe(4);
    expect(result.effects).toContain("notify");
  });
});
