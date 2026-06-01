/**
 * Local SQLite database.
 *
 * No singleton here — the db instance is managed by <SQLiteProvider> in _layout.tsx
 * and passed into every function. This lets expo-sqlite handle app lifecycle
 * (background/foreground/resume) without stale native references.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { Invader, Capture, UserRequest } from '@/features/invaders/types';

export type PendingSync = {
  id: number;
  type: 'flash' | 'unflash' | 'modify_request' | 'create_request';
  invader_id: number | null;
  capture_id: number | null;  // temp local ID (flash) or real server ID (unflash)
  user_id: number;
  created_at: string;
  payload: string | null;     // JSON for modify_request / create_request
};

// ── Init / migrations ─────────────────────────────────────────────────────────

// Called once by SQLiteProvider.onInit when the DB is first opened
export async function initDb(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('PRAGMA journal_mode = WAL');

  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  );
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS invaders (
      id          INTEGER PRIMARY KEY,
      name        TEXT    NOT NULL,
      city        TEXT,
      number      INTEGER,
      image_url   TEXT,
      description TEXT,
      points      INTEGER,
      state       TEXT,
      latitude    REAL,
      longitude   REAL,
      date_pose   TEXT,
      updated_at  TEXT
    )`
  );
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS captures (
      id         INTEGER PRIMARY KEY,
      invader_id INTEGER NOT NULL,
      user_id    INTEGER NOT NULL,
      found_at   TEXT    NOT NULL,
      is_pending INTEGER NOT NULL DEFAULT 0
    )`
  );
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS user_requests (
      id            INTEGER PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      invader_id    INTEGER,
      request_type  TEXT NOT NULL,
      status        TEXT NOT NULL,
      proposed_name TEXT,
      updated_at    TEXT
    )`
  );
  await db.runAsync(
    `CREATE TABLE IF NOT EXISTS pending_syncs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,
      invader_id  INTEGER,
      capture_id  INTEGER,
      user_id     INTEGER NOT NULL,
      created_at  TEXT    NOT NULL,
      payload     TEXT
    )`
  );

  // Migrations: add columns that were added after initial release
  const pendingSyncCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pending_syncs)');
  if (!pendingSyncCols.some((c) => c.name === 'payload')) {
    await db.runAsync('ALTER TABLE pending_syncs ADD COLUMN payload TEXT');
  }

  const captureCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(captures)');
  if (!captureCols.some((c) => c.name === 'is_pending')) {
    await db.runAsync('ALTER TABLE captures ADD COLUMN is_pending INTEGER NOT NULL DEFAULT 0');
  }
  if (!captureCols.some((c) => c.name === 'updated_at')) {
    await db.runAsync('ALTER TABLE captures ADD COLUMN updated_at TEXT');
    await db.runAsync('UPDATE captures SET updated_at = found_at WHERE updated_at IS NULL');
  }
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
    [key, value],
  );
}

// ── Invaders ──────────────────────────────────────────────────────────────────

export async function getAllInvaders(db: SQLiteDatabase): Promise<Invader[]> {
  return db.getAllAsync<Invader>('SELECT * FROM invaders');
}

export async function upsertInvaders(db: SQLiteDatabase, invaders: Invader[]): Promise<void> {
  if (invaders.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const inv of invaders) {
      await db.runAsync(
        `INSERT OR REPLACE INTO invaders
          (id, name, city, number, image_url, description, points, state,
           latitude, longitude, date_pose, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv.id, inv.name, inv.city ?? null, inv.number ?? null,
          inv.image_url ?? null, inv.description ?? null, inv.points ?? null,
          inv.state ?? null, inv.latitude, inv.longitude,
          inv.date_pose ?? null, inv.updated_at ?? null,
        ],
      );
    }
  });
}

export async function deleteInvadersByIds(db: SQLiteDatabase, ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('DELETE FROM invaders WHERE id = ?', [id]);
      await db.runAsync('DELETE FROM captures WHERE invader_id = ?', [id]);
    }
  });
}

// ── Captures ──────────────────────────────────────────────────────────────────

export async function getAllCaptures(db: SQLiteDatabase, userId: number): Promise<Capture[]> {
  return db.getAllAsync<Capture>(
    'SELECT * FROM captures WHERE user_id = ?',
    [userId],
  );
}

/**
 * Full replace — only replaces synced captures (is_pending = 0).
 * Pending captures are kept so they survive a sync cycle.
 */
