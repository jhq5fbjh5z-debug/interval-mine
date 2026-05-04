# Proposal: Installable Version in Opera with Initial Features

## Intent

Build a Pomodoro-style focus/break cycle timer as an Opera browser extension (Chromium MV3). Users need a lightweight, installable productivity tool that manages focus sessions with automatic phase transitions, session tracking, and configurable durations — all from a popup UI without leaving their browser workflow.

## Scope

### In Scope
- **Extension scaffold**: manifest.json, icons, React+Vite+TypeScript+CRXJS Vite plugin setup
- **Cycle state machine**: 8 states — idle, focusing, break, long_break, cycle_complete + 3 paused variants
- **Timer engine**: Timestamp-based persistence using chrome.storage.local + Date.now() recovery
- **Timer UI**: React popup with phase indicator, session count, phase-aware controls, inline config (4 numeric steppers)
- **Notifications**: Phase-aware chrome.notifications with emoji and session count

### Out of Scope
- Settings/options page
- Multiple timer presets
- Custom sounds/themes
- Keyboard shortcuts
- Offscreen document for sound (deferred to v2)
- Localization
- Opera addons.store publishing workflow

## Capabilities

### New Capabilities
- `cycle-state-machine`: Focus/break/long-break cycle state management with 8 states and transitions
- `timer-engine`: Background service worker timer with timestamp-based persistence and recovery
- `timer-ui`: React popup with phase indicator, session count, controls, and inline configuration
- `extension-scaffold`: MV3 extension project structure with React+Vite+CRXJS

### Modified Capabilities
None — greenfield project.

## Approach

**State Machine**: Implement as a pure function `(currentState, event) → nextState` with chrome.storage.local as source of truth. Each state stores `{phase, startedAt, pausedAt, sessionsCompleted, config}`.

**Timer Engine**: Store `startedAt` timestamp on phase start. On popup open, compute elapsed = `Date.now() - startedAt`. Use `chrome.alarms` for background wake-ups (not for accuracy — recovery on popup open handles drift).

**UI**: React popup renders current phase from storage, shows countdown derived from timestamp, exposes phase-aware controls (start/pause/resume/skip/reset). Config steppers visible only when idle.

**Notifications**: Fire `chrome.notifications.create()` on phase transitions with phase-specific messages.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/` | New | All source code (React components, state machine, timer engine) |
| `manifest.json` | New | MV3 manifest with permissions: storage, alarms, notifications |
| `vite.config.ts` | New | Vite + CRXJS plugin configuration |
| `public/` | New | Icons and static assets |
| `package.json` | New | Project dependencies and scripts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State machine complexity (8 states × transitions) | Med | Exhaustive unit tests for all transitions; pure function design |
| Alarm missed during sleep/lock | Med | Recovery logic on popup open recomputes elapsed time from timestamp |
| Sound in service worker (blocked by browsers) | High | Defer to offscreen document in v2; popup-only sound for v1 |

## Rollback Plan

Delete the extension directory and remove from Opera. No external dependencies or data migrations — chrome.storage.local is ephemeral and isolated to the extension.

## Dependencies

- Node.js ≥ 18
- CRXJS Vite Plugin (Chrome/Opera extension build tooling)
- React 18+
- Opera browser for testing

## Success Criteria

- [ ] Extension installs in Opera and popup opens
- [ ] Full cycle works: focus → break → focus → ... → long break → cycle complete
- [ ] Timer persists across popup close/reopen (timestamp recovery)
- [ ] Config steppers adjust focus/break/long-break/session count
- [ ] Phase-aware notifications fire on transitions
- [ ] All 8 states reachable and transitions tested
