import { encode, decode } from "./crypto";

/**
 * Typed localStorage wrapper. All values are obfuscated via `crypto.ts`.
 * Falls back to an in-memory Map when localStorage is unavailable (SSR / private mode).
 */

const memory = new Map<string, string>();

const storage: Storage | null =
  typeof window !== "undefined" && window.localStorage ? window.localStorage : null;

function setRaw(key: string, value: string) {
  if (storage) storage.setItem(key, value);
  else memory.set(key, value);
}

function getRaw(key: string): string | null {
  if (storage) return storage.getItem(key);
  return memory.get(key) ?? null;
}

export const localStore = {
  get<T>(key: string): T | null {
    return decode<T>(getRaw(key));
  },
  set<T>(key: string, value: T): void {
    setRaw(key, encode(value));
  },
  remove(key: string): void {
    if (storage) storage.removeItem(key);
    else memory.delete(key);
  },
};
