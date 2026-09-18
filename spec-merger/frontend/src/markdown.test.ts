import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('unwraps an AI answer fenced as a single ```markdown code block', () => {
    const html = renderMarkdown('```markdown\n# Titre\n\nParagraphe.\n```')
    expect(html).toContain('<h1>Titre</h1>')
    expect(html).not.toContain('<pre>')
  })

  it('unwraps a plain ``` fence with no language tag', () => {
    const html = renderMarkdown('```\n# Titre\n```')
    expect(html).toContain('<h1>Titre</h1>')
  })

  it('still renders a real code block that is not the whole document', () => {
    const html = renderMarkdown('# Titre\n\n```js\nconst x = 1\n```')
    expect(html).toContain('<h1>Titre</h1>')
    expect(html).toContain('<pre>')
  })

  it('leaves a real GFM table delimiter row alone', () => {
    const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<table>')
  })
})
