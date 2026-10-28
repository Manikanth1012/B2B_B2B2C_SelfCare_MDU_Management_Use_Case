/*
 * Mock persistence layer. The whole database lives in localStorage so every
 * create/update survives a browser refresh; "Reset demo data" reseeds it.
 */
import { buildSeed, SCHEMA_VERSION } from './seed';
import type { Database } from './types';

const KEY = '6d-mdu-selfcare-db';
const USER_KEY = '6d-mdu-selfcare-user';

let db: Database = load();
let version = 0;
const listeners = new Set<() => void>();

function load(): Database {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === SCHEMA_VERSION) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: fall back to a fresh seed */
  }
  return buildSeed();
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* private mode: the session still works, it just won't survive refresh */
  }
}

export function getDb(): Database {
  return db;
}

/** Apply a mutation, persist it and notify subscribers. */
export function mutate<T>(fn: (d: Database) => T): T {
  const result = fn(db);
  persist();
  version++;
  listeners.forEach((l) => l());
  return result;
}

export function nextId(prefix: string): string {
  return mutateSilently((d) => `${prefix}-${++d.seq}`);
}

function mutateSilently<T>(fn: (d: Database) => T): T {
  const r = fn(db);
  persist();
  return r;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getVersion() {
  return version;
}

export function resetDb() {
  db = buildSeed();
  persist();
  version++;
  listeners.forEach((l) => l());
}

export function getSessionUserId(): string {
  try {
    return localStorage.getItem(USER_KEY) ?? 'U-100';
  } catch {
    return 'U-100';
  }
}

export function setSessionUserId(id: string) {
  try {
    localStorage.setItem(USER_KEY, id);
  } catch {
    /* ignore */
  }
  version++;
  listeners.forEach((l) => l());
}
