// entry_date is a calendar date with no time zone; format it as-is (UTC) so it
// never shifts a day for users west of Greenwich.
export function formatEntryDate(isoDate: string, style: "long" | "short" = "long"): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    ...(style === "long" ? { weekday: "long" } : {}),
  });
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
