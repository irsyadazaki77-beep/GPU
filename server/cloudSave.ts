import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { OriginArchetype, WeatherMode } from '../src/game/types';
import { migrateSavedGame, type SavedGameSnapshot } from '../src/game/save';

const requireModule = createRequire(import.meta.url);

export const DEFAULT_DATA_DIR = path.resolve(process.cwd(), '.data');
export const DEFAULT_SQLITE_DB_PATH = path.join(
  DEFAULT_DATA_DIR,
  'san_nabilo.db'
);
export const LEGACY_CLOUD_SAVE_JSON_PATH = path.join(
  DEFAULT_DATA_DIR,
  'cloud_saves_v3.json'
);
export const LEGACY_MIGRATION_PLAYER_TOKEN = 'legacy_local_player_v3';

export const SLOT_ID_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;
export const PLAYER_TOKEN_REGEX = /^[a-zA-Z0-9_-]{8,128}$/;

const VALID_ORIGINS: OriginArchetype[] = [
  'anak_jalanan',
  'mantan_kurir',
  'teknisi_glodok',
];

const VALID_WEATHERS: WeatherMode[] = ['senja', 'malam', 'siang', 'hujan'];

const MAX_STRING_ARRAY_ITEMS = 64;
const MAX_QUEST_ARRAY_ITEMS = 128;
const MAX_ITEM_STRING_LENGTH = 64;

export interface SqliteRow {
  slot_id: string;
  player_token: string;
  schema_version: number;
  payload_json: string;
  updated_at: string;
}

export interface SqliteAdapter {
  exec(sql: string): void;
  getSave(playerToken: string, slotId: string): SqliteRow | null;
  upsertSave(row: SqliteRow): void;
  countSavesForToken(playerToken: string): number;
  ping(): boolean;
  close(): void;
}

