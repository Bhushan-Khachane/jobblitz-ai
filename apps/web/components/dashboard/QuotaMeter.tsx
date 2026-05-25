"use client";

interface QuotaMeterProps {
  used: number;
  limit: number;
  size?: number;
}

export default function QuotaMeter({ used, limit, size = 80 }: QuotaMeterProps) {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  const color =
    percentage >= 100
      ? "stroke-destructive"
      : percentage >= 80
        ? "stroke-amber-500"
        : "stroke-primary-500";

  const textColor =
    percentage >= 100
      ? "text-destructive"
      : percentage >= 80
        ? "text-amber-500"
        : "text-foreground";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-sm font-semibold ${textColor}`}>{used}</span>
        <span className="text-xs text-muted-foreground">/ {limit}</span>
      </div>
    </div>
  );
}