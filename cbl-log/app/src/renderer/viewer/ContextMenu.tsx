import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuItem = { label: string; onSelect(): void; disabled?: boolean; title?: string } | "separator";

interface Props {
  x: number;
  y: number;
  items: readonly MenuItem[];
  onClose(): void;
}

/** Small right-click menu drawn in the page. Its items do not take the focus, so the text selection stays. */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // keep the menu inside the window
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos({ left: Math.max(0, Math.min(x, window.innerWidth - el.offsetWidth - 4)), top: Math.max(0, Math.min(y, window.innerHeight - el.offsetHeight - 4)) });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("wheel", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("wheel", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="ctxmenu" role="menu" style={pos} onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={i} className="ctxmenu-sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            title={item.title}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
