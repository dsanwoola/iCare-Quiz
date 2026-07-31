interface CountdownRingProps {
  total: number;
  remaining: number;
  size?: number;
  stroke?: number;
  className?: string;
}

/** Animated circular countdown. Uses currentColor for the ring + number,
 *  so the parent controls the colour (e.g. text-yellow-300). */
export default function CountdownRing({ total, remaining, size = 190, stroke = 9, className = "" }: CountdownRingProps) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const secs = Math.max(0, Math.ceil(remaining - 0.001));
  const urgent = remaining <= 3;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="opacity-15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.15s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-black tabular-nums ${urgent ? "animate-pulse" : ""}`} style={{ fontSize: size * 0.4 }}>
          {secs}
        </span>
      </div>
    </div>
  );
}
