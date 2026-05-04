# Timer UI Specification

## Purpose

Define the React popup UI for Interval Mine: phase indicator, countdown display, session count, phase-aware controls, and inline configuration. The popup is the sole user-facing interface.

## Requirements

### Requirement: Phase Indicator

The UI MUST display the current phase with an emoji and label.

#### Scenario: Focus phase indicator

- GIVEN the current phase is `focusing`
- WHEN the popup renders
- THEN it shows `🎯 Focus`

#### Scenario: Break phase indicator

- GIVEN the current phase is `break`
- WHEN the popup renders
- THEN it shows `☕ Break`

#### Scenario: Long break phase indicator

- GIVEN the current phase is `long_break`
- WHEN the popup renders
- THEN it shows `🌴 Long Break`

#### Scenario: Idle phase indicator

- GIVEN the current phase is `idle`
- WHEN the popup renders
- THEN it shows a neutral idle indicator (e.g., `⏱️ Interval Mine`)

### Requirement: Countdown Display

The UI MUST show a countdown timer in `MM:SS` format, derived from the engine's remaining time computation.

#### Scenario: Countdown updates every second

- GIVEN a phase is active and 15:30 remains
- WHEN 1 second elapses
- THEN the display updates to `15:29`

#### Scenario: Countdown shows 00:00 at phase end

- GIVEN remaining time reaches zero
- WHEN the popup renders
- THEN the display shows `00:00`

#### Scenario: No countdown when idle

- GIVEN the current phase is `idle`
- WHEN the popup renders
- THEN no countdown is displayed (or shows `--:--`)

### Requirement: Session Count

The UI MUST display the number of completed focus sessions, but ONLY when long break is enabled.

#### Scenario: Session count visible when long break enabled

- GIVEN `long_break_enabled` is `true` and `sessionsCompleted` is `2`
- WHEN the popup renders
- THEN it shows session count (e.g., `2 / 4 sessions`)

#### Scenario: Session count hidden when long break disabled

- GIVEN `long_break_enabled` is `false`
- WHEN the popup renders
- THEN the session count element is not rendered

### Requirement: Phase-Aware Controls

The UI MUST show different control buttons depending on the current state.

#### Scenario: Idle shows Start button

- GIVEN the current phase is `idle`
- WHEN the popup renders
- THEN a `Start` button is visible
- AND no Pause, Resume, Skip, or Reset buttons are visible

#### Scenario: Focusing shows Pause, Skip, Reset

- GIVEN the current phase is `focusing`
- WHEN the popup renders
- THEN `Pause`, `Skip`, and `Reset` buttons are visible
- AND no `Start` or `Resume` button is visible

#### Scenario: Focusing_paused shows Resume, Skip, Reset

- GIVEN the current phase is `focusing_paused`
- WHEN the popup renders
- THEN `Resume`, `Skip`, and `Reset` buttons are visible

#### Scenario: Break shows Skip and Reset

- GIVEN the current phase is `break`
- WHEN the popup renders
- THEN `Skip` and `Reset` buttons are visible

#### Scenario: Cycle_complete shows Start (new cycle)

- GIVEN the current phase is `cycle_complete`
- WHEN the popup renders
- THEN a `Start` button is visible (begins new cycle)

### Requirement: Inline Configuration

The UI MUST display 3 steppers (focus duration, break duration, long break duration) and 1 toggle (long break enabled) inline in the popup.

#### Scenario: Config visible when idle

- GIVEN the current phase is `idle`
- WHEN the popup renders
- THEN config steppers and toggle are visible and editable

#### Scenario: Config hidden when active

- GIVEN the current phase is any non-idle state
- WHEN the popup renders
- THEN config steppers and toggle are not rendered (or are disabled/hidden)

#### Scenario: Focus duration stepper

- GIVEN the config is visible
- WHEN the user increments the focus duration stepper
- THEN `focus_duration` increases by 1 minute
- AND the display updates to show the new value

#### Scenario: Break duration stepper

- GIVEN the config is visible
- WHEN the user decrements the break duration stepper
- THEN `break_duration` decreases by 1 minute (minimum: 1)

#### Scenario: Long break toggle enables long break fields

- GIVEN the config is visible and `long_break_enabled` is `false`
- WHEN the user toggles long break on
- THEN the long break duration stepper becomes visible
- AND the sessions_before_long_break field becomes visible

#### Scenario: Long break toggle disables long break fields

- GIVEN `long_break_enabled` is `true`
- WHEN the user toggles long break off
- THEN the long break duration stepper is hidden
- AND the sessions_before_long_break field is hidden

#### Scenario: Stepper minimum values

- GIVEN any stepper is at its minimum value
- WHEN the user tries to decrement further
- THEN the value does not decrease below 1 minute
