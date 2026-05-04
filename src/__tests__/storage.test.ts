// ============================================================
// Storage Layer — Unit Tests
// ============================================================
// Mocks chrome.storage.local to test saveState/loadState/clearState
// without a real browser environment.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveState, loadState, clearState } from "../storage";
import type { TimerState, Config } from "../types";

// ── Mock chrome.storage.local ─────────────────────────────────

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

// Attach to globalThis for chrome.storage.local access
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

// ── Tests ─────────────────────────────────────────────────────

describe("Storage Layer", () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe("saveState", () => {
    it("writes state to chrome.storage.local with correct key", async () => {
      const state = makeState({ status: "running", startedAt: Date.now() });
      await saveState(state);

      expect(mockStorage.set).toHaveBeenCalledWith({
        "interval-mine-state": state,
      });
    });

    it("persists idle state", async () => {
      const state = makeState();
      await saveState(state);
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    it("persists paused state with pausedAt", async () => {
      const state = makeState({
        status: "paused",
        startedAt: Date.now() - 60_000,
        pausedAt: Date.now(),
      });
      await saveState(state);
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
    });

    it("throws on storage error", async () => {
      mockStorage.set.mockRejectedValueOnce(new Error("QUOTA_EXCEEDED"));

      await expect(saveState(makeState())).rejects.toThrow(
        "Failed to save timer state: QUOTA_EXCEEDED",
      );
    });
  });

  describe("loadState", () => {
    it("returns null when no state exists", async () => {
      const result = await loadState();
      expect(result).toBeNull();
    });

    it("returns stored state", async () => {
      const state = makeState({ status: "running", startedAt: Date.now() });
      store.set("interval-mine-state", state);

      const result = await loadState();
      expect(result).toEqual(state);
    });

    it("returns paused state with all fields intact", async () => {
      const state = makeState({
        phase: "break",
        status: "paused",
        startedAt: 1000,
        pausedAt: 5000,
        sessionsCompleted: 2,
      });
      store.set("interval-mine-state", state);

      const result = await loadState();
      expect(result).toEqual(state);
    });

    it("clears and returns null for corrupted non-object data", async () => {
      store.set("interval-mine-state", "not-an-object");

      const result = await loadState();
      expect(result).toBeNull();
      // Should have cleared the corrupted entry
      expect(mockStorage.remove).toHaveBeenCalledWith("interval-mine-state");
    });

    it("clears and returns null for corrupted null data", async () => {
      store.set("interval-mine-state", null);

      const result = await loadState();
      expect(result).toBeNull();
    });

    it("throws on storage read error", async () => {
      mockStorage.get.mockRejectedValueOnce(new Error("STORAGE_ERROR"));

      await expect(loadState()).rejects.toThrow(
        "Failed to load timer state: STORAGE_ERROR",
      );
    });
  });

  describe("clearState", () => {
    it("removes state from storage", async () => {
      store.set("interval-mine-state", makeState());

      await clearState();
      expect(mockStorage.remove).toHaveBeenCalledWith("interval-mine-state");
    });

    it("is idempotent — no error when nothing to clear", async () => {
      await clearState();
      expect(mockStorage.remove).toHaveBeenCalledWith("interval-mine-state");
    });

    it("throws on storage error", async () => {
      mockStorage.remove.mockRejectedValueOnce(new Error("CLEAR_ERROR"));

      await expect(clearState()).rejects.toThrow(
        "Failed to clear timer state: CLEAR_ERROR",
      );
    });
  });
});
