import { getOrCreatePlayerToken } from './save';
import type {
  CommunityUgcTrack,
  CustomRaceTrackSpec,
  GlobalLeaderboardEntry,
  LeaderboardCategory,
  ProtagonistId,
} from './types';

export async function fetchGlobalLeaderboard(
  category?: LeaderboardCategory,
  limit: number = 15
): Promise<GlobalLeaderboardEntry[]> {
  if (typeof fetch !== 'function') return [];
  try {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    qs.set('limit', String(limit));
    const res = await fetch(`/api/leaderboard?${qs.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { entries?: GlobalLeaderboardEntry[] };
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

export async function submitLeaderboardRecord(params: {
  category: LeaderboardCategory;
  targetId: string;
  targetName: string;
  playerName: string;
  protagonistId: ProtagonistId;
  scoreValue: number;
  metricLabel: string;
}): Promise<GlobalLeaderboardEntry | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': getOrCreatePlayerToken(),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { entry?: GlobalLeaderboardEntry };
    return data.entry ?? null;
  } catch {
    return null;
  }
}

export async function fetchCommunityUgcTracks(
  limit: number = 24
): Promise<CommunityUgcTrack[]> {
  if (typeof fetch !== 'function') return [];
  try {
    const res = await fetch(`/api/ugc/tracks?limit=${limit}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { tracks?: CommunityUgcTrack[] };
    return Array.isArray(data.tracks) ? data.tracks : [];
  } catch {
    return [];
  }
}

export async function publishCommunityUgcTrack(
  track: CustomRaceTrackSpec
): Promise<CommunityUgcTrack | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/api/ugc/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { track?: CommunityUgcTrack };
    return data.track ?? null;
  } catch {
    return null;
  }
}

export async function likeCommunityUgcTrack(
  trackId: string
): Promise<CommunityUgcTrack | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(
      `/api/ugc/tracks/${encodeURIComponent(trackId)}/like`,
      { method: 'POST' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { track?: CommunityUgcTrack };
    return data.track ?? null;
  } catch {
    return null;
  }
}

export async function recordCommunityUgcPlay(
  trackId: string
): Promise<CommunityUgcTrack | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch(
      `/api/ugc/tracks/${encodeURIComponent(trackId)}/play`,
      { method: 'POST' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { track?: CommunityUgcTrack };
    return data.track ?? null;
  } catch {
    return null;
  }
}
