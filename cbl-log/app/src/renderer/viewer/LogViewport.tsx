import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Row } from "@cbl-log/shared";
import type { PageCache } from "./page-cache";
import { marksByRow, rollMarkLabel, type RollMark } from "./roll-mark";
import { formatRows, isSelected, MAX_COPY_ROWS, selectionRange, selectionSize, type Selection } from "./selection";
import { isAtBottom, contentHeight, ROW_HEIGHT, rowToScrollTop, scrollTopToRow, visibleRange } from "./viewport-math";

const OVERSCAN = 20;
const COPY_CHUNK = 2000;

interface Props {
  cache: PageCache;
  /** Real number of rows in the file. */
  total: number;
  /** Rows before this one are hidden ("clear"); line numbers stay those of the file. */
  base: number;
  marks: readonly RollMark[];
  follow: boolean;
  /** First row to show (relative to `base`) when the viewport mounts with follow off. */
  initialRow: number;
  onFollowChange(follow: boolean): void;
  /** Called when the viewport is left (tab switch / close) with its first visible row (relative to `base`). */
  onLeave(row: number): void;
  /** Reads rows straight from the engine, for copying selections that are not in the page cache. */
  fetchRows(first: number, count: number): Promise<Row[]>;
  onNotice(text: string, isError?: boolean): void;
}

/** Virtualized, fixed-height-row view of a tab's lines. Follow mode keeps the end in view. */
export function LogViewport({ cache, total: realTotal, base, marks, follow, initialRow, onFollowChange, onLeave, fetchRows, onNotice }: Props) {
  const total = Math.max(0, realTotal - base);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | undefined>();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const latest = useRef({ scrollTop: 0, viewportHeight: 0, total, follow, initialRow, selection, base, realTotal });
  latest.current = { scrollTop, viewportHeight, total, follow, initialRow, selection, base, realTotal };
  const restored = useRef(false);
  const dragging = useRef(false);
  const markAt = useMemo(() => marksByRow(marks), [marks]);

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

  // "Clear" moves the origin: the old selection no longer means anything.
  useEffect(() => setSelection(undefined), [base]);

  const range = visibleRange(scrollTop, viewportHeight, total, OVERSCAN);

  // Keep the pages under the viewport loaded (the cache de-duplicates and prefetches neighbours).
  useEffect(() => {
    cache.request(base + range.first, range.count, realTotal);
  }, [cache, base, range.first, range.count, realTotal]);

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

  const copySelection = useCallback(
    async (withLineNumbers: boolean) => {
      const current = latest.current.selection;
      if (!current) return;
      if (selectionSize(current) > MAX_COPY_ROWS) {
        onNotice(`Sélection trop grande pour la copie (max ${MAX_COPY_ROWS.toLocaleString("fr-FR")} lignes).`, true);
        return;
      }
      const { first, last } = selectionRange(current);
      try {
        const rows: Row[] = [];
        for (let from = first; from <= last; from += COPY_CHUNK) {
          rows.push(...(await fetchRows(from, Math.min(COPY_CHUNK, last - from + 1))));
        }
        await navigator.clipboard.writeText(formatRows(rows, withLineNumbers));
        onNotice(`${rows.length.toLocaleString("fr-FR")} ligne(s) copiée(s)${withLineNumbers ? " avec numéros" : ""}.`);
      } catch (err) {
        onNotice(`Copie impossible : ${err instanceof Error ? err.message : String(err)}`, true);
      }
    },
    [fetchRows, onNotice],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const inInput = e.target instanceof HTMLInputElement;
      if (e.ctrlKey && e.key === "End") {
        e.preventDefault();
        scrollToEnd();
      } else if (e.ctrlKey && e.key === "Home") {
        e.preventDefault();
        scrollToRow(0);
      } else if (e.key === "End" && !e.ctrlKey && !e.altKey && !inInput) {
        e.preventDefault();
        scrollToEnd();
      } else if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGotoOpen(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "c" && !inInput && latest.current.selection) {
        e.preventDefault();
        void copySelection(e.shiftKey);
      } else if (e.ctrlKey && e.key.toLowerCase() === "a" && !inInput) {
        e.preventDefault();
        const { base: origin, realTotal: end } = latest.current;
        if (end > origin) setSelection({ anchor: origin, head: end - 1 });
      } else if (e.key === "Escape" && !inInput) {
        setSelection(undefined);
      }
    };
    const onMouseUp = (): void => {
      dragging.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [scrollToEnd, scrollToRow, copySelection]);

  const rows = [];
  for (let i = range.first; i < range.first + range.count; i++) {
    const lineRow = base + i;
    const row = cache.getRow(lineRow);
    const mark = markAt.get(lineRow);
    const classes = ["log-row"];
    if (mark) classes.push("roll-start");
    if (isSelected(selection, lineRow)) classes.push("selected");
    rows.push(
      <div
        className={classes.join(" ")}
        key={lineRow}
        style={{ height: ROW_HEIGHT }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          dragging.current = true;
          setSelection((prev) => (e.shiftKey && prev ? { anchor: prev.anchor, head: lineRow } : { anchor: lineRow, head: lineRow }));
        }}
        onMouseEnter={(e) => {
          if (dragging.current && e.buttons === 1) setSelection((prev) => (prev ? { anchor: prev.anchor, head: lineRow } : prev));
        }}
      >
        <span className="log-gutter">{lineRow + 1}</span>
        <span className="log-text">
          {row ? row.text : ""}
          {row?.truncated ? "…" : ""}
        </span>
        {mark && <span className="roll-label">{rollMarkLabel(mark)}</span>}
      </div>,
    );
  }

  return (
    <div className="viewport-wrap">
      <div ref={scrollerRef} className="viewport" tabIndex={0} onScroll={onScroll}>
        <div className="viewport-spacer" style={{ height: contentHeight(total) }}>
          <div className="viewport-window" style={{ top: range.top }}>
            {rows}
          </div>
        </div>
      </div>
      {gotoOpen && (
        <GotoLine
          min={base + 1}
          max={Math.max(realTotal, base + 1)}
          onClose={() => {
            setGotoOpen(false);
            scrollerRef.current?.focus();
          }}
          onGoto={(line) => {
            onFollowChange(false);
            scrollToRow(line - 1 - base);
          }}
        />
      )}
    </div>
  );
}

function GotoLine({ min, max, onGoto, onClose }: { min: number; max: number; onGoto(line: number): void; onClose(): void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="goto"
      onSubmit={(e) => {
        e.preventDefault();
        const line = Number.parseInt(value, 10);
        if (Number.isFinite(line)) onGoto(Math.min(Math.max(line, min), max));
        onClose();
      }}
    >
      <label>
        Aller à la ligne ({min}–{max})
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
