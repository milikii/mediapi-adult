export interface ParsedMagnet {
  infohash: string | null;
  displayName: string | null;
}

/**
 * Returns true iff `value` (trimmed) starts with `magnet:?`
 * (case-insensitive on the scheme portion).
 */
export function isMagnetUri(value: string): boolean {
  const trimmed = value.trim();
  return /^magnet:\?/i.test(trimmed);
}

/**
 * Parse a magnet URI.
 *
 * - infohash: from the first `xt=urn:btih:<VALUE>` param.
 *   Supports 40-char hex and 32-char base32.
 * - displayName: from the `dn` param, with + decoded as space.
 */
export function parseMagnet(value: string): ParsedMagnet {
  if (!isMagnetUri(value)) {
    return { infohash: null, displayName: null };
  }

  const trimmed = value.trim();
  const qIndex = trimmed.indexOf("?");
  const query = qIndex >= 0 ? trimmed.slice(qIndex + 1) : "";
  const params = new URLSearchParams(query);

  // displayName
  const dnRaw = params.get("dn");
  const displayName =
    dnRaw != null && dnRaw.trim().length > 0 ? dnRaw.trim() : null;

  // infohash: look through xt params for the first valid btih
  const xtValues = params.getAll("xt");
  let infohash: string | null = null;

  for (const xt of xtValues) {
    const match = /^urn:btih:(.+)$/i.exec(xt);
    if (!match) continue; // not a btih xt, skip

    const value = match[1];

    // 40-char hex
    if (/^[0-9a-fA-F]{40}$/.test(value)) {
      infohash = value.toLowerCase();
      break;
    }

    // 32-char base32 (uppercase A-Z, digits 2-7)
    if (/^[A-Z2-7]{32}$/i.test(value)) {
      infohash = value.toUpperCase();
      break;
    }

    // Valid btih prefix but value doesn't match either format → null
    // (per spec: else infohash = null — leave as null, continue to next xt)
    // Actually the spec says "else infohash = null" for that particular xt.
    // If we encounter a btih-prefixed xt with invalid value, we should
    // set infohash = null and continue looking for a valid one.
    // But we also need to handle the case where a later xt is valid.
    // The spec says: "if there are multiple xt values, use the first
    // that yields a valid btih; ignore non-btih xt". So we only set
    // infohash when we find a valid one.
  }

  return { infohash, displayName };
}
