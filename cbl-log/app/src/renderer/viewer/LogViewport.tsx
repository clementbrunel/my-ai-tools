import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CompiledFormat, Row } from "@cbl-log/shared";
import { computeRowLevels } from "../formats/row-levels";
import type { HighlightResult } from "../highlight/highlight";
import type { PageCache } from "./page-cache";
import { marksByRow, rollMarkLabel, type RollMark } from "./roll-mark";
import { formatRows, isSelected, MAX_COPY_ROWS, selectionRange, selectionSize, type Selection } from "./selection";
import { isAtBottom, isScaled, contentHeight, ROW_HEIGHT, rowToScrollTop, scrollTopToRow, visibleRange } from "./viewport-math";

// Rows rendered beyond the viewport on each side: the window scrolls natively with the content, so a
// generous margin keeps the edges covered between two React renders.
const OVERSCAN = 40;
const COPY_CHUNK = 2000;

interface Props {
  cache: PageCache;
  /** Real number of rows in the file. */
  total: number;
  /** Rows before this one are hidden ("clear"); line numbers stay those of the file. */
  base: number;
  marks: readonly RollMark[];
  /** Detected log format: gives each row a level marker (continuation lines inherit it). */
  format?: CompiledFormat | undefined;
  /**
   * The rows are those of a filtered view: `total` counts the retained lines, a row's position is not
   * its line number (`row.lineNo`, shown in the gutter) and its level comes with it from the engine.
   */
  filtered?: boolean | undefined;
  /** Colors a line according to the active highlighting rules. */
  highlight(text: string): HighlightResult;
  follow: boolean;
  /**
   * Scroll to `row` (a row of this view) whenever `nonce` changes: centered (search results) or put at
   * the top (keeping the position when the view changes).
   */
  reveal?: { row: number; nonce: number; align?: "center" | "top" } | undefined;
  /** Line number of the current search match (outlined). */
  currentMatchRow?: number | undefined;
  /** Line number the user asked to see in context (outlined). */
  anchorLine?: number | undefined;
  /** Filtered view: double-click on a line (to show it among the others). */
  onRowDoubleClick?: ((row: Row) => void) | undefined;
  /** Filtered view: go to a line number of the file (the view finds where it falls). */
  onGotoLine?: ((line: number) => void) | undefined;
  /** Number of lines of the file, for the "go to line" range of a filtered view. */
  fileRows?: number | undefined;
  /** Receives the first visible row, so the search can start from where the user is. */
  viewRowRef?: { current: number };
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
export function LogViewport({ cache, total: realTotal, base, marks, format, filtered = false, highlight, follow, reveal, currentMatchRow, anchorLine, onRowDoubleClick, onGotoLine, fileRows, viewRowRef, initialRow, onFollowChange, onLeave, fetchRows, onNotice }: Props) {
  const total = Math.max(0, realTotal - base);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [selection, setSelection] = useState<Selection | undefined>();
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  /** Real scroll position, updated on every scroll event (the `scrollTop` state only moves when the window must). */
  const scrollTopRef = useRef(0);
  const renderedRow = useRef(0);
  /** The user scrolled away from the bottom; follow mode must not pull the view back before React catches up. */
  const userUnpinned = useRef(false);
  const wasFollowing = useRef(follow);
  const latest = useRef({ viewportHeight: 0, total, follow, initialRow, selection, base, realTotal, filtered });
  latest.current = { viewportHeight, total, follow, initialRow, selection, base, realTotal, filtered };

  /** Re-render the window around `top` (programmatic scrolls, and native scrolls that cross a row). */
  const commitScroll = useCallback((top: number) => {
    scrollTopRef.current = top;
    const { viewportHeight: vh, total: count } = latest.current;
    renderedRow.current = scrollTopToRow(top, vh, count);
    setScrollTop(top);
  }, []);
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
      const { viewportHeight: vh, total: count } = latest.current;
      if (vh === 0) return; // never measured (StrictMode probe): keep the remembered row
      onLeave(scrollTopToRow(scrollTopRef.current, vh, count));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // "Clear" moves the origin: the old selection no longer means anything.
  useEffect(() => setSelection(undefined), [base]);

  const range = visibleRange(scrollTop, viewportHeight, total, OVERSCAN);
  const levels = filtered
    ? Array.from({ length: range.count }, (_, i) => cache.getRow(base + range.first + i)?.level)
    : computeRowLevels(format, (row) => cache.getRow(row)?.text, base + range.first, range.count);
  if (viewRowRef) viewRowRef.current = base + scrollTopToRow(scrollTop, viewportHeight, total);

  // Reveal request: center the row (search hit).
  const revealNonce = reveal?.nonce;
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || reveal === undefined) return;
    const { viewportHeight: vh, total: count, base: origin } = latest.current;
    const relative = Math.min(Math.max(reveal.row - origin, 0), Math.max(0, count - 1));
    const target = reveal.align === "top" ? relative : Math.max(0, relative - Math.floor(vh / ROW_HEIGHT / 2));
    el.scrollTop = rowToScrollTop(target, vh, count);
    commitScroll(el.scrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNonce]);

  // Keep the pages under the viewport loaded (the cache de-duplicates and prefetches neighbours).
  useEffect(() => {
    cache.request(base + range.first, range.count, realTotal);
  }, [cache, base, range.first, range.count, realTotal]);

  // Follow mode: stick to the end whenever the content or the viewport size changes. The scroll
  // events this triggers land at the bottom, so they keep follow on instead of switching it off.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || viewportHeight === 0) return;
    const justEnabled = follow && !wasFollowing.current;
    wasFollowing.current = follow;
    if (follow && (justEnabled || !userUnpinned.current)) {
      userUnpinned.current = false;
      el.scrollTop = el.scrollHeight - el.clientHeight;
      commitScroll(el.scrollTop);
    } else if (!follow && !restored.current) {
      el.scrollTop = rowToScrollTop(latest.current.initialRow, viewportHeight, total);
      commitScroll(el.scrollTop);
    }
    restored.current = true;
  }, [follow, total, viewportHeight]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { viewportHeight: vh, total: count, follow: isFollowing } = latest.current;
    const top = el.scrollTop;
    scrollTopRef.current = top;
    // The window scrolls natively with the content: only re-render when another row comes into view
    // (or in scaled mode, where the window follows the scroll position continuously).
    if (isScaled(count) || scrollTopToRow(top, vh, count) !== renderedRow.current) commitScroll(top);
    const bottom = isAtBottom(top, vh, count);
    userUnpinned.current = !bottom;
    if (bottom !== isFollowing) onFollowChange(bottom);
  }, [onFollowChange, commitScroll]);

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
    const mark = filtered ? undefined : markAt.get(lineRow);
    const colored = row ? highlight(row.text) : undefined;
    const classes = ["log-row"];
    if (mark) classes.push("roll-start");
    if (isSelected(selection, lineRow)) classes.push("selected");
    const lineNo = filtered ? row?.lineNo : lineRow;
    if (lineNo === currentMatchRow) classes.push("current-match");
    if (lineNo === anchorLine) classes.push("anchor");
    const level = levels[i - range.first];
    if (level) classes.push(`lvl-${level}`);
    rows.push(
      <div
        className={classes.join(" ")}
        key={lineRow}
        style={{
          height: ROW_HEIGHT,
          ...(colored?.lineBg ? { backgroundColor: colored.lineBg } : {}),
          ...(colored?.lineFg ? { color: colored.lineFg } : {}),
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          dragging.current = true;
          setSelection((prev) => (e.shiftKey && prev ? { anchor: prev.anchor, head: lineRow } : { anchor: lineRow, head: lineRow }));
        }}
        onDoubleClick={() => {
          if (row && onRowDoubleClick) onRowDoubleClick(row);
        }}
        onMouseEnter={(e) => {
          if (dragging.current && e.buttons === 1) setSelection((prev) => (prev ? { anchor: prev.anchor, head: lineRow } : prev));
        }}
      >
        <span className="log-gutter">
          <span className="log-level">{level?.toUpperCase()}</span>
          {filtered ? (row ? row.lineNo + 1 : "") : lineRow + 1}
        </span>
        <span className="log-text">
          {colored
            ? colored.segments.map((seg, n) =>
                seg.fg || seg.bg ? (
                  <span key={n} style={{ color: seg.fg, backgroundColor: seg.bg }}>
                    {seg.text}
                  </span>
                ) : (
                  seg.text
                ),
              )
            : ""}
          {row?.truncated ? "…" : ""}
          {row?.folded ? (
            <span className="fold-badge" title="Lignes repliées sous celle-ci (double-clic : voir le détail)">
              ▸ +{row.folded.toLocaleString("fr-FR")} ligne{row.folded > 1 ? "s" : ""}
            </span>
          ) : null}
        </span>
        {mark && <span className="roll-label">{rollMarkLabel(mark)}</span>}
      </div>,
    );
  }

  return (
    <div className="viewport-wrap">
      <div ref={scrollerRef} className="viewport" tabIndex={0} onScroll={onScroll}>
        <div className="viewport-spacer" style={{ height: contentHeight(total) }}>
          <div className="viewport-window" style={{ transform: `translateY(${range.top}px)` }}>
            {rows}
          </div>
        </div>
      </div>
      {gotoOpen && (
        <GotoLine
          min={filtered ? 1 : base + 1}
          max={filtered ? Math.max(fileRows ?? 1, 1) : Math.max(realTotal, base + 1)}
          onClose={() => {
            setGotoOpen(false);
            scrollerRef.current?.focus();
          }}
          onGoto={(line) => {
            onFollowChange(false);
            if (filtered) onGotoLine?.(line);
            else scrollToRow(line - 1 - base);
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
