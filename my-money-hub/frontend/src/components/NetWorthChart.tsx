import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NetWorthPoint } from '@/types'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const euroExact = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })

export default function NetWorthChart({ points }: { points: NetWorthPoint[] }) {
  return (
    <div className="card mb-6">
      <span className="stat-label">Évolution du patrimoine</span>
      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={40} />
            <YAxis tickFormatter={(v: number) => euro.format(v)} width={90} domain={['auto', 'auto']} />
            <Tooltip
              labelFormatter={(label) => new Date(String(label)).toLocaleDateString('fr-FR')}
              formatter={(value) => [euroExact.format(Number(value)), 'Patrimoine']}
            />
            <Area type="stepAfter" dataKey="total" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
