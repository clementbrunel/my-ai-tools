import React from 'react';

interface ScoreInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  inputClassName?: string;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
}

const ScoreInput: React.FC<ScoreInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  inputClassName = '',
  placeholder,
  required = false,
  compact = false,
}) => {
  const num = parseInt(value, 10);

  const decrement = () => {
    const next = (isNaN(num) ? (min ?? 0) : num) - 1;
    if (min === undefined || next >= min) onChange(String(next));
  };

  const increment = () => {
    const next = (isNaN(num) ? (min ?? 0) : num) + 1;
    if (max === undefined || next <= max) onChange(String(next));
  };

  const canDecrement = isNaN(num) || min === undefined || num > min;
  const canIncrement = isNaN(num) || max === undefined || num < max;

  const btnClass = compact
    ? 'btn-secondary shrink-0 px-2 text-base font-bold min-w-[32px] min-h-[32px]'
    : 'btn-secondary shrink-0 px-2 sm:px-3 text-base sm:text-xl font-bold min-w-[32px] min-h-[32px] sm:min-w-[44px] sm:min-h-[44px]';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={decrement}
        disabled={!canDecrement}
        className={btnClass}
        aria-label="Diminuer"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
        placeholder={placeholder}
        required={required}
      />
      <button
        type="button"
        onClick={increment}
        disabled={!canIncrement}
        className={btnClass}
        aria-label="Augmenter"
      >
        +
      </button>
    </div>
  );
};

export default ScoreInput;
