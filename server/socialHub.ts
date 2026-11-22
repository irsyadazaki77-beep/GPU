import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type {
  CommunityUgcTrack,
  CustomRaceTrackSpec,
  GlobalLeaderboardEntry,
  LeaderboardCategory,
  ProtagonistId,
} from '../src/game/types';
import { DEFAULT_SQLITE_DB_PATH } from './cloudSave';

const requireModule = createRequire(import.meta.url);

const SOCIAL_HUB_RATE_WINDOW_MS = 10_000;
const SOCIAL_HUB_RATE_MAX_REQUESTS = 15;
const socialHubBuckets = new Map<string, number[]>();

const VALID_CATEGORIES: LeaderboardCategory[] = [
  'etle_speed',
  'street_race',
  'heist_score',
];
const VALID_PROTAGONISTS: ProtagonistId[] = ['nabilo', 'raka', 'kirana'];

export function checkSocialHubRateLimit(
  clientKey: string = 'default',
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const key = clientKey.trim() || 'default';
  const prev = socialHubBuckets.get(key) || [];
  const active = prev.filter((ts) => nowMs - ts < SOCIAL_HUB_RATE_WINDOW_MS);

  if (active.length >= SOCIAL_HUB_RATE_MAX_REQUESTS) {
    const oldest = active[0] ?? nowMs;
    const retryAfterMs = Math.max(
      100,
      SOCIAL_HUB_RATE_WINDOW_MS - (nowMs - oldest)
    );
    socialHubBuckets.set(key, active);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  active.push(nowMs);
  socialHubBuckets.set(key, active);
  return {
    allowed: true,
    remaining: Math.max(0, SOCIAL_HUB_RATE_MAX_REQUESTS - active.length),
    retryAfterMs: 0,
  };
}

export function resetSocialHubRateLimiter(): void {
  socialHubBuckets.clear();
}

function sanitizeLabel(raw: unknown, maxLen: number, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>`{}]/g, '')
    .trim()
    .slice(0, maxLen);
  return cleaned || fallback;
}

function sanitizeId(raw: unknown, maxLen: number = 48): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned || cleaned.length > maxLen) return null;
  return cleaned;
}

export interface LeaderboardSubmitInput {
  category: LeaderboardCategory;
  targetId: string;
  targetName: string;
  playerName: string;
  protagonistId?: ProtagonistId;
  scoreValue: number;
  metricLabel: string;
}

export function validateLeaderboardSubmit(
  raw: unknown
):
  | { valid: true; data: LeaderboardSubmitInput }
  | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Payload leaderboard harus berupa objek JSON' };
  }
  const obj = raw as Record<string, unknown>;
  if (!VALID_CATEGORIES.includes(obj.category as LeaderboardCategory)) {
    return { valid: false, error: 'Kategori leaderboard tidak valid' };
  }
  const targetId = sanitizeId(obj.targetId, 48);
  if (!targetId) {
    return { valid: false, error: 'targetId tidak valid' };
  }
  if (
    typeof obj.scoreValue !== 'number' ||
    !Number.isFinite(obj.scoreValue) ||
    obj.scoreValue <= 0 ||
    obj.scoreValue > 100_000_000
  ) {
    return { valid: false, error: 'scoreValue harus angka positif yang valid' };
  }
  const protagonistId: ProtagonistId = VALID_PROTAGONISTS.includes(
    obj.protagonistId as ProtagonistId
  )
    ? (obj.protagonistId as ProtagonistId)
    : 'nabilo';

  return {
    valid: true,
    data: {
      category: obj.category as LeaderboardCategory,
      targetId,
      targetName: sanitizeLabel(obj.targetName, 64, targetId),
      playerName: sanitizeLabel(obj.playerName, 36, 'Nabilo Driver'),
      protagonistId,
      scoreValue: Math.round(obj.scoreValue * 10) / 10,
      metricLabel: sanitizeLabel(obj.metricLabel, 32, String(obj.scoreValue)),
    },
  };
}

export function validateUgcTrackPayload(
  raw: unknown
):
  | { valid: true; track: CustomRaceTrackSpec }
  | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Payload sirkuit UGC harus objek JSON' };
  }
  const obj = raw as Record<string, unknown>;
  const id = sanitizeId(obj.id, 64) || `ugc_${Date.now().toString(36)}`;
  const name = sanitizeLabel(obj.name, 48, '');
  if (name.length < 3) {
    return { valid: false, error: 'Nama sirkuit minimal 3 karakter' };
  }
  const authorName = sanitizeLabel(obj.authorName, 36, 'Pembalap Jakarta');

  if (
    !Array.isArray(obj.checkpoints) ||
    obj.checkpoints.length < 3 ||
    obj.checkpoints.length > 10
  ) {
    return { valid: false, error: 'Sirkuit wajib punya 3-10 checkpoint valid' };
  }

  const checkpoints: [number, number][] = [];
  for (const cp of obj.checkpoints) {
    if (
      !Array.isArray(cp) ||
      cp.length < 2 ||
      typeof cp[0] !== 'number' ||
      typeof cp[1] !== 'number' ||
      !Number.isFinite(cp[0]) ||
      !Number.isFinite(cp[1])
    ) {
      return { valid: false, error: 'Koordinat checkpoint tidak valid' };
    }
    const cx = Math.max(-240, Math.min(240, Math.round(cp[0] * 10) / 10));
    const cz = Math.max(-240, Math.min(240, Math.round(cp[1] * 10) / 10));
    checkpoints.push([cx, cz]);
  }

  let lengthMeters = 0;
  for (let i = 0; i < checkpoints.length; i++) {
    const a = checkpoints[i];
    const b = checkpoints[(i + 1) % checkpoints.length];
    lengthMeters += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const rewardRp =
    typeof obj.rewardRp === 'number' && Number.isFinite(obj.rewardRp)
      ? Math.max(45000, Math.min(600000, Math.round(obj.rewardRp)))
      : Math.max(45000, Math.min(350000, Math.round(lengthMeters * 350)));
  const entryFeeRp =
    typeof obj.entryFeeRp === 'number' && Number.isFinite(obj.entryFeeRp)
      ? Math.max(0, Math.min(100000, Math.round(obj.entryFeeRp)))
      : 0;

  return {
    valid: true,
    track: {
      id,
      name,
      authorName,
      checkpoints,
      isLoop: obj.isLoop !== false,
      entryFeeRp,
      rewardRp,
      createdAt:
        typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
          ? obj.createdAt
          : Date.now(),
    },
  };
}

interface SocialHubSqliteAdapter {
  getLeaderboard(category?: LeaderboardCategory, limit?: number): GlobalLeaderboardEntry[];
  upsertLeaderboard(entry: GlobalLeaderboardEntry): GlobalLeaderboardEntry;
  listUgcTracks(limit?: number): CommunityUgcTrack[];
  upsertUgcTrack(track: CustomRaceTrackSpec): CommunityUgcTrack;
  likeUgcTrack(trackId: string): CommunityUgcTrack | null;
  recordUgcPlay(trackId: string): CommunityUgcTrack | null;
  close(): void;
}

function createSocialHubSqliteAdapter(dbPath: string): SocialHubSqliteAdapter {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS global_leaderboard (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      player_name TEXT NOT NULL,
      protagonist_id TEXT NOT NULL,
      score_value REAL NOT NULL,
      metric_label TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leaderboard_cat_score
      ON global_leaderboard(category, score_value DESC);
    CREATE TABLE IF NOT EXISTS ugc_tracks (
      id TEXT PRIMARY KEY,
      track_json TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      plays INTEGER NOT NULL DEFAULT 0,
      published_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ugc_tracks_likes
      ON ugc_tracks(likes DESC, published_at DESC);
  `;

  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

  if (isBun) {
    const { Database } = requireModule('bun:sqlite') as {
      Database: new (filename: string) => {
        exec(sql: string): void;
        query(sql: string): {
          get(...params: unknown[]): unknown;
          all(...params: unknown[]): unknown[];
          run(...params: unknown[]): unknown;
        };
        close(): void;
      };
    };
    const db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec(schemaSql);

    const getByCat = db.query(
      'SELECT * FROM global_leaderboard WHERE category = ? ORDER BY score_value DESC, updated_at DESC LIMIT ?'
    );
    const getAll = db.query(
      'SELECT * FROM global_leaderboard ORDER BY score_value DESC, updated_at DESC LIMIT ?'
    );
    const getOneLb = db.query(
      'SELECT score_value FROM global_leaderboard WHERE id = ?'
    );
    const upsertLb = db.query(`
      INSERT INTO global_leaderboard (id, category, target_id, target_name, player_name, protagonist_id, score_value, metric_label, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        target_name = excluded.target_name,
        player_name = excluded.player_name,
        protagonist_id = excluded.protagonist_id,
        score_value = MAX(global_leaderboard.score_value, excluded.score_value),
        metric_label = CASE WHEN excluded.score_value >= global_leaderboard.score_value THEN excluded.metric_label ELSE global_leaderboard.metric_label END,
        updated_at = excluded.updated_at
    `);
    const listTracksStmt = db.query(
      'SELECT * FROM ugc_tracks ORDER BY likes DESC, published_at DESC LIMIT ?'
    );
    const getTrackStmt = db.query('SELECT * FROM ugc_tracks WHERE id = ?');
    const upsertTrackStmt = db.query(`
      INSERT INTO ugc_tracks (id, track_json, likes, plays, published_at)
      VALUES (?, ?, 0, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        track_json = excluded.track_json
    `);
    const likeTrackStmt = db.query(
      'UPDATE ugc_tracks SET likes = likes + 1 WHERE id = ?'
    );
    const playTrackStmt = db.query(
      'UPDATE ugc_tracks SET plays = plays + 1 WHERE id = ?'
    );

    const mapLb = (r: Record<string, unknown>): GlobalLeaderboardEntry => ({
      id: String(r.id),
      category: r.category as LeaderboardCategory,
      targetId: String(r.target_id),
      targetName: String(r.target_name),
      playerName: String(r.player_name),
      protagonistId: r.protagonist_id as ProtagonistId,
      scoreValue: Number(r.score_value),
      metricLabel: String(r.metric_label),
      updatedAt: Number(r.updated_at),
    });

    const mapTrack = (r: Record<string, unknown>): CommunityUgcTrack => ({
      id: String(r.id),
      track: JSON.parse(String(r.track_json)) as CustomRaceTrackSpec,
      likes: Number(r.likes ?? 0),
      plays: Number(r.plays ?? 0),
      publishedAt: Number(r.published_at ?? Date.now()),
    });

    return {
      getLeaderboard: (category, limit = 15) => {
        const clamped = Math.max(1, Math.min(50, limit));
        const rows = category
          ? (getByCat.all(category, clamped) as Record<string, unknown>[])
          : (getAll.all(clamped) as Record<string, unknown>[]);
        return rows.map(mapLb);
      },
      upsertLeaderboard: (entry) => {
        const existing = getOneLb.get(entry.id) as
          | { score_value?: number }
          | undefined;
        upsertLb.run(
          entry.id,
          entry.category,
          entry.targetId,
          entry.targetName,
          entry.playerName,
          entry.protagonistId,
          entry.scoreValue,
          entry.metricLabel,
          entry.updatedAt
        );
        return existing && Number(existing.score_value ?? 0) > entry.scoreValue
          ? { ...entry, scoreValue: Number(existing.score_value) }
          : entry;
      },
      listUgcTracks: (limit = 24) => {
        const clamped = Math.max(1, Math.min(50, limit));
        const rows = listTracksStmt.all(clamped) as Record<string, unknown>[];
        return rows.map(mapTrack);
      },
      upsertUgcTrack: (track) => {
        upsertTrackStmt.run(
          track.id,
          JSON.stringify(track),
          track.createdAt || Date.now()
        );
        const row = getTrackStmt.get(track.id) as Record<string, unknown>;
        return mapTrack(row);
      },
      likeUgcTrack: (trackId) => {
        likeTrackStmt.run(trackId);
        const row = getTrackStmt.get(trackId) as
          | Record<string, unknown>
          | undefined;
        return row ? mapTrack(row) : null;
      },
      recordUgcPlay: (trackId) => {
        playTrackStmt.run(trackId);
        const row = getTrackStmt.get(trackId) as
          | Record<string, unknown>
          | undefined;
        return row ? mapTrack(row) : null;
      },
      close: () => db.close(),
    };
  }

  const { DatabaseSync } = requireModule('node:sqlite') as {
    DatabaseSync: new (filename: string) => {
      exec(sql: string): void;
      prepare(sql: string): {
        get(...params: unknown[]): unknown;
        all(...params: unknown[]): unknown[];
        run(...params: unknown[]): unknown;
      };
      close(): void;
    };
  };

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(schemaSql);

  const getByCat = db.prepare(
    'SELECT * FROM global_leaderboard WHERE category = ? ORDER BY score_value DESC, updated_at DESC LIMIT ?'
  );
  const getAll = db.prepare(
    'SELECT * FROM global_leaderboard ORDER BY score_value DESC, updated_at DESC LIMIT ?'
  );
  const getOneLb = db.prepare(
    'SELECT score_value FROM global_leaderboard WHERE id = ?'
  );
  const upsertLb = db.prepare(`
    INSERT INTO global_leaderboard (id, category, target_id, target_name, player_name, protagonist_id, score_value, metric_label, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      target_name = excluded.target_name,
      player_name = excluded.player_name,
      protagonist_id = excluded.protagonist_id,
      score_value = MAX(global_leaderboard.score_value, excluded.score_value),
      metric_label = CASE WHEN excluded.score_value >= global_leaderboard.score_value THEN excluded.metric_label ELSE global_leaderboard.metric_label END,
      updated_at = excluded.updated_at
  `);
  const listTracksStmt = db.prepare(
    'SELECT * FROM ugc_tracks ORDER BY likes DESC, published_at DESC LIMIT ?'
  );
  const getTrackStmt = db.prepare('SELECT * FROM ugc_tracks WHERE id = ?');
  const upsertTrackStmt = db.prepare(`
    INSERT INTO ugc_tracks (id, track_json, likes, plays, published_at)
    VALUES (?, ?, 0, 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      track_json = excluded.track_json
  `);
  const likeTrackStmt = db.prepare(
    'UPDATE ugc_tracks SET likes = likes + 1 WHERE id = ?'
  );
  const playTrackStmt = db.prepare(
    'UPDATE ugc_tracks SET plays = plays + 1 WHERE id = ?'
  );

  const mapLb = (r: Record<string, unknown>): GlobalLeaderboardEntry => ({
    id: String(r.id),
    category: r.category as LeaderboardCategory,
    targetId: String(r.target_id),
    targetName: String(r.target_name),
    playerName: String(r.player_name),
    protagonistId: r.protagonist_id as ProtagonistId,
    scoreValue: Number(r.score_value),
    metricLabel: String(r.metric_label),
    updatedAt: Number(r.updated_at),
  });

  const mapTrack = (r: Record<string, unknown>): CommunityUgcTrack => ({
    id: String(r.id),
    track: JSON.parse(String(r.track_json)) as CustomRaceTrackSpec,
    likes: Number(r.likes ?? 0),
    plays: Number(r.plays ?? 0),
    publishedAt: Number(r.published_at ?? Date.now()),
  });

  return {
    getLeaderboard: (category, limit = 15) => {
      const clamped = Math.max(1, Math.min(50, limit));
      const rows = category
        ? (getByCat.all(category, clamped) as Record<string, unknown>[])
        : (getAll.all(clamped) as Record<string, unknown>[]);
      return rows.map(mapLb);
    },
    upsertLeaderboard: (entry) => {
      const existing = getOneLb.get(entry.id) as
        | { score_value?: number }
        | undefined;
      upsertLb.run(
        entry.id,
        entry.category,
        entry.targetId,
        entry.targetName,
        entry.playerName,
        entry.protagonistId,
        entry.scoreValue,
        entry.metricLabel,
        entry.updatedAt
      );
      return existing && Number(existing.score_value ?? 0) > entry.scoreValue
        ? { ...entry, scoreValue: Number(existing.score_value) }
        : entry;
    },
    listUgcTracks: (limit = 24) => {
      const clamped = Math.max(1, Math.min(50, limit));
      const rows = listTracksStmt.all(clamped) as Record<string, unknown>[];
      return rows.map(mapTrack);
    },
    upsertUgcTrack: (track) => {
      upsertTrackStmt.run(
        track.id,
        JSON.stringify(track),
        track.createdAt || Date.now()
      );
      const row = getTrackStmt.get(track.id) as Record<string, unknown>;
      return mapTrack(row);
    },
    likeUgcTrack: (trackId) => {
      likeTrackStmt.run(trackId);
      const row = getTrackStmt.get(trackId) as
        | Record<string, unknown>
        | undefined;
      return row ? mapTrack(row) : null;
    },
    recordUgcPlay: (trackId) => {
      playTrackStmt.run(trackId);
      const row = getTrackStmt.get(trackId) as
        | Record<string, unknown>
        | undefined;
      return row ? mapTrack(row) : null;
    },
    close: () => db.close(),
  };
}

export class SocialHubStore {
  private readonly adapter: SocialHubSqliteAdapter;

  constructor(options?: { dbPath?: string }) {
    const targetDb =
      options?.dbPath ?? process.env.SAN_NABILO_DB_PATH ?? DEFAULT_SQLITE_DB_PATH;
    this.adapter = createSocialHubSqliteAdapter(targetDb);
    this.seedDefaultsIfEmpty();
  }

  private seedDefaultsIfEmpty(): void {
    const existingLb = this.adapter.getLeaderboard(undefined, 1);
    if (existingLb.length === 0) {
      const seeds: GlobalLeaderboardEntry[] = [
        {
          id: 'seed_etle_sudirman',
          category: 'etle_speed',
          targetId: 'etle_sudirman_hi',
          targetName: 'Kamera ETLE Bundaran HI - Sudirman',
          playerName: 'Nabilo "Kilat" Monas',
          protagonistId: 'nabilo',
          scoreValue: 148,
          metricLabel: '148 km/jam',
          updatedAt: Date.now() - 86_400_000,
        },
        {
          id: 'seed_etle_jorr',
          category: 'etle_speed',
          targetId: 'etle_jorr_selatan',
          targetName: 'ETLE Tol Lingkar Luar JORR',
          playerName: 'Raka "Turbo" Kemayoran',
          protagonistId: 'raka',
          scoreValue: 184,
          metricLabel: '184 km/jam',
          updatedAt: Date.now() - 43_200_000,
        },
        {
          id: 'seed_heist_priok',
          category: 'heist_score',
          targetId: 'heist_kargo_priok',
          targetName: 'Operasi III: Pembajakan Kargo Litium Tanjung Priok',
          playerName: 'Kirana "Zero-Day"',
          protagonistId: 'kirana',
          scoreValue: 26400000,
          metricLabel: 'Rp 26.400.000',
          updatedAt: Date.now() - 21_600_000,
        },
      ];
      for (const s of seeds) {
        this.adapter.upsertLeaderboard(s);
      }
    }

    const existingTracks = this.adapter.listUgcTracks(1);
    if (existingTracks.length === 0) {
      this.adapter.upsertUgcTrack({
        id: 'ugc_seed_scbd_sprint',
        name: 'SCBD Neon Drift Circuit',
        authorName: 'Sari "V12" Kemayoran',
        checkpoints: [
          [0, -28],
          [-54, -44],
          [-58, -12],
          [-24, 18],
        ],
        isLoop: true,
        entryFeeRp: 0,
        rewardRp: 145000,
        createdAt: Date.now() - 72_000_000,
      });
    }
  }

  public getLeaderboard(
    category?: LeaderboardCategory,
    limit: number = 15
  ): GlobalLeaderboardEntry[] {
    return this.adapter.getLeaderboard(category, limit);
  }

  public submitLeaderboard(
    input: LeaderboardSubmitInput,
    playerToken: string
  ): GlobalLeaderboardEntry {
    const safeTokenHash = playerToken.slice(-12);
    const id = `lb_${input.category}_${input.targetId}_${safeTokenHash}`;
    const entry: GlobalLeaderboardEntry = {
      id,
      category: input.category,
      targetId: input.targetId,
      targetName: input.targetName,
      playerName: input.playerName,
      protagonistId: input.protagonistId ?? 'nabilo',
      scoreValue: input.scoreValue,
      metricLabel: input.metricLabel,
      updatedAt: Date.now(),
    };
    return this.adapter.upsertLeaderboard(entry);
  }

  public listUgcTracks(limit: number = 24): CommunityUgcTrack[] {
    return this.adapter.listUgcTracks(limit);
  }

  public publishUgcTrack(track: CustomRaceTrackSpec): CommunityUgcTrack {
    return this.adapter.upsertUgcTrack(track);
  }

  public likeUgcTrack(trackId: string): CommunityUgcTrack | null {
    const clean = sanitizeId(trackId, 64);
    if (!clean) return null;
    return this.adapter.likeUgcTrack(clean);
  }

  public recordUgcPlay(trackId: string): CommunityUgcTrack | null {
    const clean = sanitizeId(trackId, 64);
    if (!clean) return null;
    return this.adapter.recordUgcPlay(clean);
  }

  public close(): void {
    this.adapter.close();
  }
}

let defaultSocialHubInstance: SocialHubStore | null = null;

export function getDefaultSocialHubStore(): SocialHubStore {
  if (!defaultSocialHubInstance) {
    defaultSocialHubInstance = new SocialHubStore();
  }
  return defaultSocialHubInstance;
}

