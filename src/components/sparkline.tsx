export function Sparkline({
  values,
  width = 88,
  height = 26,
  dashed = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  dashed?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const;
  });
  const last = points.at(-1)!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={dashed ? "var(--color-fog)" : "var(--color-charcoal)"}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "3 3" : undefined}
      />
      {!dashed && <circle cx={last[0]} cy={last[1]} r={2.2} fill="var(--color-charcoal)" />}
    </svg>
  );
}
