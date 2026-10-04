export const scoreColor = (score: number) => (score >= 95 ? '#059669' : score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626');

export const ScoreRing = ({ score, size = 96 }: { score: number; size?: number }) => {
  const stroke = Math.max(4, size / 12);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`ATS score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 600ms ease, stroke 300ms' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular-nums text-slate-900" style={{ fontSize: size * 0.3, lineHeight: 1 }}>
          {score}
        </span>
        {size >= 80 && <span className="mt-0.5 text-[11px] font-medium text-slate-400">/ 100</span>}
      </div>
    </div>
  );
};
