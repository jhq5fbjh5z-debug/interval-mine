// ============================================================
// Interval Mine — Stepper Component
// ============================================================
// Reusable +/- numeric stepper with direct input.
// Accessible: keyboard navigation, ARIA labels.
// ============================================================

import React, { useCallback } from "react";

export interface StepperProps {
  /** Current value. */
  value: number;
  /** Callback when value changes. */
  onChange: (value: number) => void;
  /** Minimum allowed value (default: 1). */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Accessible label for the stepper. */
  label: string;
  /** Unit suffix displayed after the value (e.g., "min"). */
  unit?: string;
  /** Whether the stepper is disabled. */
  disabled?: boolean;
}

/**
 * Numeric stepper with +/- buttons and direct input.
 *
 * - Buttons decrement/increment by 1
 * - Respects min/max bounds
 * - Direct input via number field
 * - Fully keyboard accessible
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  unit,
  disabled = false,
}: StepperProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && (max === undefined || value < max);

  const handleDecrement = useCallback(() => {
    if (canDecrement) onChange(value - 1);
  }, [canDecrement, value, onChange]);

  const handleIncrement = useCallback(() => {
    if (canIncrement) onChange(value + 1);
  }, [canIncrement, value, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (isNaN(raw)) return;
      const clamped = Math.max(min, max !== undefined ? Math.min(raw, max) : raw);
      onChange(clamped);
    },
    [min, max, onChange],
  );

  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper__label">{label}</span>
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__btn"
          onClick={handleDecrement}
          disabled={!canDecrement}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          className="stepper__input"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          disabled={disabled}
          aria-label={label}
        />
        {unit && <span className="stepper__unit">{unit}</span>}
        <button
          type="button"
          className="stepper__btn"
          onClick={handleIncrement}
          disabled={!canIncrement}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
