import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

const OUTER_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(markdown|md)?[ \t]*\n([\s\S]*)\n {0,3}\1[ \t]*$/i

/** Undoes a habit AI generations tend to have that otherwise defeats the markdown parser:
 *  wrapping the whole answer in a single ```markdown ... ``` fence, which without this would
 *  render as one big literal code block instead of the document it fences. */
function normalize(value: string): string {
  const unfenced = value.trim().match(OUTER_FENCE)
  return unfenced ? unfenced[3] : value
}

/** Renders Markdown to sanitized HTML, ready for `dangerouslySetInnerHTML`. */
export function renderMarkdown(value: string): string {
  return DOMPurify.sanitize(marked.parse(normalize(value), { async: false }) as string)
}
