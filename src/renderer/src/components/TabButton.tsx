type Props = {
  label: string
  active: boolean
  onClick: () => void
}

export function TabButton({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 text-sm font-medium ${
        active
          ? 'bg-emerald-500 text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {label}
    </button>
  )
}
