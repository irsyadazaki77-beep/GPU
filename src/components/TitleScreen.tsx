import React, { useState } from 'react';
import {
  OriginArchetype,
  PROTAGONIST_PROFILES,
  formatRupiah,
} from '../game/rules';
import { SavedGameSnapshot } from '../game/save';

interface TitleScreenProps {
  selectedOrigin: OriginArchetype;
  selectedStage: 1 | 2 | 3 | 4 | 5;
  savedGame?: SavedGameSnapshot | null;
  onSelectOrigin: (origin: OriginArchetype) => void;
  onSelectStage: (stage: 1 | 2 | 3 | 4 | 5) => void;
  onContinueGame?: () => void;
  onStartGame: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const ORIGINS: {
  id: OriginArchetype;
  label: string;
  role: string;
  perk: string;
  stats: { cash: number; combat: number; tech: number };
}[] = [
  {
    id: 'anak_jalanan',
    label: 'Jawara Tanah Abang',
    role: 'Garis Depan Jalanan',
    perk: 'Armor Kevlar +80, 1 kru pengawal aktif, dan kemampuan Fokus Badai.',
    stats: { cash: 60, combat: 95, tech: 75 },
  },
  {
    id: 'mantan_kurir',
    label: 'Kurir Kilat Sudirman',
    role: 'Raja Aspal Protokol',
    perk: 'Modal awal Rp 550.000, reputasi rakyat tinggi, dan akses cepat.',
    stats: { cash: 95, combat: 75, tech: 70 },
  },
  {
    id: 'teknisi_glodok',
    label: 'Arsitek Taktis Glodok',
    role: 'Spesialis Siber & Plasma',
    perk: 'Seluruh 7 senjata terbuka sejak awal beserta Drone Rajawali Lv.2.',
    stats: { cash: 70, combat: 90, tech: 100 },
  },
];

const CAMPAIGN_STAGES: {
  stage: 1 | 2 | 3 | 4 | 5;
  tabLabel: string;
  title: string;
  chapters: string;
  subtitle: string;
}[] = [
  {
    stage: 1,
    tabLabel: 'I',
    title: 'Jejak Sang Perantau',
    chapters: 'Babak 1–3',
    subtitle: 'Medan Merdeka Monas, Pasar Tanah Abang, dan Kota Tua.',
  },
  {
    stage: 2,
    tabLabel: 'II',
    title: 'Konflik Megapolitan',
    chapters: 'Babak 4–6',
    subtitle: 'Pelabuhan Tanjung Priok, Menara Bursa SCBD, dan Mercon Naga.',
  },
  {
    stage: 3,
    tabLabel: 'III',
    title: 'Ekspansi Nusantara',
    chapters: 'Babak 7–9',
    subtitle: 'Marina Ancol-PIK, Kereta Cepat Halim, dan Busur Pasopati.',
  },
  {
    stage: 4,
    tabLabel: 'IV',
    title: 'Operasi Paripurna',
    chapters: 'Babak 10–12',
    subtitle: 'Stadion GBK Senayan, Kemayoran Siber, dan Hypercar Garuda GT-X.',
  },
  {
    stage: 5,
    tabLabel: 'V',
    title: 'Edisi Mahakarya Nusantara',
    chapters: 'Babak 13–15',
    subtitle:
      'Tiga protagonis, tiga Grand Heist, tol layang, bursa BAJSA, dan Jet VTOL.',
  },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedOrigin,
  selectedStage,
  savedGame,
  onSelectOrigin,
  onSelectStage,
  onContinueGame,
  onStartGame,
}) => {
  const [showNewGameSetup, setShowNewGameSetup] = useState<boolean>(!savedGame);

  const activeStage =
    CAMPAIGN_STAGES.find((s) => s.stage === selectedStage) || CAMPAIGN_STAGES[4];
  const activeOrigin =
    ORIGINS.find((o) => o.id === selectedOrigin) || ORIGINS[0];

  const savedProtagonist = savedGame
    ? PROTAGONIST_PROFILES[savedGame.playerState.activeProtagonist]
    : null;

  return (
    <main
      aria-label="Layar Utama GPU San Nabilo"
      className="fixed inset-0 z-20 flex items-center px-6 py-6 md:px-14 pointer-events-none overflow-y-auto"
      style={{
        background:
          'linear-gradient(92deg, rgba(7, 10, 16, 0.94) 0%, rgba(7, 10, 16, 0.72) 32%, rgba(7, 10, 16, 0.14) 56%, rgba(7, 10, 16, 0) 78%)',
      }}
    >
      {/* Left-Anchored Cinematic Rockstar Menu Column */}
      <div className="w-full max-w-[420px] flex flex-col gap-4 pointer-events-auto my-auto">
        {/* Clean GTA-Inspired Wordmark & Monas Crest */}
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3.5">
            <svg
              viewBox="0 0 48 64"
              className="w-9 h-12 shrink-0"
              aria-hidden="true"
            >
              <polygon
                points="24,2 33,19 28,22 30,54 18,54 20,22 15,19"
                fill="#f59e0b"
              />
              <polygon points="10,54 38,54 42,62 6,62" fill="#f4f1ea" />
              <circle cx="24" cy="11" r="3.5" fill="#fef08a" />
            </svg>
            <div>
              <h1 className="font-display text-5xl md:text-6xl font-extrabold italic uppercase tracking-tight text-[#f4f1ea] leading-[0.9] hud-stroke">
                GPU: <span className="text-[#f59e0b]">San Nabilo</span>
              </h1>
              <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#94a3b8] mt-1">
                Grand Theft Nusantara · Jakarta Open World
              </p>
            </div>
          </div>
        </header>

        {/* Auto-Saved Campaign Resume Block */}
        {savedGame && onContinueGame && (
          <section className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
            <button
              type="button"
              data-continue="true"
              onClick={onContinueGame}
              className="w-full py-3.5 px-5 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] active:scale-[0.99] text-[#090c12] shadow-[0_10px_30px_rgba(245,158,11,0.28)] transition-all cursor-pointer flex items-center justify-between gap-3 text-left"
            >
              <div>
                <div className="font-display text-2xl font-extrabold uppercase tracking-wider leading-none">
                  Lanjutkan Permainan
                </div>
                <div className="text-xs font-semibold text-[#090c12]/80 mt-1 font-mono-num">
                  {savedProtagonist?.name || 'Nabilo'} ·{' '}
                  {savedGame.playerState.completedMissions.length}/15 Babak ·{' '}
                  {formatRupiah(savedGame.playerState.rupiah)}
                </div>
              </div>
              <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-[#090c12]/15 shrink-0">
                Enter
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewGameSetup((prev) => !prev)}
              className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[#cbd5e1] font-display text-base font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-between"
            >
              <span>
                {showNewGameSetup
                  ? 'Tutup Pengaturan Kampanye Baru'
                  : 'Permainan Baru'}
              </span>
              <span className="text-xs font-mono-num text-[#94a3b8]">
                {showNewGameSetup ? '−' : '+'}
              </span>
            </button>
          </section>
        )}

        {/* New Campaign Configuration */}
        {(!savedGame || showNewGameSetup) && (
          <>
            {/* Section 1: Compact Segmented Campaign Stage Selector */}
            <section className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[#94a3b8]">
                  Titik Mulai Kampanye
                </span>
                <span className="text-xs font-mono-num text-[#f59e0b]">
                  {activeStage.chapters}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
                {CAMPAIGN_STAGES.map((item) => {
                  const active = selectedStage === item.stage;
                  return (
                    <button
                      key={item.stage}
                      type="button"
                      onClick={() => onSelectStage(item.stage)}
                      className={`py-1.5 px-2 rounded-md font-display text-sm font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#f59e0b] text-[#090c12]'
                          : 'text-[#cbd5e1] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      Tahap {item.tabLabel}
                    </button>
                  );
                })}
              </div>

              <div className="px-0.5">
                <div className="font-display text-xl font-bold uppercase tracking-wide text-[#f4f1ea] leading-tight">
                  {activeStage.title}
                </div>
                <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">
                  {activeStage.subtitle}
                </p>
              </div>
            </section>

            {/* Section 2: Slim Protagonist Origin Selector */}
            <section className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[#94a3b8]">
                  Latar Belakang Awal
                </span>
                <span className="text-xs text-[#38bdf8]">
                  {activeOrigin.role}
                </span>
              </div>

              <div className="flex flex-col divide-y divide-white/10 border border-white/10 rounded-lg bg-[#0d111a]/75 overflow-hidden">
                {ORIGINS.map((orig) => {
                  const active = selectedOrigin === orig.id;
                  return (
                    <button
                      key={orig.id}
                      type="button"
                      onClick={() => onSelectOrigin(orig.id)}
                      className={`px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        active
                          ? 'bg-white/10 text-[#f4f1ea]'
                          : 'text-[#94a3b8] hover:bg-white/5 hover:text-[#e2e8f0]'
                      }`}
                    >
                      <span className="font-display text-lg font-bold uppercase tracking-wide whitespace-nowrap">
                        {orig.label}
                      </span>
                      <span
                        className={`text-xs whitespace-nowrap ${
                          active
                            ? 'text-[#f59e0b] font-semibold'
                            : 'text-[#64748b]'
                        }`}
                      >
                        {active ? 'Dipilih' : orig.role}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 pt-0.5">
                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {activeOrigin.perk}
                </p>
                <div className="grid grid-cols-3 gap-3 text-[11px] font-mono-num">
                  {[
                    {
                      label: 'Modal',
                      val: activeOrigin.stats.cash,
                      color: '#22c55e',
                    },
                    {
                      label: 'Tempur',
                      val: activeOrigin.stats.combat,
                      color: '#ef4444',
                    },
                    {
                      label: 'Teknologi',
                      val: activeOrigin.stats.tech,
                      color: '#38bdf8',
                    },
                  ].map((st) => (
                    <div key={st.label} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[#94a3b8]">
                        <span>{st.label}</span>
                        <span className="text-[#f4f1ea]">{st.val}</span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${st.val}%`,
                            backgroundColor: st.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Primary Launch CTA */}
            <div className="pt-1 flex flex-col gap-2">
              <button
                type="button"
                data-start="true"
                onClick={onStartGame}
                className={`w-full py-3.5 px-6 rounded-lg active:scale-[0.99] font-display text-2xl font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-between ${
                  savedGame
                    ? 'bg-white/12 hover:bg-white/20 text-[#f4f1ea] border border-white/20'
                    : 'bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] shadow-[0_10px_30px_rgba(245,158,11,0.28)]'
                }`}
              >
                <span>
                  {savedGame ? 'Mulai Kampanye Baru' : 'Mulai Permainan'}
                </span>
                {!savedGame && (
                  <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-[#090c12]/15">
                    Enter
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        <p className="text-[11px] text-[#64748b]">
          Seret mouse di kanvas untuk memutar kamera. Tekan Esc saat bermain untuk membuka peta distrik dan daftar kontrol.
        </p>
      </div>
    </main>
  );
};
