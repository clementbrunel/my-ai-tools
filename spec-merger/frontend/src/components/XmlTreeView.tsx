import { useEffect, useMemo, useState } from 'react'

interface XmlAttribute {
  name: string
  value: string
}

interface XmlElementNode {
  id: string
  tagName: string
  attributes: XmlAttribute[]
  children: XmlElementNode[]
  textContent: string | null
}

function elementToNode(el: Element, id: string): XmlElementNode {
  const children = Array.from(el.children)
  const attributes = Array.from(el.attributes).map((a) => ({ name: a.name, value: a.value }))
  if (children.length === 0) {
    const text = el.textContent?.trim() ?? ''
    return { id, tagName: el.tagName, attributes, children: [], textContent: text || null }
  }
  return {
    id,
    tagName: el.tagName,
    attributes,
    children: children.map((child, i) => elementToNode(child, `${id}-${i}`)),
    textContent: null,
  }
}

function parseXmlToTree(xml: string): XmlElementNode | null {
  if (!xml.trim()) return null
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return null
  const root = doc.documentElement
  if (!root) return null
  return elementToNode(root, '0')
}

function collectIds(node: XmlElementNode, acc: string[]) {
  acc.push(node.id)
  node.children.forEach((child) => collectIds(child, acc))
}

function AttributesSpan({ attributes }: { attributes: XmlAttribute[] }) {
  return (
    <>
      {attributes.map((attr) => (
        <span key={attr.name}>
          {' '}
          <span className="text-[#b08800]">{attr.name}</span>
          <span className="text-gray-500">=</span>
          <span className="text-[#0a6e31]">"{attr.value}"</span>
        </span>
      ))}
    </>
  )
}

function XmlNodeView({
  node,
  expanded,
  onToggle,
  depth,
}: {
  node: XmlElementNode
  expanded: Set<string>
  onToggle: (id: string) => void
  depth: number
}) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const indent = { paddingLeft: depth * 16 }

  if (!hasChildren) {
    return (
      <div style={indent}>
        <span className="text-gl-blue">
          &lt;{node.tagName}
          <AttributesSpan attributes={node.attributes} />
          {node.textContent ? '>' : '/>'}
        </span>
        {node.textContent && (
          <>
            <span className="text-[#303030]">{node.textContent}</span>
            <span className="text-gl-blue">&lt;/{node.tagName}&gt;</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        style={indent}
        className="cursor-pointer select-none hover:bg-[#f5f5f5] rounded"
        onClick={() => onToggle(node.id)}
      >
        <span className="inline-block w-3 text-gray-400">{isExpanded ? '▾' : '▸'}</span>
        <span className="text-gl-blue">
          &lt;{node.tagName}
          <AttributesSpan attributes={node.attributes} />
          &gt;
        </span>
        {!isExpanded && (
          <span className="text-gray-400">
            {' '}
            …{node.children.length} élément(s)… <span className="text-gl-blue">&lt;/{node.tagName}&gt;</span>
          </span>
        )}
      </div>
      {isExpanded && (
        <>
          {node.children.map((child) => (
            <XmlNodeView key={child.id} node={child} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
          ))}
          <div style={indent}>
            <span className="text-gl-blue">&lt;/{node.tagName}&gt;</span>
          </div>
        </>
      )}
    </div>
  )
}

interface XmlTreeViewProps {
  xml: string
}

function XmlTreeView({ xml }: XmlTreeViewProps) {
  const tree = useMemo(() => parseXmlToTree(xml), [xml])
  const allIds = useMemo(() => {
    if (!tree) return []
    const acc: string[] = []
    collectIds(tree, acc)
    return acc
  }, [tree])
  const [expanded, setExpanded] = useState<Set<string>>(new Set(allIds))

  useEffect(() => {
    setExpanded(new Set(allIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!tree) {
    return <pre className="text-[12px] p-2 whitespace-pre-wrap break-all">{xml}</pre>
  }

  return (
    <div>
      <div className="flex gap-3 mb-2 text-sm">
        <button
          type="button"
          className="text-gl-blue hover:text-gl-blue-dark hover:underline"
          onClick={() => setExpanded(new Set(allIds))}
        >
          Tout déplier
        </button>
        <button
          type="button"
          className="text-gl-blue hover:text-gl-blue-dark hover:underline"
          onClick={() => setExpanded(new Set())}
        >
          Tout replier
        </button>
      </div>
      <div className="font-mono text-[12px] leading-5">
        <XmlNodeView node={tree} expanded={expanded} onToggle={toggle} depth={0} />
      </div>
    </div>
  )
}

export default XmlTreeView
