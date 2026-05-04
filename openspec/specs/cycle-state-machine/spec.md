# Cycle State Machine Specification

## Purpose

Define a pure-function state machine that governs the focus/break/long-break cycle for Interval Mine. The machine has 8 states (4 active + 4 paused) and deterministic transitions driven by events.

## Requirements

### Requirement: State Definitions

The state machine MUST define exactly 8 states: `idle`, `focusing`, `break`, `long_break`, `cycle_complete`, `focusing_paused`, `break_paused`, `long_break_paused`.

#### Scenario: Initial state is idle

- GIVEN the extension is freshly installed or reset
- WHEN the state machine is initialized
- THEN the current state is `idle`

#### Scenario: All 8 states are reachable

- GIVEN valid transition sequences
- WHEN each event is applied from its valid source state
- THEN every one of the 8 states is reachable from `idle`

### Requirement: Core Transitions

The state machine MUST support 6 transitions: `start`, `pause`, `resume`, `skip`, `reset`, `phase_complete`.

#### Scenario: Start from idle begins focusing

- GIVEN the current state is `idle`
- WHEN the `start` event fires
- THEN the state transitions to `focusing`

#### Scenario: Pause during focusing

- GIVEN the current state is `focusing`
- WHEN the `pause` event fires
- THEN the state transitions to `focusing_paused`

#### Scenario: Resume from focusing_paused

- GIVEN the current state is `focusing_paused`
- WHEN the `resume` event fires
- THEN the state transitions to `focusing`

#### Scenario: Skip during focusing goes to break

- GIVEN the current state is `focusing`
- WHEN the `skip` event fires
- THEN the state transitions to `break`

#### Scenario: Reset from any active state returns to idle

- GIVEN the current state is any non-idle state
- WHEN the `reset` event fires
- THEN the state transitions to `idle`

#### Scenario: Phase complete during focusing transitions to break

- GIVEN the current state is `focusing`
- WHEN the `phase_complete` event fires
- AND long break is NOT enabled
- THEN the state transitions to `break`

#### Scenario: Phase complete during focusing with long break enabled

- GIVEN the current state is `focusing`
- AND long break is enabled
- AND sessions completed < sessions_before_long_break
- WHEN the `phase_complete` event fires
- THEN the state transitions to `break`

#### Scenario: Phase complete triggers long break after threshold

- GIVEN the current state is `focusing`
- AND long break is enabled
- AND sessions completed = sessions_before_long_break
- WHEN the `phase_complete` event fires
- THEN the state transitions to `long_break`

#### Scenario: Phase complete during break returns to focusing

- GIVEN the current state is `break`
- WHEN the `phase_complete` event fires
- THEN the state transitions to `focusing`

#### Scenario: Phase complete during long break triggers cycle_complete

- GIVEN the current state is `long_break`
- WHEN the `phase_complete` event fires
- THEN the state transitions to `cycle_complete`

#### Scenario: Start from cycle_complete resets to focusing

- GIVEN the current state is `cycle_complete`
- WHEN the `start` event fires
- THEN the state transitions to `focusing`

### Requirement: Config Schema

The state machine config MUST include: `focus_duration`, `break_duration`, `long_break_enabled` (default `false`), `long_break_duration`, `sessions_before_long_break`.

#### Scenario: Default config has long break disabled

- GIVEN no user-configured values
- WHEN the config is initialized
- THEN `long_break_enabled` is `false`
- AND `focus_duration` is `25` (minutes)
- AND `break_duration` is `5` (minutes)

#### Scenario: Long break config values

- GIVEN long break is enabled
- WHEN the config is initialized with defaults
- THEN `long_break_duration` is `15` (minutes)
- AND `sessions_before_long_break` is `4`

### Requirement: Session Tracking

The state machine MUST track `sessionsCompleted`, which increments each time a focusing phase completes.

#### Scenario: Session count increments on focus completion

- GIVEN `sessionsCompleted` is `2`
- WHEN the `phase_complete` event fires from `focusing` state
- THEN `sessionsCompleted` becomes `3`

#### Scenario: Session count resets on machine reset

- GIVEN `sessionsCompleted` is `3`
- WHEN the `reset` event fires
- THEN `sessionsCompleted` becomes `0`

#### Scenario: Session count resets after long break completes

- GIVEN `sessionsCompleted` equals `sessions_before_long_break`
- WHEN `phase_complete` fires from `long_break`
- THEN `sessionsCompleted` resets to `0`
