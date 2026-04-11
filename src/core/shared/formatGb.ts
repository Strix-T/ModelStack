/** Human-readable GB for UI/export (avoids long float noise from arithmetic). */
export function formatGbForDisplay(value: number, fractionDigits = 2): string {
  return value.toFixed(fractionDigits);
}