function createSqliteAdapter(dbPath: string): SqliteAdapter {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Runtime adapter supporting Node 22+ built-in `node:sqlite` and `bun:sqlite`
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

  if (isBun) {
    const { Database } = requireModule('bun:sqlite') as {
      Database: new (filename: string) => {
        exec(sql: string): void;
        query(sql: string): {
          get(...params: unknown[]): unknown;
          run(...params: unknown[]): unknown;
        };
        close(): void;
      };
    };
    const db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS cloud_saves (
        slot_id TEXT NOT NULL,
        player_token TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (player_token, slot_id)
      );
    `);

    const getStmt = db.query(
      'SELECT slot_id, player_token, schema_version, payload_json, updated_at FROM cloud_saves WHERE player_token = ? AND slot_id = ?'
    );
    const upsertStmt = db.query(`
      INSERT INTO cloud_saves (slot_id, player_token, schema_version, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(player_token, slot_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);
    const countStmt = db.query(
      'SELECT COUNT(*) as cnt FROM cloud_saves WHERE player_token = ?'
    );
    const pingStmt = db.query('SELECT 1 as ok');

    return {
      exec: (sql: string) => db.exec(sql),
      getSave: (playerToken: string, slotId: string) => {
        const row = getStmt.get(playerToken, slotId) as SqliteRow | undefined;
        return row ?? null;
      },
      upsertSave: (row: SqliteRow) => {
        upsertStmt.run(
          row.slot_id,
          row.player_token,
          row.schema_version,
          row.payload_json,
          row.updated_at
        );
      },
      countSavesForToken: (playerToken: string) => {
        const res = countStmt.get(playerToken) as { cnt?: number } | undefined;
        return Number(res?.cnt ?? 0);
      },
      ping: () => {
        const res = pingStmt.get() as { ok?: number } | undefined;
        return res?.ok === 1;
      },
      close: () => db.close(),
    };
  }

  // Node 22+ built-in `node:sqlite`
  const { DatabaseSync } = requireModule('node:sqlite') as {
    DatabaseSync: new (filename: string) => {
      exec(sql: string): void;
      prepare(sql: string): {
        get(...params: unknown[]): unknown;
        run(...params: unknown[]): unknown;
      };
      close(): void;
    };
  };

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_saves (
      slot_id TEXT NOT NULL,
      player_token TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (player_token, slot_id)
    );
  `);

  const getStmt = db.prepare(
    'SELECT slot_id, player_token, schema_version, payload_json, updated_at FROM cloud_saves WHERE player_token = ? AND slot_id = ?'
  );
  const upsertStmt = db.prepare(`
    INSERT INTO cloud_saves (slot_id, player_token, schema_version, payload_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(player_token, slot_id) DO UPDATE SET
      schema_version = excluded.schema_version,
      payload_json = excluded.payload_json,
      updated_at = excluded.updated_at
  `);
  const countStmt = db.prepare(
    'SELECT COUNT(*) as cnt FROM cloud_saves WHERE player_token = ?'
  );
  const pingStmt = db.prepare('SELECT 1 as ok');

  return {
    exec: (sql: string) => db.exec(sql),
    getSave: (playerToken: string, slotId: string) => {
      const row = getStmt.get(playerToken, slotId) as SqliteRow | undefined;
      return row ?? null;
    },
    upsertSave: (row: SqliteRow) => {
      upsertStmt.run(
        row.slot_id,
        row.player_token,
        row.schema_version,
        row.payload_json,
        row.updated_at
      );
    },
    countSavesForToken: (playerToken: string) => {
      const res = countStmt.get(playerToken) as { cnt?: number } | undefined;
      return Number(res?.cnt ?? 0);
    },
    ping: () => {
      const res = pingStmt.get() as { ok?: number } | undefined;
      return res?.ok === 1;
    },
    close: () => db.close(),
  };
}

function isBoundedStringArray(
  arr: unknown,
  maxItems: number,
  maxStrLen: number = MAX_ITEM_STRING_LENGTH
): arr is string[] {
  if (!Array.isArray(arr) || arr.length > maxItems) return false;
  return arr.every(
    (item) =>
      typeof item === 'string' &&
      item.length > 0 &&
      item.length <= maxStrLen
  );
}

export function parseSlotIdParam(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    const str = String(raw);
    return SLOT_ID_REGEX.test(str) ? str : null;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!SLOT_ID_REGEX.test(trimmed)) return null;
  return trimmed;
}

export function validatePlayerToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!PLAYER_TOKEN_REGEX.test(trimmed)) return null;
  return trimmed;
}

export type SaveValidationResult =
  | { valid: true; snapshot: SavedGameSnapshot }
  | { valid: false; error: string };

/**
 * Strictly validates a Save Schema v3 payload before persisting to SQLite.
 */
export function validateStrictSaveSchemaV3(
  rawPayload: unknown
): SaveValidationResult {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { valid: false, error: 'Save payload must be a JSON object' };
  }

  const candidate = rawPayload as Record<string, unknown>;
  if (candidate.version !== 3) {
    return {
      valid: false,
      error: 'Invalid Save Schema version (expected version === 3)',
    };
  }

  if (!VALID_ORIGINS.includes(candidate.origin as OriginArchetype)) {
    return { valid: false, error: 'Invalid or missing origin archetype' };
  }

  const stage = candidate.selectedStage;
  if (
    stage !== 1 &&
    stage !== 2 &&
    stage !== 3 &&
    stage !== 4 &&
    stage !== 5
  ) {
    return {
      valid: false,
      error: 'Invalid selectedStage (must be integer 1..5)',
    };
  }

  if (!VALID_WEATHERS.includes(candidate.weatherMode as WeatherMode)) {
    return { valid: false, error: 'Invalid weatherMode' };
  }

  if (
    !candidate.playerPos ||
    typeof candidate.playerPos !== 'object' ||
    Array.isArray(candidate.playerPos)
  ) {
    return { valid: false, error: 'Missing or invalid playerPos coordinates' };
  }
  const pos = candidate.playerPos as Record<string, unknown>;
  if (
    typeof pos.x !== 'number' ||
    !Number.isFinite(pos.x) ||
    typeof pos.z !== 'number' ||
    !Number.isFinite(pos.z)
  ) {
    return {
      valid: false,
      error: 'playerPos.x and playerPos.z must be finite numbers',
    };
  }

  if (
    !candidate.playerState ||
    typeof candidate.playerState !== 'object' ||
    Array.isArray(candidate.playerState)
  ) {
    return { valid: false, error: 'Missing or invalid playerState object' };
  }

  const ps = candidate.playerState as Record<string, unknown>;
  if (
    typeof ps.hp !== 'number' ||
    !Number.isFinite(ps.hp) ||
    typeof ps.rupiah !== 'number' ||
    !Number.isFinite(ps.rupiah)
  ) {
    return {
      valid: false,
      error: 'playerState.hp and playerState.rupiah must be finite numbers',
    };
  }

  const boundedArrayFields = [
    'completedMissions',
    'unlockedWeapons',
    'ownedProperties',
    'completedHeistSetups',
    'completedHeists',
    'collectedPackages',
  ] as const;

  for (const field of boundedArrayFields) {
    if (
      ps[field] !== undefined &&
      !isBoundedStringArray(ps[field], MAX_STRING_ARRAY_ITEMS)
    ) {
      return {
        valid: false,
        error: `playerState.${field} must be a bounded string array (max ${MAX_STRING_ARRAY_ITEMS} items)`,
      };
    }
  }

  if (
    ps.lastSnackEaten !== undefined &&
    ps.lastSnackEaten !== null &&
    (typeof ps.lastSnackEaten !== 'string' ||
      ps.lastSnackEaten.length > MAX_ITEM_STRING_LENGTH)
  ) {
    return { valid: false, error: 'Invalid playerState.lastSnackEaten value' };
  }

  if (
    candidate.completedDynamicQuests !== undefined &&
    !isBoundedStringArray(
      candidate.completedDynamicQuests,
      MAX_QUEST_ARRAY_ITEMS
    )
  ) {
    return {
      valid: false,
      error: `completedDynamicQuests must be a bounded string array (max ${MAX_QUEST_ARRAY_ITEMS} items)`,
    };
  }

  const migrated = migrateSavedGame(rawPayload);
  if (!migrated) {
    return { valid: false, error: 'Failed to normalize Save Schema v3 payload' };
  }

  const stamped: SavedGameSnapshot = {
    ...migrated,
    version: 3,
    savedAt: Date.now(),
  };

  return { valid: true, snapshot: stamped };
}

export class CloudSaveStore {
  private readonly adapter: SqliteAdapter;
  private readonly legacyJsonPath: string | null;
  private legacyMigrated = false;

  constructor(options?: {
    dbPath?: string;
    legacyJsonPath?: string | null;
  }) {
    const dbPath = options?.dbPath ?? DEFAULT_SQLITE_DB_PATH;
    this.legacyJsonPath =
      options?.legacyJsonPath === undefined
        ? LEGACY_CLOUD_SAVE_JSON_PATH
        : options.legacyJsonPath;
    this.adapter = createSqliteAdapter(dbPath);
    this.migrateLegacyJsonIfPresent();
  }

  /**
   * One-time automatic migration helper if legacy `.data/cloud_saves_v3.json` exists locally on startup.
   */
  public migrateLegacyJsonIfPresent(
    targetPlayerToken: string = LEGACY_MIGRATION_PLAYER_TOKEN
  ): number {
    if (this.legacyMigrated) return 0;
    this.legacyMigrated = true;

    if (!this.legacyJsonPath || !fs.existsSync(this.legacyJsonPath)) {
      return 0;
    }

    let migratedCount = 0;
    try {
      const existingCount = this.adapter.countSavesForToken(targetPlayerToken);
      if (existingCount > 0) {
        return 0;
      }

      const raw = fs.readFileSync(this.legacyJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [rawSlotKey, rawCandidate] of Object.entries(parsed)) {
        const slotId = parseSlotIdParam(rawSlotKey);
        if (!slotId || !rawCandidate) continue;
        const migrated = migrateSavedGame(rawCandidate);
        if (!migrated) continue;
        const stamped: SavedGameSnapshot = {
          ...migrated,
          version: 3,
          savedAt: migrated.savedAt || Date.now(),
        };
        this.adapter.upsertSave({
          slot_id: slotId,
          player_token: targetPlayerToken,
          schema_version: 3,
          payload_json: JSON.stringify(stamped),
          updated_at: new Date(stamped.savedAt).toISOString(),
        });
        migratedCount++;
      }
    } catch {
      // Ignore malformed legacy file
    }
    return migratedCount;
  }

  public getSlot(
    slotId: string | number,
    playerToken: string = LEGACY_MIGRATION_PLAYER_TOKEN
  ): SavedGameSnapshot | null {
    const cleanSlot = parseSlotIdParam(slotId);
    const cleanToken = validatePlayerToken(playerToken);
    if (!cleanSlot || !cleanToken) return null;

    const row = this.adapter.getSave(cleanToken, cleanSlot);
    if (!row) return null;

    try {
      const parsed = JSON.parse(row.payload_json);
      return migrateSavedGame(parsed);
    } catch {
      return null;
    }
  }

  public putSlot(
    slotId: string | number,
    rawPayload: unknown,
    playerToken: string = LEGACY_MIGRATION_PLAYER_TOKEN
  ): SavedGameSnapshot | null {
    const cleanSlot = parseSlotIdParam(slotId);
    const cleanToken = validatePlayerToken(playerToken);
    if (!cleanSlot || !cleanToken) return null;

    const validation = validateStrictSaveSchemaV3(rawPayload);
    if (!validation.valid) return null;

    const stamped = validation.snapshot;
    this.adapter.upsertSave({
      slot_id: cleanSlot,
      player_token: cleanToken,
      schema_version: 3,
      payload_json: JSON.stringify(stamped),
      updated_at: new Date(stamped.savedAt).toISOString(),
    });

    return stamped;
  }

  public isReady(): boolean {
    try {
      return this.adapter.ping();
    } catch {
      return false;
    }
  }

  public close(): void {
    try {
      this.adapter.close();
    } catch {
      // Ignore close errors
    }
  }
}

let defaultStoreInstance: CloudSaveStore | null = null;

export function getDefaultCloudSaveStore(): CloudSaveStore {
  if (!defaultStoreInstance) {
    defaultStoreInstance = new CloudSaveStore();
  }
  return defaultStoreInstance;
}

export function getCloudSaveSlot(
  slotId: string | number,
  playerToken: string = LEGACY_MIGRATION_PLAYER_TOKEN
): SavedGameSnapshot | null {
  return getDefaultCloudSaveStore().getSlot(slotId, playerToken);
}

export function putCloudSaveSlot(
  slotId: string | number,
  rawPayload: unknown,
  playerToken: string = LEGACY_MIGRATION_PLAYER_TOKEN
): SavedGameSnapshot | null {
  return getDefaultCloudSaveStore().putSlot(slotId, rawPayload, playerToken);
}

export function checkCloudSaveDbReady(): boolean {
  return getDefaultCloudSaveStore().isReady();
}
