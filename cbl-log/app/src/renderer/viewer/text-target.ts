import { wordBounds } from "./word-at";

/** Parts of a row's text that are decoration, not log content: never part of a word nor of a copy. */
const DECORATION = ".fold-badge, .log-ellipsis";

/** What a right-click aimed at: the text the menu acts on, and the DOM range to highlight. */
export interface TextTarget {
  text: string;
  range: Range;
  /** Several lines: usable for copying, not as a one-line search / filter text. */
  multiline: boolean;
}

function textNodesOf(root: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.parentElement?.closest(DECORATION)) nodes.push(n as Text);
  }
  return nodes;
}

function rectsContain(range: Range, x: number, y: number): boolean {
  const slack = 1;
  for (const r of Array.from(range.getClientRects())) {
    if (x >= r.left - slack && x <= r.right + slack && y >= r.top - slack && y <= r.bottom + slack) return true;
  }
  return false;
}

/** The caret position under a point (Chromium's `caretRangeFromPoint`, or the standard one when present). */
function caretAt(x: number, y: number): { node: Node; offset: number } | undefined {
  if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : undefined;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : undefined;
}

/** The user's own selection, when the point falls inside it. */
export function selectionAt(x: number, y: number, within: Element): TextTarget | undefined {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return undefined;
  const range = sel.getRangeAt(0);
  if (!within.contains(range.commonAncestorContainer) || !rectsContain(range, x, y)) return undefined;
  const text = sel.toString();
  return text.trim() === "" ? undefined : { text, range, multiline: /[\r\n]/.test(text) };
}

/** The word of a log line under a point; undefined on blanks, separators, the gutter or past the end of the line. */
export function wordAt(x: number, y: number): TextTarget | undefined {
  const caret = caretAt(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return undefined;
  const logText = caret.node.parentElement?.closest(".log-text");
  if (!logText) return undefined;
  const nodes = textNodesOf(logText);
  const index = nodes.indexOf(caret.node as Text);
  if (index < 0) return undefined;

  const starts: number[] = [];
  let full = "";
  for (const n of nodes) {
    starts.push(full.length);
    full += n.data;
  }
  const bounds = wordBounds(full, starts[index]! + caret.offset);
  if (!bounds) return undefined;

  // global offset -> (node, offset); an end falling on a node boundary stays in the earlier node
  const locate = (at: number, isEnd: boolean): { node: Text; offset: number } => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const start = starts[i]!;
      if (isEnd ? at > start : at >= start) return { node: nodes[i]!, offset: at - start };
    }
    return { node: nodes[0]!, offset: 0 };
  };
  const from = locate(bounds[0], false);
  const to = locate(bounds[1], true);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  // `caretRangeFromPoint` answers with the nearest caret even far from the text: the point must be on the word
  if (!rectsContain(range, x, y)) return undefined;
  return { text: full.slice(bounds[0], bounds[1]), range, multiline: false };
}

/** Highlights the range the way a manual selection would be. */
export function selectRange(range: Range): void {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** A text selection exists inside `within` (the follow mode must not scroll it away). */
export function hasTextSelection(within: Element | null): boolean {
  const sel = window.getSelection();
  return !!within && !!sel && !sel.isCollapsed && sel.rangeCount > 0 && within.contains(sel.getRangeAt(0).commonAncestorContainer);
}
