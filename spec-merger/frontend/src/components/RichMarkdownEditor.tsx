import { useEffect, useRef } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

interface RichMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

const CODE_BLOCK_LANGUAGES = {
  txt: 'Texte',
  xml: 'XML',
  java: 'Java',
  json: 'JSON',
  js: 'JavaScript',
  sql: 'SQL',
}

/** WYSIWYG editor over a markdown value, backed by MDXEditor — edits the rendered document
 * directly (toolbar for bold/headings/lists/tables/links) instead of raw markdown syntax. */
function RichMarkdownEditor({ value, onChange, placeholder }: RichMarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null)
  // Tracks the last value this component itself emitted via onChange, so the sync effect below
  // only pushes `setMarkdown` for changes that came from outside (a re-merge, a session restore)
  // and never fights the user's own typing, which would otherwise reset the cursor mid-edit.
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      editorRef.current?.setMarkdown(value)
      lastEmitted.current = value
    }
  }, [value])

  function handleChange(markdown: string) {
    lastEmitted.current = markdown
    onChange(markdown)
  }

  return (
    <div className="rich-markdown-editor w-full flex-1 min-h-0 rounded border border-[#dcdcde] overflow-auto">
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={handleChange}
        placeholder={placeholder}
        contentEditableClassName="markdown-preview px-3 py-2"
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
          codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <ListsToggle />
                <Separator />
                <CreateLink />
                <InsertTable />
                <InsertThematicBreak />
                <InsertCodeBlock />
              </>
            ),
          }),
        ]}
      />
    </div>
  )
}

export default RichMarkdownEditor
