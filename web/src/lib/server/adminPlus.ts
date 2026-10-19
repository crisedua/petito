import { fail } from "./http";

export type PlusDuration = "month" | "year" | "lifetime" | "until";

/** 23:59:59 in Chile (America/Santiago, UTC-3 or UTC-4 depending on the date) on a YYYY-MM-DD day. */
export function endOfDayChile(ymd: string): string {
  const hour = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", hour12: false }).format(d);
  for (const off of ["-03:00", "-04:00"]) {
    const d = new Date(`${ymd}T23:59:59${off}`);
    if (hour(d) === "23") return d.toISOString();
  }
  return new Date(`${ymd}T23:59:59-03:00`).toISOString();
}

/**
 * When an admin Plus grant ends: an ISO timestamp, or `null` for no end date.
 * "until" ends at the close of the chosen day in Chile.
 */
export function plusUntil(duration: PlusDuration | undefined, until?: string | null): string | null {
  const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
  switch (duration) {
    case "month": return inDays(31);
    case "year": return inDays(366);
    case "until": {
      const ymd = String(until ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw fail(400, "Elige una fecha");
      const end = endOfDayChile(ymd);
      if (Date.parse(end) <= Date.now()) throw fail(400, "Elige una fecha futura");
      return end;
    }
    case "lifetime":
    case undefined:
      return null;
    default:
      throw fail(400, "Duración no válida");
  }
}
