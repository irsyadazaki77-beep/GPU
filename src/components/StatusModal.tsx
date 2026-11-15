import React, { useState } from 'react';
import {
  JAKARTA_DISTRICTS,
  JAKARTA_PROPERTIES,
  JAKARTA_STOCKS,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  RADIO_STATIONS,
  RadioStationId,
  STORY_MISSIONS,
  StoryMission,
  WEATHER_MODES,
  WeatherMode,
  calculatePassivePropertyIncome,
  formatRupiah,
  getDominantFactionTitle,
} from '../game/rules';
import { gameStore, useGameStore } from '../state/gameStore';

interface StatusModalProps {
  mode: 'paused' | 'victory' | 'defeat';
  snapshot: PlayerProgressState;
  outcomeNarrative: string | null;
  weatherMode?: WeatherMode;
  muted?: boolean;
  onResume: () => void;
  onRestart: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onReturnTitle: () => void;
  onFastTravel?: (districtId: string) => void;
  onTriggerMissionDialog?: (mission: StoryMission) => void;
  onChangeWeather?: (mode: WeatherMode) => void;
  onChangeRadio?: (station: RadioStationId) => void;
  onToggleMute?: () => void;
  onOpenHeistBoard?: () => void;
  onOpenCustomsGarage?: () => void;
}

type PauseTab = 'peta' | 'misi' | 'aset' | 'kontrol';

const CONTROL_GROUPS: {
  category: string;
  items: { keycap: string; action: string }[];
}[] = [
  {
    category: 'Pergerakan & Aksi',
    items: [
      { keycap: 'W A S D', action: 'Berjalan, berlari, atau mengemudikan kendaraan' },
      { keycap: 'Seret Mouse', action: 'Putar kamera orbit 360° mengikuti pandangan' },
      { keycap: 'Spasi / Klik', action: 'Menembak atau menyerang jarak dekat' },
      { keycap: 'X / Klik Kanan', action: 'Aktifkan bidikan bahu TPS presisi' },
      { keycap: 'Q', action: 'Aktifkan kemampuan khusus / Nitro kendaraan' },
      { keycap: 'F', action: 'Masuk atau keluar dari kendaraan terdekat' },
      { keycap: 'K', action: 'Bunyikan klakson (reaksi ojol & angkot)' },
      { keycap: 'G', action: 'Masuk atau keluar interior gedung' },
      { keycap: 'E', action: 'Bicara dengan pemberi misi terdekat' },
    ],
  },
  {
    category: 'Menu, Roda & Sistem',
    items: [
      { keycap: 'Y / 1–7', action: 'Buka Roda Senjata radial atau pilih slot cepat' },
      { keycap: 'C', action: 'Pindah satelit antar 3 protagonis' },
      { keycap: 'Tab', action: 'Buka atau tutup smartphone iFruit OS' },
      { keycap: 'H', action: 'Buka Papan Strategi Grand Heist' },
      { keycap: 'B', action: 'Buka Bengkel Kustom 360°' },
      { keycap: 'Z', action: 'Aktifkan Drone Rajawali' },
      { keycap: 'V / M', action: 'Ganti cuaca Jakarta / Senyapkan audio' },
      { keycap: 'Esc / P', action: 'Buka atau tutup Pause Menu Terpadu' },
    ],
  },
];

