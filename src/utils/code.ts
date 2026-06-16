/**
 * Normalize a JAV code: up to 6 letters, optional separator, 2-6 digits.
 *
 * Returns the canonical form `PREFIX-DIGITS` or `null` if the input
 * does not match the pattern.
 */
export function normalizeCode(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^([A-Za-z]{2,6})[-_\s]?(\d{2,6})$/.exec(trimmed);

  if (!match) return null;

  const prefix = match[1].toUpperCase();
  const digits = match[2];

  return prefix + "-" + digits;
}

/**
 * Best-effort: find the first substring that looks like a JAV code in
 * `text` and normalize it.  Returns the normalized code or `null` if
 * none found.
 */
export function extractCode(text: string): string | null {
  const match = text.match(/[A-Za-z]{2,6}[-_\s]?\d{2,6}/);
  if (!match) return null;

  return normalizeCode(match[0]);
}
