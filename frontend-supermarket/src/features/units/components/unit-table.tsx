import { Edit2, Trash2, Loader2 } from "lucide-react"
import type { UnitRow } from "@/lib/api"

const typeMeta: Record<string, { color: string; label: string }> = {
  Count:      { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Cnt' },
  Weight:    { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Wt' },
  Volume:    { color: 'bg-cyan-100 text-cyan-700 border-cyan-200', label: 'Vol' },
  Length:    { color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Len' },
  Area:      { color: 'bg-green-100 text-green-700 border-green-200', label: 'Area' },
  Packaging: { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Pkg' },
}

interface UnitTableProps {
  units: UnitRow[]
  loading: boolean
  search: string
  deletingId: string | null
  onEdit: (unit: UnitRow) => void
  onDelete: (id: string) => void
}

export function UnitTable({ units, loading, search, deletingId, onEdit, onDelete }: UnitTableProps) {
  const filtered = units.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.symbol.toLowerCase().includes(search.toLowerCase()) ||
    u.type.toLowerCase().includes(search.toLowerCase())
  )

  if (loading && !units.length) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-xl">
        <p className="text-sm text-muted-foreground">{search ? 'No matching units' : 'No units found. Add one to get started.'}</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(unit => (
            <tr key={unit.id}>
              <td className="font-medium text-foreground">{unit.name}</td>
              <td><code className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">{unit.symbol}</code></td>
              <td>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${typeMeta[unit.type]?.color ?? 'bg-muted text-muted-foreground'}`}>
                  {typeMeta[unit.type]?.label ?? unit.type}
                </span>
              </td>
              <td>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${unit.status === 'active' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${unit.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {unit.status}
                </span>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(unit)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600 transition-colors" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(unit.id)}
                    disabled={deletingId === unit.id}
                    className="p-1.5 rounded-md hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === unit.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
