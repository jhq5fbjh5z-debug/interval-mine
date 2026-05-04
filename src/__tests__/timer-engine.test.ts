// ============================================================
// Timer Engine — Unit Tests
// ============================================================
// Tests for remaining time computation (active/paused/expired),
// time formatting, phase labels, and recovery logic.
// Mocks Date.now and chrome.storage.local.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRemainingMs,
  isExpired,
  formatTime,
  getPhaseLabel,
  getPhaseEmoji,
  getPhaseDurationMs,
  getAlarmDelayMinutes,
  recoverTimerState,
} from "../timer";
import type { TimerState, Config, Phase } from "../types";

// ── Mocks ─────────────────────────────────────────────────────

const store = new Map<string, unknown>();

const mockStorage = {
  get: vi.fn(async (key: string) => {
    const value = store.get(key);
    return value !== undefined ? { [key]: value } : {};
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) {
      store.set(key, value);
    }
  }),
  remove: vi.fn(async (key: string) => {
    store.delete(key);
  }),
};

vi.stubGlobal("chrome", {
  storage: { local: mockStorage },
});

// ── Test Helpers ──────────────────────────────────────────────

const DEFAULT_CONFIG: Config = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  longBreakEnabled: false,
};

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

const FOCUS_MS = 25 * 60_000;
const BREAK_MS = 5 * 60_000;
const LONG_BREAK_MS = 15 * 60_000;

// ── Tests ─────────────────────────────────────────────────────

