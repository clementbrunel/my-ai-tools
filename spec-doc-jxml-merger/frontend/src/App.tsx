import { useState } from 'react'
import CodePanel from './components/CodePanel'
import CollapsedPanel from './components/CollapsedPanel'
import Header from './components/Header'
import MergePanel from './components/MergePanel'
import SpecPanel from './components/SpecPanel'

function App() {
  const [title, setTitle] = useState('')
  const [specCollapsed, setSpecCollapsed] = useState(false)
  const [codeCollapsed, setCodeCollapsed] = useState(false)

  // Retracted side panels free up their width so the merge panel (and the
  // remaining side panel, if any) can grow from a third of the screen to a half.
  const gridColsClass =
    specCollapsed && codeCollapsed
      ? 'md:grid-cols-[3rem_1fr_3rem]'
      : specCollapsed
        ? 'md:grid-cols-[3rem_1fr_1fr]'
        : codeCollapsed
          ? 'md:grid-cols-[1fr_1fr_3rem]'
          : 'md:grid-cols-[1fr_1.4fr_1fr]'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header title={title} onTitleChange={setTitle} />

      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className={`grid grid-cols-1 ${gridColsClass} gap-3 p-3 flex-1 min-h-0`}>
          {specCollapsed ? (
            <CollapsedPanel label="Spec Word" icon="▶" onExpand={() => setSpecCollapsed(false)} />
          ) : (
            <SpecPanel title={title} onCollapse={() => setSpecCollapsed(true)} />
          )}

          <MergePanel />

          {codeCollapsed ? (
            <CollapsedPanel label="Spec JXML" icon="◀" onExpand={() => setCodeCollapsed(false)} />
          ) : (
            <CodePanel title={title} onCollapse={() => setCodeCollapsed(true)} />
          )}
        </div>
      </div>
    </div>
  )
}

export default App
