# Interval Mine

An elegant interval timer extension for Opera. Designed to help you switch tasks smoothly and maintain your flow without looking back.

## Features

- **Focus/Break Cycles** — Pomodoro-style timer with configurable intervals
- **Configurable Durations** — Set focus (5-120 min), break (1-60 min), and optional long break
- **Phase-Aware UI** — Visual indicators for focus, break, and long break phases
- **Session Tracking** — Track completed focus sessions
- **Smart Notifications** — Phase-end notifications with contextual messages
- **Persistent State** — Timer survives popup close and browser restart
- **Clean Design** — Minimal, elegant UI that stays out of your way

## Installation

### From Source (Developer Mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/interval-mine.git
   cd interval-mine
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Opera:
   - Open `opera://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist/` folder

### Usage

1. Click the Interval Mine icon in your toolbar
2. Configure your intervals:
   - **Focus duration** — How long to focus (default: 25 min)
   - **Break duration** — How long to break (default: 5 min)
   - **Long break** — Optional, disabled by default
3. Click **Start** to begin your focus session
4. Timer counts down with phase-aware notifications
5. When complete, break starts automatically
6. Repeat the cycle!

### Controls

| State | Available Actions |
|-------|-------------------|
| Idle | Start |
| Running | Pause, Skip, Reset |
| Paused | Resume, Skip, Reset |
| Cycle Complete | Start New Cycle |

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Scripts

```bash
npm run dev      # Start dev server with HMR
npm run build    # Build for production
npm run test     # Run tests
npm run preview  # Preview production build
```

### Project Structure

```
src/
├── popup/
│   ├── App.tsx           # Root component
│   ├── TimerView.tsx     # Timer display + controls
│   ├── ConfigView.tsx    # Configuration UI
│   ├── components/
│   │   └── Stepper.tsx   # Numeric stepper component
│   └── hooks/
│       └── useTimerState.ts  # Timer state management
├── background.ts         # Service worker (alarms, notifications)
├── state-machine.ts      # Pure function state machine
├── timer.ts              # Timer calculation utilities
├── storage.ts            # Chrome storage wrapper
└── types.ts              # TypeScript type definitions
```

### Testing

```bash
npm run test        # Run all tests
npm run test -- --watch  # Watch mode
```

77 tests covering state machine, timer engine, and storage.

## Tech Stack

- **React 18** — UI framework
- **Vite 6** — Build tool with HMR
- **TypeScript 5** — Type safety
- **CRXJS** — Vite plugin for browser extensions
- **Vitest** — Testing framework

## Architecture

- **Pure Function State Machine** — All state transitions are pure functions, easily testable
- **Timestamp-Based Timer** — Uses `Date.now()` for precise timing, survives service worker termination
- **Chrome Storage API** — Persistent state across sessions
- **Service Worker Background** — Handles alarms and notifications

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- Inspired by the Pomodoro Technique
- Built with [CRXJS](https://crxjs.dev/) Vite plugin
- Icons placeholder — replace with your own design
