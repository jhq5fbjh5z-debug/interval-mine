# Design: Installable Version in Opera with Initial Features

## Technical Approach

Greenfield Opera MV3 extension built with React 18 + Vite + TypeScript + CRXJS Vite plugin. Core architecture centers on a **pure-function state machine** that owns all phase transitions, persisted to `chrome.storage.local` with timestamp-based timer recovery. The popup is the primary UI surface; the background service worker exists only for `chrome.alarms` wake-ups and notification dispatch.

## Architecture Decisions

| # | Decision | Choice | Alternatives Considered | Rationale |
|---|----------|--------|------------------------|-----------|
| 1 | **Framework** | React 18 + Vite + CRXJS | Vanilla JS; WXT framework | CRXJS is purpose-built for MV3 Chrome/Opera extensions with Vite. WXT adds abstraction we don't need. Vanilla JS loses React's component model for the popup. |
| 2 | **Extension type** | Opera MV3 (Chromium) | MV2; Firefox MV3 | Opera is Chromium-based — identical to Chrome MV3. MV2 is deprecated. |
| 3 | **State machine** | Pure function `(state, event) → state` | Redux/Zustand; class-based FSM | Zero dependencies. Exhaustively testable. No side effects — storage write is a separate step. |
| 4 | **Timer precision** | `Date.now()` timestamps | `setInterval` countdown; `chrome.alarms` only | Timestamps survive service worker termination (30s idle). Alarms have 1-min minimum granularity — timestamps recover exact elapsed time on popup open. |
| 5 | **Persistence** | `chrome.storage.local` | `localStorage`; IndexedDB | Available in both popup and service worker. Survives extension updates. Async API matches MV3 patterns. |
| 6 | **Background** | Service worker + `chrome.alarms` | Persistent background page; Web Workers | MV3 requires service workers. Alarms wake the worker for notifications. Worker terminates after 30s — timer state lives in storage, not memory. |
| 7 | **Sound** | Popup-only (`<audio>` element) | Offscreen document; Web Audio API in SW | Service workers have no audio context. Offscreen document adds complexity for v1. Defer to v2. |
| 8 | **Config UI** | Inline in popup (3 steppers + 1 toggle) | Options page; modal | Zero navigation friction. Config visible only when idle. Locked during active cycle to prevent mid-session changes. |
| 9 | **Long break** | Optional, disabled by default | Always-on; removed | Not all users want long breaks. Toggle in config. Default: 4 sessions → long break when enabled. |

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  POPUP (React)                                          │
│  ┌──────────┐   read    ┌──────────────────┐            │
│  │ TimerUI  │──────────→│ chrome.storage   │            │
│  │ Controls │           │ .local           │            │
│  │ Config   │───write──→│                  │            │
│  └──────────┘           └───────┬──────────┘            │
│       │                         │                       │
│       │ onPhaseComplete         │ alarm fired           │
│       ▼                         ▼                       │
│  ┌──────────┐           ┌──────────────────┐            │
│  │ notify() │           │ SERVICE WORKER   │            │
│  └──────────┘           │ - onAlarm handler│            │
│                         │ - reads storage  │            │
│                         │ - writes next    │            │
│                         │   state          │            │
│                         │ - fires notify   │            │
│                         └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

**Popup open flow**: Read storage → compute `elapsed = Date.now() - startedAt` → if elapsed ≥ phaseDuration → transition via state machine → write new state → show notification.

**Alarm flow**: Service worker wakes → reads storage → if phase expired → transition → write → notify. Popup picks up on next open.

## State Machine

8 states. Pure function `next(state, event)`:

