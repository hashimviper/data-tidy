interface QualityRingProps {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export function QualityRing({ score, size = 64, stroke = 6, label }: QualityRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = c - (pct / 100) * c;
  const color = pct >= 85 ? 'hsl(var(--success))' : pct >= 65 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums">{Math.round(pct)}</span>
        {label && <span className="text-[9px] uppercase text-muted-foreground tracking-wider">{label}</span>}
      </div>
    </div>
  );
}
