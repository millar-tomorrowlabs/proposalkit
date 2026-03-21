interface BuilderFieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

const BuilderField = ({ label, hint, children }: BuilderFieldProps) => (
  <div className="space-y-1.5">
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </div>
)

export default BuilderField
