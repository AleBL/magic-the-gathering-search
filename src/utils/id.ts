// The `Date.now()` ids this replaced collided inside the same millisecond: importing a
// multi-deck file collapsed to a single deck on `put`. Ordering belongs to `createdAt`,
// never to the key.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  // `randomUUID` needs a secure context and `getRandomValues` does not, so a build served
  // over plain http still mints a real v4. If neither exists the throw is deliberate:
  // silently issuing weak ids for persisted data would be worse than failing loudly.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
