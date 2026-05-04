# Tasks: Installable Version in Opera with Initial Features

## Phase 1: Scaffold & Types (4 tasks)

- [x] 1.1 Create `package.json` — deps: react 18, react-dom, vite, @crxjs/vite-plugin, typescript, vitest, @types/chrome. Scripts: dev, build, test.
- [x] 1.2 Create `vite.config.ts` — Vite + CRXJS plugin, React plugin, service worker + popup entry points.
- [x] 1.3 Create `tsconfig.json` — strict mode, JSX react-jsx, ESNext target, moduleResolution bundler.
- [x] 1.4 Create `src/types.ts` — Phase, Status, TimerState, Config, TimerEvent, Effect types per design interfaces. Create `manifest.json` — MV3, permissions: alarms/notifications/storage, popup action, icon refs. Create `public/icons/` — placeholder PNGs at 16/32/48/128px. Verify: `npm install && npm run build` produces dist/ with no errors.

## Phase 2: State Machine — TDD (3 tasks)

- [x] 2.1 Create `src/__tests__/state-machine.test.ts` — RED: 23 exhaustive tests for all 8 states × valid transitions. Tests failed initially (module not found). All spec scenarios covered including config change, skip variants, partial config merge.
- [x] 2.2 Create `src/state-machine.ts` — GREEN: implemented `transition(state, event)` pure function + `createInitialState(config?)`. 8 states, 7 events, effects array return. All 23 tests pass.
- [x] 2.3 REFACTOR: Removed unused Effect import, verified JSDoc two-axis model documentation, confirmed zero `any` types, tsc --noEmit clean. Tests still green.

## Phase 3: Timer Engine (4 tasks)

- [x] 3.1 Create `src/__tests__/storage.test.ts` — tests for read/write wrapper over chrome.storage.local (mock chrome API). Serialize/deserialize TimerState.
- [x] 3.2 Create `src/storage.ts` — `loadState()` and `saveState(state)` async functions wrapping chrome.storage.local.
- [x] 3.3 Create `src/__tests__/timer-engine.test.ts` — tests for remaining time computation (active/paused/expired), alarm set/clear, recovery on popup open. Mock Date.now and chrome.alarms.
- [x] 3.4 Create `src/background.ts` — service worker: `chrome.alarms.onAlarm` handler, reads storage → runs `nextState` → saves → fires notification if effect present. Create `src/popup/hooks/useTimerState.ts` — hook: loads storage, computes remaining via Date.now(), auto-transitions on expired phase, re-sets alarm on resume, polls every 1s for countdown.

## Phase 4: UI Components (3 tasks)

- [x] 4.1 Create `src/popup/components/Stepper.tsx` — reusable +/- numeric input, min/max bounds, direct input field, controlled component with value/onChange props, ARIA labels, keyboard accessible.
- [x] 4.2 Create `src/popup/TimerView.tsx` — phase indicator (emoji+label from getPhaseLabel/getPhaseEmoji), MM:SS countdown from useTimerState hook, phase-aware controls (Start/Pause/Resume/Skip/Reset per state), session count when longBreakEnabled.
- [x] 4.3 Create `src/popup/ConfigView.tsx` — 3 steppers (focus 5-120, break 1-60, long break 5-60) + 1 toggle (longBreakEnabled). Visible only when idle. Long break fields conditional on toggle. Create `src/popup/styles.css` — phase-aware accent colors (warm amber for focus, cool blue for break, calm green for long break), 320px popup, clean design with rounded corners and shadows. Wire `src/popup/App.tsx` — reads state via useTimerState, shows ConfigView when idle, TimerView always visible, sends CONFIG_CHANGE events. Add message handler to `src/background.ts` for popup→background event dispatch.

## Phase 5: Notifications & Polish (2 tasks)

- [x] 5.1 Verified and fixed notification logic in `src/background.ts` — phase-aware messages match spec (🎯 Focus Complete!, ☕ Break Complete!, 🌴 Long Break Complete!). Fixed SKIP to not trigger notifications (spec violation). Fixed notification click handler with fallback for MV3. Updated 5 state machine tests.
- [x] 5.2 Build verified: `npm run build` clean, `tsc --noEmit` clean, 77/77 tests pass. dist/ contains correct manifest, icons, popup, service worker. Manual E2E verification instructions documented (requires Opera/Chrome browser).