describe("Timer Engine", () => {
  describe("getPhaseDurationMs", () => {
    it("returns focus duration from config", () => {
      expect(getPhaseDurationMs("focus", DEFAULT_CONFIG)).toBe(FOCUS_MS);
    });
    it("returns break duration from config", () => {
      expect(getPhaseDurationMs("break", DEFAULT_CONFIG)).toBe(BREAK_MS);
    });
    it("returns long break duration from config", () => {
      expect(getPhaseDurationMs("long_break", DEFAULT_CONFIG)).toBe(LONG_BREAK_MS);
    });
    it("respects custom config values", () => {
      const config = { ...DEFAULT_CONFIG, focusMinutes: 50 };
      expect(getPhaseDurationMs("focus", config)).toBe(50 * 60_000);
    });
  });

  describe("getRemainingMs", () => {
    it("returns 0 for idle state", () => {
      const state = makeState({ status: "idle", startedAt: null });
      expect(getRemainingMs(state)).toBe(0);
    });

    it("returns 0 for complete state", () => {
      const state = makeState({ status: "complete", startedAt: null });
      expect(getRemainingMs(state)).toBe(0);
    });

    it("computes remaining for running focus", () => {
      const now = Date.now();
      const startedAt = now - 60_000; // 1 minute ago
      const state = makeState({ status: "running", startedAt });

      const remaining = getRemainingMs(state);
      expect(remaining).toBe(FOCUS_MS - 60_000);
    });

    it("computes remaining for running break", () => {
      const now = 1_000_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(now);
      const startedAt = now - 120_000; // 2 min ago
      const state = makeState({
        phase: "break",
        status: "running",
        startedAt,
        sessionsCompleted: 1,
      });

      expect(getRemainingMs(state)).toBe(BREAK_MS - 120_000);
      vi.restoreAllMocks();
    });

    it("returns frozen remaining for paused state", () => {
      const now = Date.now();
      const startedAt = now - 120_000; // 2 min ago
      const pausedAt = now - 60_000; // paused 1 min ago (1 min active)
      const state = makeState({
        status: "paused",
        startedAt,
        pausedAt,
      });

      // Duration 25min - 1min active = 24min remaining (frozen)
      expect(getRemainingMs(state)).toBe(FOCUS_MS - 60_000);
    });

    it("returns negative when phase expired (running)", () => {
      const now = Date.now();
      const startedAt = now - FOCUS_MS - 60_000; // 26 min ago
      const state = makeState({ status: "running", startedAt });

      expect(getRemainingMs(state)).toBeLessThan(0);
    });
  });

  describe("isExpired", () => {
    it("returns false for idle state", () => {
      expect(isExpired(makeState({ status: "idle" }))).toBe(false);
    });

    it("returns false for paused state", () => {
      const state = makeState({
        status: "paused",
        startedAt: Date.now() - FOCUS_MS * 2,
        pausedAt: Date.now(),
      });
      expect(isExpired(state)).toBe(false);
    });

    it("returns false when time remaining", () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - 60_000,
      });
      expect(isExpired(state)).toBe(false);
    });

    it("returns true when time expired", () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS - 1000,
      });
      expect(isExpired(state)).toBe(true);
    });

    it("returns true exactly at boundary", () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS,
      });
      // At exactly the boundary, remaining = 0 → expired
      expect(isExpired(state)).toBe(true);
    });
  });

  describe("formatTime", () => {
    it("formats zero as 00:00", () => {
      expect(formatTime(0)).toBe("00:00");
    });

    it("formats negative as 00:00", () => {
      expect(formatTime(-5000)).toBe("00:00");
    });

    it("formats 25 minutes in ms", () => {
      expect(formatTime(25 * 60_000)).toBe("25:00");
    });

    it("formats 1 minute 30 seconds", () => {
      expect(formatTime(90_000)).toBe("01:30");
    });

    it("formats 59 seconds", () => {
      expect(formatTime(59_000)).toBe("00:59");
    });

    it("floors to whole seconds", () => {
      expect(formatTime(90_999)).toBe("01:30");
    });

    it("formats 10 minutes", () => {
      expect(formatTime(600_000)).toBe("10:00");
    });
  });

  describe("getPhaseLabel", () => {
    it("returns Focus for focus", () => {
      expect(getPhaseLabel("focus")).toBe("Focus");
    });
    it("returns Break for break", () => {
      expect(getPhaseLabel("break")).toBe("Break");
    });
    it("returns Long Break for long_break", () => {
      expect(getPhaseLabel("long_break")).toBe("Long Break");
    });
  });

  describe("getPhaseEmoji", () => {
    it("returns 🎯 for focus", () => {
      expect(getPhaseEmoji("focus")).toBe("🎯");
    });
    it("returns ☕ for break", () => {
      expect(getPhaseEmoji("break")).toBe("☕");
    });
    it("returns 🌴 for long_break", () => {
      expect(getPhaseEmoji("long_break")).toBe("🌴");
    });
  });

  describe("getAlarmDelayMinutes", () => {
    it("returns 0 when startedAt is null", () => {
      const state = makeState({ startedAt: null });
      expect(getAlarmDelayMinutes(state)).toBe(0);
    });

    it("returns remaining minutes rounded up", () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - 60_000, // 1 min ago → 24 min remaining
      });
      expect(getAlarmDelayMinutes(state)).toBe(24);
    });

    it("returns minimum 1 minute", () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS + 30_000, // 30s remaining
      });
      expect(getAlarmDelayMinutes(state)).toBe(1);
    });

    it("returns 1 when expired (edge case)", () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS - 60_000,
      });
      // remaining is negative → max(1, ceil(negative)) = 1
      expect(getAlarmDelayMinutes(state)).toBe(1);
    });
  });

  describe("recoverTimerState", () => {
    beforeEach(() => {
      store.clear();
      vi.clearAllMocks();
    });

    it("returns null when no state in storage", async () => {
      const result = await recoverTimerState();
      expect(result).toBeNull();
    });

    it("returns idle state unchanged", async () => {
      const state = makeState({ status: "idle" });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      expect(result).toEqual(state);
    });

    it("returns paused state unchanged (no recovery needed)", async () => {
      const state = makeState({
        status: "paused",
        startedAt: Date.now() - 60_000,
        pausedAt: Date.now() - 30_000,
      });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      expect(result?.status).toBe("paused");
    });

    it("returns running state with time remaining unchanged", async () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - 60_000, // 1 min ago, 24 min remaining
      });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      expect(result?.status).toBe("running");
      expect(result?.phase).toBe("focus");
    });

    it("auto-transitions expired focus → break", async () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS - 60_000, // expired 1 min ago
        sessionsCompleted: 0,
      });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      expect(result?.phase).toBe("break");
      expect(result?.status).toBe("running");
      expect(result?.sessionsCompleted).toBe(1);
    });

    it("auto-transitions expired break → focus", async () => {
      const state = makeState({
        phase: "break",
        status: "running",
        startedAt: Date.now() - BREAK_MS - 60_000,
        sessionsCompleted: 1,
      });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      expect(result?.phase).toBe("focus");
      expect(result?.status).toBe("running");
    });

    it("auto-transitions expired break → long_break when enabled", async () => {
      const state = makeState({
        phase: "break",
        status: "running",
        startedAt: Date.now() - BREAK_MS - 60_000,
        sessionsCompleted: 4,
        config: { ...DEFAULT_CONFIG, longBreakEnabled: true },
      });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      expect(result?.phase).toBe("long_break");
      expect(result?.status).toBe("running");
    });

    it("transitions expired focus → break (single transition, break is fresh)", async () => {
      // Focus expired long ago → single transition: focus→break (new startedAt = now)
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS - BREAK_MS - FOCUS_MS, // way past expiry
        sessionsCompleted: 0,
      });
      store.set("interval-mine-state", state);

      const result = await recoverTimerState();
      // After focus complete → break (sessions=1, fresh startedAt = now)
      expect(result?.phase).toBe("break");
      expect(result?.status).toBe("running");
      expect(result?.sessionsCompleted).toBe(1);
    });

    it("persists recovered state to storage", async () => {
      const state = makeState({
        status: "running",
        startedAt: Date.now() - FOCUS_MS - 60_000,
      });
      store.set("interval-mine-state", state);

      await recoverTimerState();

      // Verify storage was written
      expect(mockStorage.set).toHaveBeenCalled();
    });
  });
});
