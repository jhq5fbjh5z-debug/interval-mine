// ============================================================
// Interval Mine — MV3 Service Worker
// ============================================================
// Handles chrome.alarms wake-ups for phase transitions and
// notification dispatch.
//
// CRITICAL: Service worker may terminate at any time.
// Always read fresh state from storage — never cache in memory.
// ============================================================

import type { TimerState, Effect, TimerEvent } from "./types";
import { createInitialState } from "./types";
import { transition } from "./state-machine";
import { loadState, saveState } from "./storage";
import { getAlarmDelayMinutes } from "./timer";

const ALARM_NAME = "interval-mine-phase";

// ── Extension Install ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await loadState();
  if (!existing) {
    await saveState(createInitialState());
  }
});

// ── Alarm Handler ─────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  const state = await loadState();
  if (!state || state.status !== "running") return;

  // Check if the phase is actually expired.
  // The alarm might fire slightly early (chrome rounds to minutes).
  // If not expired, re-set alarm for the remaining time.
  if (!isPhaseExpired(state)) {
    const delayMinutes = getAlarmDelayMinutes(state);
    if (delayMinutes > 0) {
      chrome.alarms.create(ALARM_NAME, { delayInMinutes: delayMinutes });
    }
    return;
  }

  // Phase expired — transition via state machine
  const result = transition(state, { type: "COMPLETE" });
  await saveState(result.state);

  // Execute side effects
  for (const effect of result.effects) {
    await executeEffect(effect, result.state);
  }
});

// ── Effect Executor ───────────────────────────────────────────

async function executeEffect(effect: Effect, state: TimerState): Promise<void> {
  switch (effect) {
    case "setAlarm": {
      const delayMinutes = getAlarmDelayMinutes(state);
      if (delayMinutes > 0) {
        chrome.alarms.create(ALARM_NAME, { delayInMinutes: delayMinutes });
      }
      break;
    }

    case "clearAlarm": {
      await chrome.alarms.clear(ALARM_NAME);
      break;
    }

    case "notify": {
      const info = getNotificationInfo(state);
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: info.title,
        message: info.body,
        priority: 2,
      });
      break;
    }
  }
}

/**
 * Generate phase-aware notification content.
 *
 * The state has ALREADY transitioned — we describe what COMPLETED.
 * Mapping:
 *   new phase = "break"    → focus completed
 *   new phase = "focus"    → break completed
 *   new phase = "long_break" → break completed (long break starting)
 *   status = "complete"    → long break completed
 */
function getNotificationInfo(state: TimerState): { title: string; body: string } {
  // Long break completed → cycle complete
  if (state.status === "complete") {
    return {
      title: "🌴 Long Break Complete!",
      body: "Great work! Cycle complete — ready for a new one?",
    };
  }

  // Focus completed → break starting
  if (state.phase === "break") {
    return {
      title: "🎯 Focus Complete!",
      body: "Time for a break.",
    };
  }

  // Break completed → focus or long break starting
  if (state.phase === "focus") {
    return {
      title: "☕ Break Complete!",
      body: "Time to focus.",
    };
  }

  // Break completed → long break starting
  if (state.phase === "long_break") {
    return {
      title: "☕ Break Complete!",
      body: "Time for a long break.",
    };
  }

  return { title: "Timer Updated", body: "Phase changed." };
}

// ── Message Handler (popup → background events) ─────────────

chrome.runtime.onMessage.addListener(
  async (message: { type: string; event?: TimerEvent }) => {
    if (message.type !== "TIMER_EVENT" || !message.event) return;

    const state = await loadState();
    if (!state) return;

    const result = transition(state, message.event);
    await saveState(result.state);

    for (const effect of result.effects) {
      await executeEffect(effect, result.state);
    }
  },
);

// ── Notification Click → Open Popup ───────────────────────────

chrome.notifications.onClicked.addListener(async (notificationId) => {
  chrome.notifications.clear(notificationId);

  // chrome.action.openPopup() is unreliable in MV3 service workers.
  // Try it first, fall back to opening a tab with the popup URL.
  try {
    await chrome.action.openPopup();
  } catch {
    // Fallback: open popup as a tab (works in all Chromium browsers)
    const popupUrl = chrome.runtime.getURL("src/popup.html");
    chrome.tabs.create({ url: popupUrl });
  }
});

// ── Helpers ───────────────────────────────────────────────────

/**
 * Check if the current phase has expired.
 * Reads startedAt from storage state (not cached).
 */
function isPhaseExpired(state: TimerState): boolean {
  if (!state.startedAt || state.status !== "running") return false;

  const durationMs = getPhaseDurationMs(state.phase, state.config);
  return Date.now() - state.startedAt >= durationMs;
}

/**
 * Get phase duration in milliseconds.
 * Duplicated from timer.ts to avoid circular imports in service worker.
 */
function getPhaseDurationMs(phase: string, config: TimerState["config"]): number {
  switch (phase) {
    case "focus":
      return config.focusMinutes * 60_000;
    case "break":
      return config.breakMinutes * 60_000;
    case "long_break":
      return config.longBreakMinutes * 60_000;
    default:
      return config.focusMinutes * 60_000;
  }
}

export {};
