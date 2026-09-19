import { useEffect, useState } from 'react'
import CodePanel from './components/CodePanel'
import CollapsedPanel from './components/CollapsedPanel'
import FullPageLoader from './components/FullPageLoader'
import Header from './components/Header'
import MergeCollapsedPanel from './components/MergeCollapsedPanel'
import MergePanel from './components/MergePanel'
import SpecPanel from './components/SpecPanel'
import { importSession, resetSession, useGenerationSession } from './hooks/useGenerationSession'

// Keyed by spec+merge+code collapsed, in that order, as "0"/"1" — see gridColsClass below.
const GRID_COLS_BY_COLLAPSE: Record<string, string> = {
  '000': 'md:grid-cols-[1fr_1.4fr_1fr]',
  '001': 'md:grid-cols-[1fr_1fr_3rem]',
  '010': 'md:grid-cols-[1fr_3rem_1fr]',
  '011': 'md:grid-cols-[1fr_3rem_3rem]',
  '100': 'md:grid-cols-[3rem_1fr_1fr]',
  '101': 'md:grid-cols-[3rem_1fr_3rem]',
  '110': 'md:grid-cols-[3rem_3rem_1fr]',
  '111': 'md:grid-cols-[3rem_3rem_3rem]',
}

function App() {
  const [specCollapsed, setSpecCollapsed] = useState(false)
  const [codeCollapsed, setCodeCollapsed] = useState(false)
  // Starts collapsed — there's nothing to merge yet — and the effect below opens it as soon as a
  // merge becomes possible or already happened (e.g. a restored session). The user can still
  // collapse it back by hand at any point, e.g. when only doing one of the two docs.
  const [mergeCollapsed, setMergeCollapsed] = useState(true)
  const { word, jxml, merged, restoring, gitlabSelection, initialGitlabSelection, setGitlabSelection } =
    useGenerationSession()

  const bothReady = word.markdown.trim() !== '' && jxml.markdown.trim() !== ''
  const hasMergedResult = merged.id !== null

  useEffect(() => {
    if (bothReady || hasMergedResult) setMergeCollapsed(false)
  }, [bothReady, hasMergedResult])

  // Retracted side panels free up their width so the merge panel (and the remaining side panel,
  // if any) can grow from a third of the screen to a half. The merge panel itself retracts to the
  // same narrow strip whenever it's collapsed, freeing its width to the side panels in turn.
  // Every combination is spelled out as a literal class below (rather than built dynamically) so
  // Tailwind's JIT scanner — which only generates CSS for arbitrary-value classes it can see
  // verbatim in the source — picks up all eight; the lookup key is spec+merge+code collapsed, in
  // that order, as "0"/"1". Spec/Fusion/Code all collapsed is the one case with no `fr` column to
  // absorb the row's leftover width, so it's the only case where the grid's `justify-between`
  // (below) has any visible effect — it keeps Spec glued to the left edge and Code glued to the
  // right edge instead of both drifting left with Fusion, in the middle by construction since all
  // three strips are the same width.
  const gridColsClass =
    GRID_COLS_BY_COLLAPSE[`${+specCollapsed}${+mergeCollapsed}${+codeCollapsed}`]

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {restoring && <FullPageLoader message="Récupération de la session en cours…" />}
      <Header
        mergedDocumentId={merged.id}
        hasSession={Boolean(word.id || jxml.id || merged.id)}
        onImportSession={importSession}
        onReset={resetSession}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className={`grid grid-cols-1 ${gridColsClass} justify-between gap-3 p-3 flex-1 min-h-0`}>
          {specCollapsed ? (
            <CollapsedPanel label="Spec Word / Excel" icon="▶" onExpand={() => setSpecCollapsed(false)} />
          ) : (
            <SpecPanel onCollapse={() => setSpecCollapsed(true)} doc={word} />
          )}

          {mergeCollapsed ? (
            <MergeCollapsedPanel ready={bothReady} onExpand={() => setMergeCollapsed(false)} />
          ) : (
            <MergePanel
              wordDoc={word}
              jxmlDoc={jxml}
              mergedDoc={merged}
              gitlabSelection={gitlabSelection}
              onCollapse={() => setMergeCollapsed(true)}
            />
          )}

          {codeCollapsed ? (
            <CollapsedPanel label="Spec JXML" icon="◀" onExpand={() => setCodeCollapsed(false)} />
          ) : (
            <CodePanel
              onCollapse={() => setCodeCollapsed(true)}
              doc={jxml}
              initialGitlabSelection={initialGitlabSelection}
              onGitlabSelectionChange={setGitlabSelection}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
