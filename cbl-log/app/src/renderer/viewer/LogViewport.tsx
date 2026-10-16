import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import type { PageCache } from "./page-cache";
import { isAtBottom, contentHeight, ROW_HEIGHT, rowToScrollTop, scrollTopToRow, visibleRange } from "./viewport-math";

const OVERSCAN = 20;

interface Props {
  cache: PageCache;
  total: number;
  follow: boolean;
  /** First row to show when the viewport mounts with follow off. */
  initialRow: number;
  onFollowChange(follow: boolean): void;
  /** Called when the viewport is left (tab switch / close) with its first visible row. */
  onLeave(row: number): void;
}

/** Virtualized, fixed-height-row view of a tab's lines. Follow mode keeps the end in view. */
export function LogViewport({ cache, total, follow, initialRow, onFollowChange, onLeave }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const latest = useRef({ scrollTop: 0, viewportHeight: 0, total, follow, initialRow });
  latest.current = { scrollTop, viewportHeight, total, follow, initialRow };
  const restored = useRef(false);

  useEffect(() => cache.subscribe(rerender), [cache]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight);
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      const { scrollTop: top, viewportHeight: vh, total: count } = latest.current;
      if (vh === 0) return; // never measured (StrictMode probe): keep the remembered row
      onLeave(scrollTopToRow(top, vh, count));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const range = visibleRange(scrollTop, viewportHeight, total, OVERSCAN);

  // Keep the pages under the viewport loaded (the cache de-duplicates and prefetches neighbours).
  useEffect(() => {
    cache.request(range.first, range.count, total);
  }, [cache, range.first, range.count, total]);

  // Follow mode: stick to the end whenever the content or the viewport size changes. The scroll
  // events this triggers land at the bottom, so they keep follow on instead of switching it off.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || viewportHeight === 0) return;
    if (follow) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
      setScrollTop(el.scrollTop);
    } else if (!restored.current) {
      el.scrollTop = rowToScrollTop(latest.current.initialRow, viewportHeight, total);
      setScrollTop(el.scrollTop);
    }
    restored.current = true;
  }, [follow, total, viewportHeight]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { viewportHeight: vh, total: count, follow: isFollowing } = latest.current;
    setScrollTop(el.scrollTop);
    const bottom = isAtBottom(el.scrollTop, vh, count);
    if (bottom !== isFollowing) onFollowChange(bottom);
  }, [onFollowChange]);

  const scrollToRow = useCallback((row: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const { viewportHeight: vh, total: count } = latest.current;
    el.scrollTop = rowToScrollTop(Math.min(Math.max(row, 0), Math.max(0, count - 1)), vh, count);
  }, []);

  const scrollToEnd = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    onFollowChange(true);
    el.scrollTop = el.scrollHeight - el.clientHeight;
  }, [onFollowChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key === "End") {
        e.preventDefault();
        scrollToEnd();
      } else if (e.ctrlKey && e.key === "Home") {
        e.preventDefault();
        scrollToRow(0);
      } else if (e.key === "End" && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        scrollToEnd();
      } else if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGotoOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollToEnd, scrollToRow]);

  const rows = [];
  for (let i = range.first; i < range.first + range.count; i++) {
    const row = cache.getRow(i);
    rows.push(
      <div className="log-row" key={i} style={{ height: ROW_HEIGHT }}>
        <span className="log-gutter">{i + 1}</span>
        <span className="log-text">
          {row ? row.text : ""}
          {row?.truncated ? "…" : ""}
        </span>
      </div>,
    );
  }

  return (
    <div className="viewport-wrap">
      <div
        ref={scrollerRef}
        className="viewport"
        tabIndex={0}
        onScroll={onScroll}
      >
        <div className="viewport-spacer" style={{ height: contentHeight(total) }}>
          <div className="viewport-window" style={{ top: range.top }}>
            {rows}
          </div>
        </div>
      </div>
      {gotoOpen && (
        <GotoLine
          total={total}
          onClose={() => {
            setGotoOpen(false);
            scrollerRef.current?.focus();
          }}
          onGoto={(line) => {
            const row = Math.min(Math.max(line, 1), Math.max(total, 1)) - 1;
            onFollowChange(false);
            scrollToRow(row);
          }}
        />
      )}
    </div>
  );
}

function GotoLine({ total, onGoto, onClose }: { total: number; onGoto(line: number): void; onClose(): void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="goto"
      onSubmit={(e) => {
        e.preventDefault();
        const line = Number.parseInt(value, 10);
        if (Number.isFinite(line)) onGoto(line);
        onClose();
      }}
    >
      <label>
        Aller à la ligne (1–{total})
        <input
          autoFocus
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          onBlur={onClose}
        />
      </label>
    </form>
  );
}
