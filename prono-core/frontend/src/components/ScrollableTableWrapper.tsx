import { useRef, useState, useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Extra class applied to the inner overflow-x-auto div */
  className?: string;
}

const ScrollableTableWrapper: React.FC<Props> = ({ children, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth + 2;
    setScrollable(canScroll);
    setAtEnd(!canScroll || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  useEffect(() => {
    check();
    const observer = new ResizeObserver(check);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className={`overflow-x-auto ${className}`} onScroll={check}>
        {children}
      </div>

      {/* Right-side fade shadow — hidden once scrolled to end */}
      {scrollable && !atEnd && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white dark:from-gray-900 to-transparent"
        />
      )}

      {/* Scroll hint label — only shown when content overflows and not yet at end */}
      {scrollable && !atEnd && (
        <p className="mt-1 text-center text-xs text-gray-400 dark:text-gray-500 select-none">
          ← défiler →
        </p>
      )}
    </div>
  );
};

export default ScrollableTableWrapper;