| Current State | Event | Next State | Side Effect |
|---------------|-------|------------|-------------|
| `idle` | `START` | `focusing` | Write `startedAt` to storage, set alarm |
| `focusing` | `COMPLETE` | `break` | Notify, write `startedAt`, set alarm |
| `focusing` | `PAUSE` | `focusing_paused` | Write `pausedAt` |
| `focusing_paused` | `RESUME` | `focusing` | Adjust `startedAt` by pause duration |
| `focusing_paused` | `SKIP` | `break` | Notify |
| `break` | `COMPLETE` | `focusing` (or `long_break`) | Notify, increment `sessionsCompleted` |
| `break` | `PAUSE` | `break_paused` | Write `pausedAt` |
| `break_paused` | `RESUME` | `break` | Adjust `startedAt` |
| `break_paused` | `SKIP` | `focusing` (or `long_break`) | Notify |
| `long_break` | `COMPLETE` | `cycle_complete` | Notify |
| `long_break` | `PAUSE` | `long_break_paused` | Write `pausedAt` |
| `long_break_paused` | `RESUME` | `long_break` | Adjust `startedAt` |
| `long_break_paused` | `SKIP` | `cycle_complete` | Notify |
| `cycle_complete` | `RESET` | `idle` | Clear storage |
| Any | `RESET` | `idle` | Clear storage, cancel alarms |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Create | Dependencies: react, react-dom, vite, @crxjs/vite-plugin, typescript, vitest |
| `vite.config.ts` | Create | Vite config with CRXJS plugin |
| `tsconfig.json` | Create | TypeScript strict config |
| `manifest.json` | Create | MV3 manifest — permissions: storage, alarms, notifications |
| `src/background.ts` | Create | Service worker: alarm handler, notification dispatch |
| `src/state-machine.ts` | Create | Pure function: `nextState(current, event) → {state, effects[]}` |
| `src/storage.ts` | Create | Read/write wrapper for chrome.storage.local |
| `src/types.ts` | Create | Phase, TimerState, Config, Event types |
| `src/popup/App.tsx` | Create | Root component — reads state, routes to views |
| `src/popup/TimerView.tsx` | Create | Countdown display + phase indicator + controls |
| `src/popup/ConfigView.tsx` | Create | 3 steppers (focus/break/long-break) + long-break toggle |
| `src/popup/components/Stepper.tsx` | Create | Reusable +/- numeric input |
| `src/popup/hooks/useTimerState.ts` | Create | Hook: reads storage, computes elapsed, returns current phase |
| `src/popup/styles.css` | Create | Popup styles (phase-aware colors) |
| `public/icons/` | Create | 16, 48, 128px extension icons |
| `src/__tests__/state-machine.test.ts` | Create | Exhaustive tests for all 8 states × transitions |

## Interfaces / Contracts

```typescript
type Phase = 'focus' | 'break' | 'long_break';
type Status = 'idle' | 'running' | 'paused' | 'complete';

interface TimerState {
  phase: Phase;
  status: Status;
  startedAt: number | null;    // Date.now() when phase started
  pausedAt: number | null;     // Date.now() when paused
  sessionsCompleted: number;
  config: Config;
}

interface Config {
  focusMinutes: number;        // default 25
  breakMinutes: number;        // default 5
  longBreakMinutes: number;    // default 15
  sessionsBeforeLongBreak: number; // default 4
  longBreakEnabled: boolean;   // default false
}

type TimerEvent =
  | { type: 'START' }
  | { type: 'COMPLETE' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SKIP' }
  | { type: 'RESET' };

// Pure function — no side effects
function nextState(state: TimerState, event: TimerEvent): {
  state: TimerState;
  effects: Effect[];  // 'notify' | 'setAlarm' | 'clearAlarm'
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | State machine: all 8 states × all valid/invalid events | Vitest. Table-driven. Each transition asserts new state + effects. |
| Unit | Storage read/write | Mock `chrome.storage.local`. Verify serialization. |
| Unit | Timer recovery (elapsed ≥ duration) | Mock `Date.now()`. Verify auto-transition on popup open. |
| Integration | Popup renders correct state from storage | React Testing Library. Mock storage, assert UI output. |
| E2E | Full cycle in Opera | Manual: install unpacked, run focus→break→long break→complete. |

## Migration / Rollout

No migration. Greenfield project. Extension installed unpacked from local build during development.

## Open Questions

- [ ] CRXJS Vite plugin compatibility with latest Opera Chromium version — verify at scaffold time
- [ ] Icon design — placeholder icons initially, replace before publish
