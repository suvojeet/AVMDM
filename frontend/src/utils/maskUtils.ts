/**
 * Masks an identifier value, showing only the last 4 characters.
 * Strips hyphens and spaces before applying the mask.
 * e.g. "123-45-6789" → "••••6789",  "02121414" → "••••1414"
 */
export function maskId(value: string | undefined | null): string {
  if (!value) return "";
  const stripped = value.replace(/[-\s]/g, "");
  if (stripped.length <= 4) return stripped;
  return "••••" + stripped.slice(-4);
}
