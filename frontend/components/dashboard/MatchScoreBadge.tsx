"use client";

interface MatchScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

export default function MatchScoreBadge({ score, size = "md" }: MatchScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        —
      </span>
    );
  }

  const percentage = Math.round(score * 100);
  const colorClass =
    percentage >= 80
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : percentage >= 60
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-gray-500/20 text-gray-400 border-gray-500/30";

  const sizeClass =
    size === "sm"
      ? "text-xs px-1.5 py-0.5"
      : size === "lg"
        ? "text-sm px-3 py-1"
        : "text-xs px-2 py-0.5";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium border ${colorClass} ${sizeClass}`}>
      {percentage}%
    </span>
  );
}