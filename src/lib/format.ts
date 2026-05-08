export function formatDuration(milliseconds: number | null | undefined) {
  if (!milliseconds || Number.isNaN(milliseconds)) {
    return "0:00";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatCompactNumber(value: number | null | undefined) {
  if (!value) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRelativeDate(isoDate: string) {
  const date = new Date(isoDate);
  const diff = date.getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const minutes = Math.round(diff / (1000 * 60));
  const hours = Math.round(diff / (1000 * 60 * 60));
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  const months = Math.round(diff / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.round(diff / (1000 * 60 * 60 * 24 * 365.25));

  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  if (Math.abs(months) < 12) return formatter.format(months, "month");
  return formatter.format(years, "year");
}
