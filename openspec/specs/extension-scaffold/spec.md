# Extension Scaffold Specification

## Purpose

Define the MV3 browser extension project structure, build tooling, and manifest configuration for "Interval Mine" — a Pomodoro-style focus/break cycle timer for Opera.

## Requirements

### Requirement: MV3 Manifest

The extension MUST declare a valid Manifest V3 manifest with the minimum permissions required for timer functionality.

#### Scenario: Manifest declares required permissions

- GIVEN the extension is loaded in Opera
- WHEN the manifest.json is parsed
- THEN it declares `permissions: ["alarms", "notifications", "storage"]`
- AND `manifest_version` is `3`

#### Scenario: Manifest declares popup action

- GIVEN the manifest is valid
- WHEN the user clicks the extension icon
- THEN the browser opens `popup.html` as the default action

### Requirement: React + Vite + TypeScript Stack

The extension MUST use React 18+, Vite as the build tool, and TypeScript for type safety.

#### Scenario: Project builds without errors

- GIVEN the project dependencies are installed (`npm install`)
- WHEN the developer runs the build command
- THEN Vite produces a dist/ folder with bundled popup.html, popup JS, service worker, and manifest

#### Scenario: TypeScript strict mode

- GIVEN tsconfig.json is present
- WHEN the project is built
- THEN all TypeScript files compile with `strict: true` enabled

### Requirement: CRXJS Vite Plugin

The build MUST use the CRXJS Vite plugin to handle MV3-specific bundling (service worker, popup, manifest generation).

#### Scenario: CRXJS handles service worker entry

- GIVEN CRXJS is configured in vite.config.ts
- WHEN the build runs
- THEN the service worker is bundled separately as required by MV3
- AND the popup entry is bundled independently

### Requirement: Icon Placeholders

The extension MUST include placeholder icon files at standard sizes.

#### Scenario: Icons exist at required sizes

- GIVEN the public/ directory
- WHEN the build completes
- THEN icons exist at 16x16, 32x32, 48x48, and 128x128 sizes in the dist output

### Requirement: Basic Popup Shell

The extension MUST have a minimal React popup shell that renders without errors.

#### Scenario: Popup renders empty shell

- GIVEN the extension is loaded in Opera
- WHEN the user clicks the extension icon
- THEN a popup opens showing a React-rendered container
- AND no console errors appear
