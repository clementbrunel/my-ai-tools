import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

const OUTER_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(markdown|md)?[ \t]*\n([\s\S]*)\n {0,3}\1[ \t]*$/i

/** Undoes a habit AI generations tend to have that otherwise defeats any markdown parser
 *  fed this value — the Aperçu preview (marked, below) and the Édition Markdown rich-text
 *  editor (MDXEditor, which parses `value` itself) alike: wrapping the whole answer in a
 *  single ```markdown ... ``` fence, which without this renders as one big literal code
 *  block instead of the document it fences. */
export function normalizeMarkdown(value: string): string {
  const unfenced = value.trim().match(OUTER_FENCE)
  return unfenced ? unfenced[3] : value
}

/** Renders Markdown to sanitized HTML, ready for `dangerouslySetInnerHTML`. */
export function renderMarkdown(value: string): string {
  return DOMPurify.sanitize(marked.parse(normalizeMarkdown(value), { async: false }) as string)
}
