/**
 * Extremely lightweight obfuscation layer for locally-stored user data.
 * NOTE: this is NOT real cryptography — browser JS cannot keep a key secret
 * from the user. It only prevents casual inspection of localStorage values.
 * The interface is intentionally symmetric so it can be swapped for
 * WebCrypto AES-GCM when a real key-management story exists (e.g. a backend).
 */

const PREFIX = "enc:v1:";

export function encode(value: unknown): string {
  const json = JSON.stringify(value);
  // btoa handles unicode via encodeURIComponent trick.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return PREFIX + b64;
}

export function decode<T = unknown>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    if (!raw.startsWith(PREFIX)) return JSON.parse(raw) as T;
    const b64 = raw.slice(PREFIX.length);
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
