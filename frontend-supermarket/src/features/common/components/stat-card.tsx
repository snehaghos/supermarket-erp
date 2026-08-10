export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  bg,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} border border-border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  )
}

export function DetailMeta({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-2.5">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p
        className={`text-xs font-medium text-foreground ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}
