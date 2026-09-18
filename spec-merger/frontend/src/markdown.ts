import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

const OUTER_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(markdown|md)?[ \t]*\n([\s\S]*)\n {0,3}\1[ \t]*$/i
// Same fence, tagged specifically `markdown`/`md`, but wherever it appears in the text rather
// than requiring it to span the whole document — covers a leading sentence of chatter ("Voici
// la documentation ... :") before the fence, which the whole-document check above misses since
// the fence then isn't the first thing in the string. Only the markdown/md tag is targeted (not
// bare ``` or another language) so a genuine code sample fenced elsewhere in the doc is untouched.
const TAGGED_FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*(?:markdown|md)[ \t]*\r?\n([\s\S]*?)\r?\n {0,3}\2[ \t]*$/gim

/** Undoes a habit AI generations tend to have that otherwise defeats any markdown parser
 *  fed this value — the Aperçu preview (marked, below) and the Édition Markdown rich-text
 *  editor (MDXEditor, which parses `value` itself) alike: wrapping the (whole, or just the
 *  document part of the) answer in a ```markdown ... ``` fence, which without this renders
 *  as a literal code block instead of the document it fences. */
export function normalizeMarkdown(value: string): string {
  const wholeDocument = value.trim().match(OUTER_FENCE)
  if (wholeDocument) return wholeDocument[3]
  return value.replace(TAGGED_FENCE, (_match, _indent, _fence, inner: string) => inner)
}

/** Renders Markdown to sanitized HTML, ready for `dangerouslySetInnerHTML`. */
export function renderMarkdown(value: string): string {
  return DOMPurify.sanitize(marked.parse(normalizeMarkdown(value), { async: false }) as string)
}
