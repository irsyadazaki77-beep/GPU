import fs from 'node:fs';
import path from 'node:path';
import type { SaveSlotId } from '../src/game/types';
import { migrateSavedGame, type SavedGameSnapshot } from '../src/game/save';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CLOUD_SAVE_FILE = path.join(DATA_DIR, 'cloud_saves_v3.json');

const memorySlots = new Map<SaveSlotId, SavedGameSnapshot>();
let diskLoaded = false;

function ensureLoadedFromDisk(): void {
  if (diskLoaded) return;
  diskLoaded = true;
  try {
    if (fs.existsSync(CLOUD_SAVE_FILE)) {
      const raw = fs.readFileSync(CLOUD_SAVE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const slot of [1, 2, 3] as SaveSlotId[]) {
        const candidate = parsed[String(slot)];
        if (candidate) {
          const valid = migrateSavedGame(candidate);
          if (valid) {
            memorySlots.set(slot, valid);
          }
        }
      }
    }
  } catch {
    // Ignore disk read errors; keep in-memory store active
  }
}

function flushToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized: Record<string, SavedGameSnapshot> = {};
    for (const [slot, snap] of memorySlots.entries()) {
      serialized[String(slot)] = snap;
    }
    fs.writeFileSync(
      CLOUD_SAVE_FILE,
      JSON.stringify(serialized, null, 2),
      'utf-8'
    );
  } catch {
    // Ignore read-only filesystem errors in ephemeral containers
  }
}

export function parseSlotIdParam(raw: string | undefined): SaveSlotId | null {
  if (raw === '1') return 1;
  if (raw === '2') return 2;
  if (raw === '3') return 3;
  return null;
}

export function getCloudSaveSlot(slotId: SaveSlotId): SavedGameSnapshot | null {
  ensureLoadedFromDisk();
  return memorySlots.get(slotId) ?? null;
}

export function putCloudSaveSlot(
  slotId: SaveSlotId,
  rawPayload: unknown
): SavedGameSnapshot | null {
  ensureLoadedFromDisk();
  const migrated = migrateSavedGame(rawPayload);
  if (!migrated) return null;
  const stamped: SavedGameSnapshot = {
    ...migrated,
    version: 3,
    savedAt: Date.now(),
  };
  memorySlots.set(slotId, stamped);
  flushToDisk();
  return stamped;
}
