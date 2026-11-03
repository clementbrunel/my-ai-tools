/**
 * "Word" under a point of a log line, for the right-click menu (include / exclude / search).
 * A word is a run of characters that are neither blanks nor separators of a log record
 * (`key=value`, quotes, brackets, commas…). Dots, dashes, colons and slashes stay inside, so that
 * `com.acme.Service`, `10.0.0.1`, `user-123`, `10:02:11.123` or `/api/v1/users` come as one block.
 */
const SEPARATORS = new Set([..." \t\r\n", ..."\"'`=,;()[]{}<>|!?*", " "]);
/** Punctuation that ends a sentence rather than a token: trimmed off both ends. */
const EDGE = new Set([..."._-:/\\@#$%&+~^"]);

const isWordChar = (c: string): boolean => !SEPARATORS.has(c);

/**
 * Bounds `[start, end)` of the word at `offset` (a caret position, so between two characters: the
 * word is the one the caret touches). `undefined` when the caret touches no word.
 */
export function wordBounds(text: string, offset: number): [number, number] | undefined {
  const at = (i: number): boolean => i >= 0 && i < text.length && isWordChar(text[i]!);
  let pivot = offset;
  if (!at(pivot)) {
    if (at(pivot - 1)) pivot -= 1;
    else return undefined;
  }
  let start = pivot;
  let end = pivot + 1;
  while (at(start - 1)) start--;
  while (at(end)) end++;
  while (start < end && EDGE.has(text[start]!)) start++;
  while (end > start && EDGE.has(text[end - 1]!)) end--;
  // the caret must touch the trimmed word (it may have been on the punctuation we trimmed)
  if (start >= end || offset < start || offset > end) return undefined;
  return [start, end];
}
