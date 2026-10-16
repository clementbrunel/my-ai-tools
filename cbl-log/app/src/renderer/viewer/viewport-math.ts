// Pure geometry of the virtualized viewport. Browsers cap the height of a scrollable element, so
// beyond MAX_SCROLL_PX the scrollbar range is mapped linearly onto the row range ("scaled" mode):
// the first visible row is then `scrollTop / maxScrollTop * (total - rowsPerViewport)`, which also
// guarantees the very last rows are reachable at the bottom of the scroll range.

export const ROW_HEIGHT = 18;
export const MAX_SCROLL_PX = 30_000_000;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Height of the scroll spacer. */
export function contentHeight(total: number, rowHeight = ROW_HEIGHT): number {
  return Math.min(total * rowHeight, MAX_SCROLL_PX);
}

/** True when the row range does not fit in MAX_SCROLL_PX and scrolling is rescaled. */
export function isScaled(total: number, rowHeight = ROW_HEIGHT): boolean {
  return total * rowHeight > MAX_SCROLL_PX;
}

export function maxScrollTop(total: number, viewportHeight: number, rowHeight = ROW_HEIGHT): number {
  return Math.max(0, contentHeight(total, rowHeight) - viewportHeight);
}

/** Fractional index of the row at the top edge of the viewport. */
export function scrollTopToRowFloat(scrollTop: number, viewportHeight: number, total: number, rowHeight = ROW_HEIGHT): number {
  if (!isScaled(total, rowHeight)) return scrollTop / rowHeight;
  const maxTop = maxScrollTop(total, viewportHeight, rowHeight);
  if (maxTop <= 0) return 0;
  return clamp(scrollTop / maxTop, 0, 1) * (total - viewportHeight / rowHeight);
}

/** Index of the first (even partially) visible row. */
export function scrollTopToRow(scrollTop: number, viewportHeight: number, total: number, rowHeight = ROW_HEIGHT): number {
  if (total <= 0) return 0;
  return clamp(Math.floor(scrollTopToRowFloat(scrollTop, viewportHeight, total, rowHeight)), 0, total - 1);
}

/** scrollTop that puts `row` at the top of the viewport (clamped to the scroll range). */
export function rowToScrollTop(row: number, viewportHeight: number, total: number, rowHeight = ROW_HEIGHT): number {
  const maxTop = maxScrollTop(total, viewportHeight, rowHeight);
  if (!isScaled(total, rowHeight)) return clamp(row * rowHeight, 0, maxTop);
  const span = total - viewportHeight / rowHeight;
  return span <= 0 ? 0 : clamp(row / span, 0, 1) * maxTop;
}

export interface VisibleRange {
  /** First row to render (overscan included). */
  first: number;
  /** Number of rows to render. */
  count: number;
  /** Offset in px, inside the spacer, of the first rendered row. */
  top: number;
}

export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  total: number,
  overscan: number,
  rowHeight = ROW_HEIGHT,
): VisibleRange {
  if (total <= 0) return { first: 0, count: 0, top: 0 };
  const rowFloat = scrollTopToRowFloat(scrollTop, viewportHeight, total, rowHeight);
  const firstVisible = Math.floor(rowFloat);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 1;
  const first = Math.max(0, firstVisible - overscan);
  const end = Math.min(total, firstVisible + visibleCount + overscan);
  return { first, count: Math.max(0, end - first), top: scrollTop - (rowFloat - first) * rowHeight };
}

/** The viewport shows the end of the content (tolerance absorbs sub-pixel scroll positions). */
export function isAtBottom(scrollTop: number, viewportHeight: number, total: number, rowHeight = ROW_HEIGHT, tolerance = 1): boolean {
  return scrollTop + viewportHeight >= contentHeight(total, rowHeight) - tolerance;
}
