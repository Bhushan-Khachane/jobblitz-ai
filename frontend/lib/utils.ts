import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// ── Tailwind class merge ────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ── Relative date formatting (no date-fns) ──────────────────────────────────

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}

// ── Indian currency formatting ──────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Platform colors ─────────────────────────────────────────────────────────

export function getPlatformColor(platform: string): string {
  const map: Record<string, string> = {
    linkedin: "bg-blue-100 text-blue-700",
    naukri: "bg-yellow-100 text-yellow-700",
    indeed: "bg-green-100 text-green-700",
  };
  return map[platform.toLowerCase()] ?? "bg-gray-100 text-gray-700";
}

export function getPlatformBadgeColor(platform: string): string {
  const map: Record<string, string> = {
    linkedin: "bg-blue-100 text-blue-700 border-blue-300",
    naukri: "bg-yellow-100 text-yellow-700 border-yellow-300",
    indeed: "bg-green-100 text-green-700 border-green-300",
  };
  return map[platform.toLowerCase()] ?? "bg-gray-100 text-gray-700 border-gray-300";
}

// ── Application status colors ───────────────────────────────────────────────

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    submitted: "bg-blue-100 text-blue-700",
    applied: "bg-blue-100 text-blue-700",
    interview: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    failed: "bg-red-100 text-red-700",
  };
  return map[status.toLowerCase()] ?? "bg-gray-100 text-gray-700";
}

// ── Truncation ──────────────────────────────────────────────────────────────

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

// ── LPA formatting ──────────────────────────────────────────────────────────

export function formatLPA(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `₹${amount.toLocaleString("en-IN")} LPA`;
}
