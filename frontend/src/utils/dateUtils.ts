import { format, parseISO, isValid } from "date-fns";

// ── Platform-wide date format standard ──────────────────────────────────────
// Storage / API:  ISO 8601  →  "2024-01-15T14:30:00"  /  "2024-01-15"
// Display (date): "Jan 15, 2024"
// Display (dt):   "Jan 15, 2024  14:30"
// Display (full): "Jan 15, 2024  14:30:05"

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

/** "Jan 15, 2024" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parse(value);
  return d ? format(d, "MMM dd, yyyy") : "—";
}

/** "Jan 15, 2024  14:30" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parse(value);
  return d ? format(d, "MMM dd, yyyy  HH:mm") : "—";
}

/** "Jan 15, 2024  14:30:05" */
export function formatDateTimeSec(value: string | Date | null | undefined): string {
  const d = parse(value);
  return d ? format(d, "MMM dd, yyyy  HH:mm:ss") : "—";
}

/** "yyyy-MM-dd" — for <input type="date" /> value prop */
export function toInputDate(value: string | Date | null | undefined): string {
  const d = parse(value);
  return d ? format(d, "yyyy-MM-dd") : "";
}

/** "14:30" — for chat / message timestamps */
export function formatTime(value: Date | string | null | undefined): string {
  const d = parse(value);
  return d ? format(d, "HH:mm") : "—";
}
