# Timer Engine Specification

## Purpose

Define the background timer persistence and recovery mechanism. The engine stores timestamps in chrome.storage.local, computes remaining time from Date.now(), and uses chrome.alarms for service worker wake-ups at phase boundaries.

## Requirements

### Requirement: Timestamp-Based Storage

The timer engine MUST persist `{ phase, startedAt, duration, pausedAt, sessionsCompleted, config }` in chrome.storage.local.

#### Scenario: Phase start writes timestamp

- GIVEN a phase transition to `focusing` occurs
- WHEN the engine persists the new state
- THEN `startedAt` is set to `Date.now()`
- AND `pausedAt` is `null`
- AND `phase` is `focusing`
- AND `duration` matches the configured `focus_duration` in milliseconds

#### Scenario: Pause stores pausedAt

- GIVEN the current phase is `focusing` with `startedAt` recorded
- WHEN the `pause` event fires
- THEN `pausedAt` is set to `Date.now()`

#### Scenario: Resume clears pausedAt and adjusts startedAt

- GIVEN the phase is `focusing_paused` with `startedAt` and `pausedAt` recorded
- WHEN the `resume` event fires
- THEN `startedAt` is adjusted: `startedAt = Date.now() - (pausedAt - startedAt)`
- AND `pausedAt` is set to `null`

### Requirement: Remaining Time Computation

The engine MUST compute remaining time as `duration - (Date.now() - startedAt)` when active, or `duration - (pausedAt - startedAt)` when paused.

#### Scenario: Compute remaining while active

- GIVEN `startedAt` was 60000ms ago and `duration` is 1500000ms (25 min)
- WHEN remaining time is computed
- THEN the result is `1440000ms` (24 minutes)

#### Scenario: Compute remaining while paused

- GIVEN `startedAt` was 120000ms ago, `pausedAt` was 60000ms ago, `duration` is 1500000ms
- WHEN remaining time is computed
- THEN the result is `1440000ms` (frozen at pause point)

#### Scenario: Remaining is zero or negative when phase is complete

- GIVEN `startedAt` was 1600000ms ago and `duration` is 1500000ms
- WHEN remaining time is computed
- THEN the result is `<= 0`
- AND the engine signals `phase_complete`

### Requirement: Chrome Alarms for Background Wake-Up

The engine MUST set a `chrome.alarms` alarm when a phase starts, with the delay equal to the phase duration.

#### Scenario: Alarm set on phase start

- GIVEN a transition to `focusing` with `focus_duration` of 25 minutes
- WHEN the engine sets the alarm
- THEN a `chrome.alarms.create()` call is made with `delayInMinutes: 25`

#### Scenario: Alarm cleared on pause

- GIVEN an alarm is active for the current phase
- WHEN the `pause` event fires
- THEN the alarm is cleared via `chrome.alarms.clear()`

#### Scenario: Alarm re-set on resume

- GIVEN the phase is resumed from pause
- WHEN remaining time is recomputed
- THEN a new alarm is set with the updated remaining delay

#### Scenario: Alarm cleared on reset

- GIVEN an alarm is active
- WHEN the `reset` event fires
- THEN the alarm is cleared

### Requirement: Recovery on Popup Open

The engine MUST recover timer state when the popup opens, handling cases where the alarm was missed (e.g., browser sleep, service worker termination).

#### Scenario: Recovery detects completed phase

- GIVEN `startedAt` was 30 minutes ago and `duration` was 25 minutes
- AND the service worker was terminated and alarm was missed
- WHEN the popup opens and recovery runs
- THEN elapsed time > duration
- AND the engine transitions via `phase_complete`

#### Scenario: Recovery resumes active timer

- GIVEN `startedAt` was 10 minutes ago and `duration` is 25 minutes
- WHEN the popup opens and recovery runs
- THEN remaining time is computed as 15 minutes
- AND a new alarm is set for the remaining duration

#### Scenario: Recovery respects paused state

- GIVEN the phase is `focusing_paused` with `pausedAt` recorded
- WHEN the popup opens and recovery runs
- THEN remaining time is frozen at the pause point
- AND no alarm is set
