import type { ReactNode } from "react"

interface FormInputProps {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  hint?: string
  icon?: ReactNode
}

export function FormInput({
  label, value, onChange, placeholder, required, type, hint, icon,
}: FormInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        <input
          type={type ?? 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-9 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-colors ${icon ? 'pl-8 pr-3' : 'px-3'}`}
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}
