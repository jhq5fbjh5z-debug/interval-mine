// ============================================================
// Interval Mine — Config View Component
// ============================================================
// Inline configuration: 3 steppers + 1 toggle.
// Visible only when idle — disabled otherwise.
// ============================================================

import React, { useCallback } from "react";
import type { Config } from "../types";
import { Stepper } from "./components/Stepper";

interface ConfigViewProps {
  /** Current config values. */
  config: Config;
  /** Callback when config changes (saves to storage). */
  onConfigChange: (config: Config) => void;
  /** Whether config is editable (only when idle). */
  disabled?: boolean;
}

/**
 * Configuration view with steppers for focus/break/long-break
 * durations and a toggle for long break.
 */
export function ConfigView({
  config,
  onConfigChange,
  disabled = false,
}: ConfigViewProps) {
  const handleFocusChange = useCallback(
    (value: number) => {
      onConfigChange({ ...config, focusMinutes: value });
    },
    [config, onConfigChange],
  );

  const handleBreakChange = useCallback(
    (value: number) => {
      onConfigChange({ ...config, breakMinutes: value });
    },
    [config, onConfigChange],
  );

  const handleLongBreakChange = useCallback(
    (value: number) => {
      onConfigChange({ ...config, longBreakMinutes: value });
    },
    [config, onConfigChange],
  );

  const handleToggleLongBreak = useCallback(() => {
    onConfigChange({ ...config, longBreakEnabled: !config.longBreakEnabled });
  }, [config, onConfigChange]);

  return (
    <div className="config-view">
      <Stepper
        label="Focus"
        value={config.focusMinutes}
        onChange={handleFocusChange}
        min={1}
        max={120}
        unit="min"
        disabled={disabled}
      />
      <Stepper
        label="Break"
        value={config.breakMinutes}
        onChange={handleBreakChange}
        min={1}
        max={60}
        unit="min"
        disabled={disabled}
      />

      {/* Long break toggle */}
      <div className="config-view__toggle-row">
        <label className="toggle" htmlFor="long-break-toggle">
          <input
            type="checkbox"
            id="long-break-toggle"
            className="toggle__input"
            checked={config.longBreakEnabled}
            onChange={handleToggleLongBreak}
            disabled={disabled}
          />
          <span className="toggle__slider" />
          <span className="toggle__label">Long Break</span>
        </label>
      </div>

      {/* Long break stepper — visible only when toggle is on */}
      {config.longBreakEnabled && (
        <Stepper
          label="Long Break"
          value={config.longBreakMinutes}
          onChange={handleLongBreakChange}
          min={5}
          max={60}
          unit="min"
          disabled={disabled}
        />
      )}
    </div>
  );
}