export const StatusModal: React.FC<StatusModalProps> = ({
  mode,
  snapshot,
  outcomeNarrative,
  weatherMode = 'senja',
  muted = false,
  onResume,
  onRestart,
  onReturnTitle,
  onFastTravel,
  onTriggerMissionDialog,
  onChangeWeather,
  onChangeRadio,
  onToggleMute,
  onOpenHeistBoard,
  onOpenCustomsGarage,
}) => {
  const [activeTab, setActiveTab] = useState<PauseTab>('peta');
  const audioVolumes = useGameStore((s) => s.audioVolumes);
  const dominant = getDominantFactionTitle(snapshot.reputation);
  const passiveIncome = calculatePassivePropertyIncome(snapshot.ownedProperties);

  /* ==================== VICTORY / WASTED WIDESCREEN STAMP ==================== */
  if (mode !== 'paused') {
    const isVictory = mode === 'victory';
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-heading"
        className="fixed inset-0 z-40 flex items-center justify-center p-6 pointer-events-auto"
        style={{
          background: isVictory
            ? 'rgba(7, 10, 16, 0.86)'
            : 'radial-gradient(circle, rgba(127,29,29,0.5) 0%, rgba(5,8,14,0.92) 100%)',
        }}
      >
        <div className="w-full max-w-2xl aaa-glass rounded-2xl p-8 shadow-2xl flex flex-col gap-6 animate-stamp-in">
          <div className="text-center border-b border-white/10 pb-6">
            <div
              className={`text-xs font-mono-num font-semibold uppercase tracking-[0.22em] ${
                isVictory ? 'text-[#22c55e]' : 'text-[#ef4444]'
              }`}
            >
              {dominant.title}
            </div>
            <h2
              id="status-modal-heading"
              className={`font-display text-6xl font-extrabold italic uppercase tracking-wide mt-1 hud-stroke ${
                isVictory ? 'text-[#f59e0b]' : 'text-[#ef4444]'
              }`}
            >
              {isVictory ? 'Misi Jakarta Tuntas' : 'Wasted'}
            </h2>
            <p className="text-sm md:text-base text-[#cbd5e1] mt-3 max-w-lg mx-auto leading-relaxed">
              {isVictory
                ? outcomeNarrative || dominant.endingSummary
                : 'Aparat dan sindikat rival berhasil melumpuhkanmu di jalanan Jakarta.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-[#94a3b8]">Skor Tertinggi</div>
              <div className="font-mono-num text-xl font-bold text-[#f4f1ea] mt-1">
                {Math.round(snapshot.score)} / {Math.round(snapshot.bestScore)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#94a3b8]">Saldo Kas</div>
              <div className="font-mono-num text-xl font-bold text-[#22c55e] mt-1">
                {formatRupiah(snapshot.rupiah)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#94a3b8]">Progres Kampanye</div>
              <div className="font-mono-num text-xl font-bold text-[#38bdf8] mt-1">
                {snapshot.completedMissions.length} / 15
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="flex-1 min-w-[200px] py-3 px-6 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] font-display text-xl font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
            >
              {isVictory ? 'Mainkan Lagi' : 'Bangkit Kembali [Enter]'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="py-3 px-6 rounded-lg bg-white/10 hover:bg-white/15 text-[#f4f1ea] font-display text-xl font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              Menu Utama
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ==================== UNIFIED GTA V WIDESCREEN PAUSE MENU ==================== */
  let portfolioValueRp = 0;
  for (const st of JAKARTA_STOCKS) {
    const entry = snapshot.stockPortfolio[st.symbol];
    if (entry) portfolioValueRp += entry.ownedShares * entry.currentPrice;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-heading"
      className="fixed inset-0 z-40 bg-[#060910]/94 flex flex-col pointer-events-auto animate-aaa-up"
    >
      {/* Top 1-Row Rockstar Pause Header */}
      <header className="w-full max-w-6xl mx-auto px-6 pt-6 pb-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-6">
          <h2
            id="status-modal-heading"
            className="font-display text-3xl font-extrabold italic uppercase tracking-wide text-[#f4f1ea]"
          >
            GPU: <span className="text-[#f59e0b]">San Nabilo</span>
          </h2>

          {/* Clean Horizontal Tab Navigation */}
          <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
            {(
              [
                { id: 'peta', label: 'Peta & Distrik' },
                { id: 'misi', label: 'Kampanye & Misi' },
                { id: 'aset', label: 'Statistik & Aset' },
                { id: 'kontrol', label: 'Pengaturan & Kontrol' },
              ] as { id: PauseTab; label: string }[]
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#f59e0b] text-[#090c12]'
                      : 'text-[#cbd5e1] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="px-4 py-2 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] font-semibold text-xs cursor-pointer whitespace-nowrap"
          >
            Lanjutkan [Esc]
          </button>
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-[#e2e8f0] text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            Mulai Ulang
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-[#94a3b8] hover:text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            Menu Utama
          </button>
        </div>
      </header>

      {/* Main Pause Tab Content */}
      <div className="flex-1 overflow-y-auto w-full max-w-6xl mx-auto px-6 py-6">
        {/* TAB 1: PETA & DISTRIK */}
        {activeTab === 'peta' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                  13 Distrik Jakarta
                </h3>
                <span className="text-xs text-[#94a3b8]">
                  Klik distrik untuk fast travel instan
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {JAKARTA_DISTRICTS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onFastTravel?.(d.id);
                      onResume();
                    }}
                    className="p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-display text-base font-bold uppercase text-[#f4f1ea] truncate">
                        {d.name}
                      </div>
                      <div className="text-xs text-[#94a3b8] truncate">
                        {d.subtitle}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[#38bdf8] shrink-0">
                      Menuju
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="aaa-glass rounded-xl p-5 flex flex-col gap-3">
                <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                  Akses Operasi Taktis
                </h3>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Kelola rencana perampokan Grand Heist atau modifikasi kendaraan 360° langsung dari sini.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onResume();
                    onOpenHeistBoard?.();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] font-semibold text-xs cursor-pointer text-left flex items-center justify-between"
                >
                  <span>Papan Strategi Grand Heist</span>
                  <span className="font-mono-num">[H]</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResume();
                    onOpenCustomsGarage?.();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-[#f4f1ea] font-semibold text-xs cursor-pointer text-left flex items-center justify-between"
                >
                  <span>Bengkel Kustom 360°</span>
                  <span className="font-mono-num text-[#c084fc]">[B]</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KAMPANYE & MISI */}
        {activeTab === 'misi' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 divide-y divide-white/10">
              {STORY_MISSIONS.map((m) => {
                const done = snapshot.completedMissions.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono-num text-[#94a3b8]">
                        Tahap {m.stageNumber} · Babak {m.chapterNumber} · {m.locationName}
                      </div>
                      <div className="font-display text-lg font-bold uppercase text-[#f4f1ea] truncate">
                        {m.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onResume();
                        onTriggerMissionDialog?.(m);
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${
                        done
                          ? 'bg-white/10 text-[#cbd5e1] hover:bg-white/15'
                          : 'bg-[#f59e0b] text-[#090c12] hover:bg-[#fbbf24]'
                      }`}
                    >
                      {done ? 'Ulangi Babak' : 'Mulai Misi'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="aaa-glass rounded-xl p-5 flex flex-col gap-3">
                <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                  Reputasi Faksi
                </h3>
                <div className="text-xs text-[#38bdf8] font-medium">
                  Status: {dominant.title}
                </div>
                {[
                  { label: 'Jawara Jalanan', val: snapshot.reputation.jalanan, color: '#f97316' },
                  { label: 'Eksekutif Sindikat', val: snapshot.reputation.sindikat, color: '#38bdf8' },
                  { label: 'Bela Rakyat', val: snapshot.reputation.rakyat, color: '#22c55e' },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#cbd5e1]">{f.label}</span>
                      <span className="font-mono-num text-[#f4f1ea]">{f.val}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${f.val}%`, backgroundColor: f.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STATISTIK & ASET */}
        {activeTab === 'aset' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="aaa-glass rounded-xl p-5 flex flex-col gap-3">
              <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                Ringkasan Keuangan
              </h3>
              <div className="divide-y divide-white/10 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#94a3b8]">Saldo Kas</span>
                  <span className="font-mono-num font-bold text-[#22c55e]">
                    {formatRupiah(snapshot.rupiah)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#94a3b8]">Portofolio BAJSA</span>
                  <span className="font-mono-num font-bold text-[#38bdf8]">
                    {formatRupiah(portfolioValueRp)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#94a3b8]">Dividen Pasif</span>
                  <span className="font-mono-num font-bold text-[#f59e0b]">
                    +{formatRupiah(passiveIncome)} / 4d
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-[#94a3b8]">Grand Heist Selesai</span>
                  <span className="font-mono-num font-bold text-[#f4f1ea]">
                    {snapshot.completedHeists.length} / 3
                  </span>
                </div>
              </div>
            </div>

            <div className="aaa-glass rounded-xl p-5 flex flex-col gap-3">
              <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                Trio Protagonis
              </h3>
              <div className="divide-y divide-white/10">
                {(['nabilo', 'raka', 'kirana'] as ProtagonistId[]).map((pId) => {
                  const prof = PROTAGONIST_PROFILES[pId];
                  const live = snapshot.protagonistRoster[pId];
                  return (
                    <div key={pId} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-[#f4f1ea]">{prof.name}</div>
                        <div className="text-[11px] text-[#94a3b8]">
                          {prof.homeDistrictName}
                        </div>
                      </div>
                      <span className="font-mono-num text-[#22c55e]">
                        HP {Math.round(live.hp)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="aaa-glass rounded-xl p-5 flex flex-col gap-3">
              <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                Properti Dimiliki ({snapshot.ownedProperties.length})
              </h3>
              {snapshot.ownedProperties.length === 0 ? (
                <p className="text-xs text-[#94a3b8]">
                  Belum ada properti yang dibeli. Kunjungi aplikasi Properti di iFruit Phone.
                </p>
              ) : (
                <div className="divide-y divide-white/10 text-xs">
                  {JAKARTA_PROPERTIES.filter((p) =>
                    snapshot.ownedProperties.includes(p.id)
                  ).map((p) => (
                    <div key={p.id} className="py-2 flex justify-between">
                      <span className="text-[#f4f1ea]">{p.name}</span>
                      <span className="font-mono-num text-[#22c55e]">
                        +{formatRupiah(p.incomePerTick)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PENGATURAN & KONTROL */}
        {activeTab === 'kontrol' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="aaa-glass rounded-xl p-5 flex flex-col gap-4">
                <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                  Pengaturan Dunia & Audio
                </h3>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#cbd5e1]">Suara Permainan</span>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      muted
                        ? 'bg-[#ef4444]/20 text-[#ef4444]'
                        : 'bg-[#22c55e]/20 text-[#22c55e]'
                    }`}
                  >
                    {muted ? 'Nonaktif (Mute)' : 'Aktif'}
                  </button>
                </div>

                {/* 4-Channel Audio Mixer (Master, SFX, Radio, Ambience) */}
                <div className="flex flex-col gap-2.5 pt-1 border-t border-white/10">
                  {(
                    [
                      { key: 'master', label: 'Volume Master' },
                      { key: 'sfx', label: 'Efek & Mesin (SFX)' },
                      { key: 'radio', label: 'Radio FM Jakarta' },
                      { key: 'ambience', label: 'Suasana Kota (Ambience)' },
                    ] as const
                  ).map((ch) => {
                    const pct = Math.round(audioVolumes[ch.key] * 100);
                    return (
                      <div key={ch.key} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <label
                            htmlFor={`audio-slider-${ch.key}`}
                            className="text-[#cbd5e1]"
                          >
                            {ch.label}
                          </label>
                          <span className="font-mono-num text-[#f59e0b]">
                            {pct}%
                          </span>
                        </div>
                        <input
                          id={`audio-slider-${ch.key}`}
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={audioVolumes[ch.key]}
                          onChange={(e) =>
                            gameStore.setAudioVolumes({
                              [ch.key]: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[#f59e0b] cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>

                <div>
                  <div className="text-xs text-[#94a3b8] mb-2">Atmosfer Cuaca</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WEATHER_MODES.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onChangeWeather?.(w.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium cursor-pointer ${
                          weatherMode === w.id
                            ? 'bg-[#38bdf8] text-[#090c12] font-bold'
                            : 'bg-white/5 text-[#cbd5e1] hover:bg-white/10'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-[#94a3b8] mb-2">Stasiun Radio FM</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {RADIO_STATIONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onChangeRadio?.(r.id)}
                        className={`py-2 px-3 rounded-lg text-xs font-medium cursor-pointer ${
                          snapshot.radioStation === r.id
                            ? 'bg-[#f59e0b] text-[#090c12] font-bold'
                            : 'bg-white/5 text-[#cbd5e1] hover:bg-white/10'
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 aaa-glass rounded-xl p-5 flex flex-col gap-5">
              <h3 className="font-display text-xl font-bold uppercase text-[#f4f1ea]">
                Daftar Kontrol Keyboard & Mouse
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {CONTROL_GROUPS.map((grp) => (
                  <div key={grp.category} className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-[#f59e0b]">
                      {grp.category}
                    </div>
                    <div className="divide-y divide-white/10 text-xs">
                      {grp.items.map((item) => (
                        <div
                          key={item.keycap}
                          className="py-2 flex items-center justify-between gap-3"
                        >
                          <span className="text-[#cbd5e1]">{item.action}</span>
                          <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono-num text-[11px] font-semibold text-[#f4f1ea] whitespace-nowrap shrink-0">
                            {item.keycap}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
