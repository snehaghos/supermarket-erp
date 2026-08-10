import { useState } from 'react'
import { AlertTriangle, ArrowRight, Beaker, Loader2 } from 'lucide-react'
import type { ConversionStep, UnitRow } from '@/lib/api'
import { conversionsApi } from '@/lib/api'

interface ConversionPreviewProps {
  activeUnits: Array<UnitRow>
}

export function ConversionPreview({ activeUnits }: ConversionPreviewProps) {
  const [unitId, setUnitId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [steps, setSteps] = useState<Array<ConversionStep>>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePreview = async () => {
    if (!unitId || quantity <= 0) return
    setLoading(true)
    setError(null)
    try {
      const result = await conversionsApi.preview(quantity, unitId)
      setSteps(result.steps)
      setShowResults(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Beaker className="w-4 h-4 text-violet-500" />
        Conversion Preview
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Starting Unit
          </label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full h-9 px-3 border border-input rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
          >
            <option value="">Select unit...</option>
            {activeUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.symbol})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Quantity
          </label>
          <input
            type="number"
            step="any"
            min="0.000001"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            className="w-full h-9 px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-colors"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handlePreview}
            disabled={loading || !unitId || quantity <= 0}
            className="flex items-center gap-2 bg-violet-600 text-white px-5 h-9 rounded-md text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50 shadow-sm w-full justify-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Beaker className="w-4 h-4" />
            )}
            Preview
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        </div>
      )}

      {showResults && (
        <div className="mt-4 pt-4 border-t border-border">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No conversion chain found for this unit.
            </p>
          ) : (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Conversion Chain
              </p>
              <div className="space-y-1.5">
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm py-1.5"
                  >
                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-semibold text-foreground">
                      {step.quantity}
                    </span>
                    <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                      {step.unitSymbol}
                    </code>
                    <span className="text-muted-foreground text-xs">
                      {step.unitName}
                    </span>
                    {i < steps.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground text-xs">
                    Final result:{' '}
                  </span>
                  <strong>{steps[steps.length - 1].quantity}</strong>{' '}
                  <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                    {steps[steps.length - 1].unitSymbol}
                  </code>{' '}
                  <span className="text-xs text-muted-foreground">
                    ({steps[steps.length - 1].unitName})
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