export async function replaceCaptures(db: SQLiteDatabase, userId: number, captures: Capture[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM captures WHERE user_id = ? AND is_pending = 0', [userId]);
    for (const c of captures) {
      await db.runAsync(
        'INSERT INTO captures (id, invader_id, user_id, found_at, updated_at, is_pending) VALUES (?, ?, ?, ?, ?, 0)',
        [c.id, c.invader_id, c.user_id, c.found_at, c.updated_at ?? null],
      );
    }
  });
}

export async function upsertCaptures(db: SQLiteDatabase, captures: Capture[]): Promise<void> {
  if (captures.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const c of captures) {
      await db.runAsync(
        `INSERT OR REPLACE INTO captures (id, invader_id, user_id, found_at, updated_at, is_pending)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [c.id, c.invader_id, c.user_id, c.found_at, c.updated_at ?? null],
      );
    }
  });
}

export async function insertCapture(db: SQLiteDatabase, capture: Capture): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO captures (id, invader_id, user_id, found_at, is_pending) VALUES (?, ?, ?, ?, ?)',
    [capture.id, capture.invader_id, capture.user_id, capture.found_at, capture.is_pending ?? 0],
  );
}

export async function deleteCapture(db: SQLiteDatabase, progressId: number): Promise<void> {
  await db.runAsync('DELETE FROM captures WHERE id = ?', [progressId]);
}

// ── Pending syncs ─────────────────────────────────────────────────────────────

export async function getPendingSyncs(db: SQLiteDatabase, userId: number): Promise<PendingSync[]> {
  return db.getAllAsync<PendingSync>(
    'SELECT * FROM pending_syncs WHERE user_id = ? ORDER BY id ASC',
    [userId],
  );
}

export async function insertPendingSync(
  db: SQLiteDatabase,
  sync: Omit<PendingSync, 'id' | 'created_at'>,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO pending_syncs (type, invader_id, capture_id, user_id, created_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
    [sync.type, sync.invader_id ?? null, sync.capture_id ?? null, sync.user_id, new Date().toISOString(), sync.payload ?? null],
  );
}

export async function deletePendingSync(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM pending_syncs WHERE id = ?', [id]);
}

// ── User Requests ─────────────────────────────────────────────────────────────

export async function getAllRequests(db: SQLiteDatabase, userId: number): Promise<UserRequest[]> {
  return db.getAllAsync<UserRequest>(
    'SELECT * FROM user_requests WHERE user_id = ?',
    [userId],
  );
}

export async function replaceRequests(db: SQLiteDatabase, userId: number, requests: UserRequest[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM user_requests WHERE user_id = ?', [userId]);
    for (const r of requests) {
      await db.runAsync(
        `INSERT INTO user_requests
          (id, user_id, invader_id, request_type, status, proposed_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.user_id, r.invader_id ?? null,
          r.request_type, r.status, r.proposed_name ?? null,
          r.updated_at ?? null,
        ],
      );
    }
  });
}

export async function upsertRequests(db: SQLiteDatabase, requests: UserRequest[]): Promise<void> {
  if (requests.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const r of requests) {
      await db.runAsync(
        `INSERT OR REPLACE INTO user_requests
          (id, user_id, invader_id, request_type, status, proposed_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.user_id, r.invader_id ?? null,
          r.request_type, r.status, r.proposed_name ?? null,
          r.updated_at ?? null,
        ],
      );
    }
  });
}
