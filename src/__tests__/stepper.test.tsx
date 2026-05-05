// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Stepper } from '../popup/components/Stepper';

describe('Stepper Component', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should handle incrementing from initial value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Stepper
        label="Focus"
        value={20}
        onChange={onChange}
        min={1}
        max={120}
        unit="min"
      />
    );

    // Click + button to increment from 20
    const incrementButton = container.querySelector('[aria-label="Increase Focus"]') as HTMLButtonElement;
    fireEvent.click(incrementButton);
    
    // Should call onChange with 21
    expect(onChange).toHaveBeenCalledWith(21);
    
    // Click + again
    fireEvent.click(incrementButton);
    
    // Should call onChange with 21 again (since we're mocking, value is still 20)
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('should clamp values to max when typing', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Stepper
        label="Focus"
        value={20}
        onChange={onChange}
        min={1}
        max={120}
        unit="min"
      />
    );

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    
    // Type 150 in the input (exceeds max of 120)
    fireEvent.change(input, { target: { value: '150' } });
    
    // Should clamp to max (120)
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it('should clamp values to min when typing', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Stepper
        label="Focus"
        value={20}
        onChange={onChange}
        min={1}
        max={120}
        unit="min"
      />
    );

    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    
    // Type 0 in the input (below min of 1)
    fireEvent.change(input, { target: { value: '0' } });
    
    // Should clamp to min (1)
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('should not allow incrementing above max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Stepper
        label="Focus"
        value={120}
        onChange={onChange}
        min={1}
        max={120}
        unit="min"
      />
    );

    const incrementButton = container.querySelector('[aria-label="Increase Focus"]') as HTMLButtonElement;
    expect(incrementButton.disabled).toBe(true);
    
    fireEvent.click(incrementButton);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should not allow decrementing below min', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Stepper
        label="Focus"
        value={1}
        onChange={onChange}
        min={1}
        max={120}
        unit="min"
      />
    );

    const decrementButton = container.querySelector('[aria-label="Decrease Focus"]') as HTMLButtonElement;
    expect(decrementButton.disabled).toBe(true);
    
    fireEvent.click(decrementButton);
    expect(onChange).not.toHaveBeenCalled();
  });
});
