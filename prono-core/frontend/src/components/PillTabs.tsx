interface PillTabsProps<T extends string> {
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}

/** Small pill-style tab strip shared by the F1 screens (filters, standings tabs). */
function PillTabs<T extends string>({ options, value, onChange }: PillTabsProps<T>) {
  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          onClick={() => onChange(optionValue)}
          aria-pressed={value === optionValue}
          className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
            value === optionValue
              ? 'bg-white dark:bg-wc-dark-secondary text-gray-900 dark:text-white shadow'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default PillTabs;
