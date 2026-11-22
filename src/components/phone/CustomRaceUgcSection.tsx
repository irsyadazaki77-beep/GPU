import React, { useEffect, useState } from 'react';
import {
  CustomRaceTrackSpec,
  createCustomRaceTrackSpec,
  exportCustomRaceTrackJson,
  formatRupiah,
  importCustomRaceTrackJson,
} from '../../game/rules';
import { engineTelemetryRef, gameStore, useGameStore } from '../../state/gameStore';

interface CustomRaceUgcSectionProps {
  protagonistName: string;
  onStartCustomRace: (track: CustomRaceTrackSpec) => void;
  onShareCustomRace?: (track: CustomRaceTrackSpec) => boolean;
  onClosePhone: () => void;
}

export const CustomRaceUgcSection: React.FC<CustomRaceUgcSectionProps> = ({
  protagonistName,
  onStartCustomRace,
  onShareCustomRace,
  onClosePhone,
}) => {
  const savedTracks = useGameStore((s) => s.playerState.customRaceTracks || []);
  const sharedCoopRaces = useGameStore((s) => s.sharedCoopRaces);
  const communityTracks = useGameStore((s) => s.communityUgcTracks);
  const socialHubLoading = useGameStore((s) => s.socialHubLoading);
  const [showBuilder, setShowBuilder] = useState(false);
  const [trackName, setTrackName] = useState('Sirkuit Malam Sudirman');
  const [checkpoints, setCheckpoints] = useState<[number, number][]>([
    [0, -28],
    [32, -32],
    [32, 32],
    [-32, 32],
  ]);
  const [jsonInput, setJsonInput] = useState('');
  const [ugcMessage, setUgcMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && communityTracks.length === 0) {
      void gameStore.refreshCommunityUgcTracks();
    }
    // Load initial community catalog once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddPlayerPosCheckpoint = () => {
    const px = Math.round(engineTelemetryRef.playerX * 10) / 10;
    const pz = Math.round(engineTelemetryRef.playerZ * 10) / 10;
    if (checkpoints.length >= 10) {
      setUgcMessage('Maksimal 10 checkpoint per sirkuit.');
      return;
    }
    setCheckpoints((prev) => [...prev, [px, pz]]);
    setUgcMessage(`Checkpoint (${px}, ${pz}) ditambahkan.`);
  };

  const handleCreateTrack = () => {
    const res = createCustomRaceTrackSpec({
      name: trackName,
      authorName: protagonistName,
      checkpoints,
      isLoop: true,
    });
    if (!res.track) {
      setUgcMessage(res.error || 'Sirkuit belum valid.');
      return;
    }
    gameStore.addCustomRaceTrack(res.track);
    setUgcMessage(`Sirkuit "${res.track.name}" tersimpan!`);
    setShowBuilder(false);
  };

  const handleImportJson = () => {
    const res = importCustomRaceTrackJson(jsonInput);
    if (!res.track) {
      setUgcMessage(res.error || 'JSON tidak valid.');
      return;
    }
    gameStore.addCustomRaceTrack(res.track);
    setJsonInput('');
    setUgcMessage(`Impor sukses: ${res.track.name}`);
  };

  const handleExportTrack = (track: CustomRaceTrackSpec) => {
    const raw = exportCustomRaceTrackJson(track);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(raw).catch(() => {});
    }
    setJsonInput(raw);
    setShowBuilder(true);
    setUgcMessage(`JSON "${track.name}" disalin ke kotak impor/clipboard.`);
  };

  const handleShareTrack = (track: CustomRaceTrackSpec) => {
    const sent = onShareCustomRace?.(track) ?? false;
    setUgcMessage(
      sent
        ? `Sirkuit "${track.name}" dibagikan ke seluruh pemain di room Co-Op!`
        : 'WebSocket Co-Op belum tersambung — simpan lokal tetap aktif.'
    );
  };

  const handlePublishServer = async (track: CustomRaceTrackSpec) => {
    const res = await gameStore.publishTrackToCommunity(track);
    setUgcMessage(
      res
        ? `Sirkuit "${track.name}" dipublikasikan ke Server Komunitas Jakarta!`
        : 'Gagal menghubungi server komunitas.'
    );
  };

  const handleFetchCommunity = async () => {
    const list = await gameStore.refreshCommunityUgcTracks();
    setUgcMessage(`Dimuat ${list.length} sirkuit komunitas dari server.`);
  };

  const allTracks = [...savedTracks, ...sharedCoopRaces];

  return (
    <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase font-mono-num text-[#38bdf8]">
          Sirkuit UGC & Sync Co-Op ({allTracks.length})
        </span>
        <button
          type="button"
          data-testid="toggle-ugc-race-builder-btn"
          onClick={() => setShowBuilder((v) => !v)}
          className="px-2 py-0.5 rounded bg-[#38bdf8]/20 hover:bg-[#38bdf8]/35 text-[#7dd3fc] font-mono-num text-[10px] font-bold cursor-pointer"
        >
          {showBuilder ? 'Tutup Studio' : '+ Buat / Impor'}
        </button>
      </div>

      {ugcMessage && (
        <div className="px-2 py-1 rounded bg-[#0f172a] border border-[#38bdf8]/30 text-[10px] text-[#7dd3fc]">
          {ugcMessage}
        </div>
      )}

      {showBuilder && (
        <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10 flex flex-col gap-2">
          <input
            type="text"
            value={trackName}
            onChange={(e) => setTrackName(e.target.value)}
            placeholder="Nama sirkuit balap kustom..."
            className="w-full px-2 py-1 rounded bg-[#05080f] border border-white/15 text-xs text-[#f4f1ea]"
          />
          <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono-num text-[#94a3b8]">
            <span>Checkpoint: {checkpoints.length}/10</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handleAddPlayerPosCheckpoint}
                className="px-2 py-0.5 rounded bg-[#22c55e]/20 text-[#4ade80] font-bold cursor-pointer"
              >
                + Posisi Sekarang
              </button>
              <button
                type="button"
                onClick={() => setCheckpoints((prev) => prev.slice(0, -1))}
                className="px-2 py-0.5 rounded bg-white/10 text-[#cbd5e1] cursor-pointer"
              >
                Undo
              </button>
            </div>
          </div>
          <div className="text-[10px] font-mono-num text-[#cbd5e1] break-words">
            {checkpoints.map((c, idx) => `#${idx + 1}[${c[0]},${c[1]}]`).join(' → ')}
          </div>
          <button
            type="button"
            onClick={handleCreateTrack}
            className="w-full py-1.5 rounded bg-[#38bdf8] text-[#090c12] font-mono-num text-[11px] font-extrabold cursor-pointer"
          >
            Simpan Sirkuit UGC
          </button>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={2}
            placeholder="Tempel JSON sirkuit di sini untuk impor..."
            className="w-full px-2 py-1 rounded bg-[#05080f] border border-white/15 text-[10px] font-mono-num text-[#f4f1ea]"
          />
          <button
            type="button"
            onClick={handleImportJson}
            className="w-full py-1 rounded bg-white/10 hover:bg-white/20 text-[#f4f1ea] font-mono-num text-[10px] font-bold cursor-pointer"
          >
            Impor JSON Sirkuit
          </button>
        </div>
      )}

      {allTracks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {allTracks.map((track) => (
            <div
              key={track.id}
              className="p-2 rounded-lg bg-white/[0.04] flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                    {track.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-[#94a3b8]">
                    {track.checkpoints.length} CP · Hadiah {formatRupiah(track.rewardRp)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onStartCustomRace(track);
                    onClosePhone();
                  }}
                  className="px-2 py-1 rounded bg-[#22d3ee] text-[#090c12] font-mono-num text-[10px] font-extrabold cursor-pointer shrink-0"
                >
                  Balap
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShareTrack(track)}
                  className="px-2 py-0.5 rounded bg-[#a855f7]/25 text-[#d8b4fe] font-mono-num text-[10px] font-semibold cursor-pointer"
                >
                  Sync Co-Op
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublishServer(track)}
                  className="px-2 py-0.5 rounded bg-[#22c55e]/20 text-[#4ade80] font-mono-num text-[10px] font-semibold cursor-pointer"
                >
                  Terbitkan Online
                </button>
                <button
                  type="button"
                  onClick={() => handleExportTrack(track)}
                  className="px-2 py-0.5 rounded bg-white/10 text-[#cbd5e1] font-mono-num text-[10px] font-semibold cursor-pointer"
                >
                  Ekspor JSON
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Community Server UGC Tracks Browser */}
      <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase font-mono-num text-[#22c55e]">
            Katalog Komunitas Online ({communityTracks.length})
          </span>
          <button
            type="button"
            onClick={() => void handleFetchCommunity()}
            className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-mono-num text-[#cbd5e1] cursor-pointer"
          >
            {socialHubLoading ? 'Memuat...' : 'Muat Komunitas'}
          </button>
        </div>
        {communityTracks.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="p-2 rounded-lg bg-[#0c1424] border border-[#22c55e]/20 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                {item.track.name}
              </div>
              <div className="text-[10px] font-mono-num text-[#94a3b8]">
                Oleh {item.track.authorName} · ♥ {item.likes} · ▶ {item.plays}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => void gameStore.likeCommunityTrack(item.id)}
                className="px-1.5 py-1 rounded bg-white/10 hover:bg-[#f43f5e]/30 text-[10px] text-[#fda4af] font-mono-num cursor-pointer"
                title="Sukai Sirkuit"
              >
                ♥
              </button>
              <button
                type="button"
                onClick={() => {
                  gameStore.addCustomRaceTrack(item.track);
                  void gameStore.markCommunityTrackPlayed(item.id);
                  onStartCustomRace(item.track);
                  onClosePhone();
                }}
                className="px-2 py-1 rounded bg-[#22c55e] text-[#090c12] font-mono-num text-[10px] font-extrabold cursor-pointer"
              >
                Main
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
