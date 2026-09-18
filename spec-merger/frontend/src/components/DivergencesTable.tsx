import type { Divergence } from '../types'

interface DivergencesTableProps {
  divergences: Divergence[]
}

function DivergencesTable({ divergences }: DivergencesTableProps) {
  if (divergences.length === 0) return null

  return (
    <section className="mx-3 mb-3 card p-4 overflow-x-auto">
      <h2 className="field-label mb-3">Divergences détectées ({divergences.length})</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#fafafa]">
            <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">Section</th>
            <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">Word</th>
            <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">JXML</th>
            <th className="border border-[#dcdcde] px-3 py-2 text-left font-semibold text-[#626168]">Proposition IA</th>
          </tr>
        </thead>
        <tbody>
          {divergences.map((d) => (
            <tr key={d.id} className="hover:bg-[#fafafa]">
              <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.sectionRef}</td>
              <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.wordExcerpt ?? '—'}</td>
              <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.jxmlExcerpt ?? '—'}</td>
              <td className="border border-[#dcdcde] px-3 py-2 align-top">{d.aiProposal ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default DivergencesTable
