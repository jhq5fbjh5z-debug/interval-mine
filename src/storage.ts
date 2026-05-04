// ============================================================
// Interval Mine — Storage Layer
// ============================================================
// Wraps chrome.storage.local for TimerState persistence.
// All reads/writes go through this module — never touch
// chrome.storage.local directly elsewhere.
// ============================================================

import type { TimerState } from "./types";

const STORAGE_KEY = "interval-mine-state";

/**
 * Persist the full TimerState to chrome.storage.local.
 *
 * @param state — Current timer state to save.
 * @throws If storage write fails (quota exceeded, serialization error).
 */
export async function saveState(state: TimerState): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to save timer state: ${message}`);
  }
}

/**
 * Read the TimerState from chrome.storage.local.
 *
 * @returns The persisted state, or null if nothing is stored.
 * @throws If storage read fails.
 */
export async function loadState(): Promise<TimerState | null> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (!raw) return null;

    // Validate shape — protect against corrupted storage
    if (typeof raw !== "object" || raw === null) {
      console.warn("Corrupted timer state in storage, clearing.");
      await clearState();
      return null;
    }

    return raw as TimerState;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load timer state: ${message}`);
  }
}

/**
 * Remove the persisted timer state from chrome.storage.local.
 */
export async function clearState(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to clear timer state: ${message}`);
  }
}
