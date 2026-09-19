interface LinkStrengthSliderProps {
  value: number
  max: number
  visibleEdgeCount: number
  onChange: (value: number) => void
}

export function LinkStrengthSlider({
  value,
  max,
  visibleEdgeCount,
  onChange,
}: LinkStrengthSliderProps) {
  return (
    <label className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
      <span className="shrink-0">Minimum link strength</span>
      <input
        type="range"
        min={1}
        max={Math.max(1, max)}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-40 accent-purple-600"
      />
      <span className="w-6 shrink-0 tabular-nums text-slate-900">{value}</span>
      <span className="shrink-0 text-slate-500">
        {visibleEdgeCount.toLocaleString()} edge{visibleEdgeCount === 1 ? '' : 's'} shown
      </span>
    </label>
  )
}
