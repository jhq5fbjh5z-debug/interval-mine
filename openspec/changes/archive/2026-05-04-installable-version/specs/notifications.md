# Notifications Specification

## Purpose

Define the chrome.notifications behavior for phase transitions. Notifications alert the user when a focus or break phase completes, with phase-aware messages and emoji.

## Requirements

### Requirement: Phase-End Notification

The extension MUST fire a chrome.notification when a phase completes (focus→break, break→focus, long_break→cycle_complete).

#### Scenario: Focus phase completes

- GIVEN the current phase is `focusing` and the timer expires
- WHEN the `phase_complete` transition fires
- THEN a chrome notification is created
- AND the title contains 🎯 emoji (e.g., `🎯 Focus Complete!`)
- AND the body says `Time for a break`

#### Scenario: Break phase completes

- GIVEN the current phase is `break` and the timer expires
- WHEN the `phase_complete` transition fires
- THEN a chrome notification is created
- AND the title contains ☕ emoji (e.g., `☕ Break Complete!`)
- AND the body says `Time to focus`

#### Scenario: Long break phase completes

- GIVEN the current phase is `long_break` and the timer expires
- WHEN the `phase_complete` transition fires
- THEN a chrome notification is created
- AND the title contains 🌴 emoji (e.g., `🌴 Long Break Complete!`)
- AND the body says `Cycle complete! Start a new session`

### Requirement: Notification Click Opens Popup

Clicking the notification MUST bring focus to the extension popup.

#### Scenario: User clicks notification

- GIVEN a notification is displayed
- WHEN the user clicks the notification body
- THEN the extension popup opens (or the browser focuses the popup)

### Requirement: No Notification on Manual Skip

Manual skips (user clicks Skip) MUST NOT fire a phase-end notification.

#### Scenario: User skips focus phase

- GIVEN the current phase is `focusing`
- WHEN the user clicks `Skip`
- THEN no notification is fired
- AND the phase transitions silently

### Requirement: No Notification on Reset

Reset MUST NOT fire a phase-end notification.

#### Scenario: User resets during active phase

- GIVEN the current phase is `focusing`
- WHEN the user clicks `Reset`
- THEN no notification is fired
- AND the state returns to `idle`
