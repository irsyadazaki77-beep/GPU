# GPU: San Nabilo Open-World (Jakarta)

Game aksi open-world 3D bertema Jakarta yang dibangun di atas Three.js, React 19, TypeScript, Tailwind CSS v4, dan Express + `@google/genai` (server-side AI proxy).

*A 3D Jakarta-themed open-world action game engineered with a decoupled 60fps Three.js engine, external state store, SpatialHashGrid collision system, Jakarta traffic AI, and a secure server-side Gemini NPC dialogue backend.*

---

## Fitur Utama / Key Features

- **Trio Protagonis & 3 Archetype Jakarta:** Mulai sebagai *Anak Jalanan* (`anak_jalanan`), *Mantan Kurir* (`mantan_kurir`), atau *Teknisi Glodok* (`teknisi_glodok`), lalu berganti perspektif satelit antar Nabilo, Raka, dan Kirana (`[C]`).
- **Sistem Faksi & 15 Babak Cerita:** Pengaruhi reputasi *Jawara Jalanan* (`jalanan`), *Eksekutif Sindikat* (`sindikat`), dan *Bela Rakyat* (`rakyat`) lintas 13 distrik Jakarta (Monas, Sudirman, SCBD, Tanah Abang, Kota Tua, Blok M, Tanjung Priok, Ancol, Halim, Senayan GBK, Kemayoran, PIK 2, TMII).
- **Lalu Lintas Khas Jakarta (AI):**
  - **TransJakarta:** Mematuhi koridor busway khusus & berhenti di halte.
  - **Angkot M-15:** Dapat berhenti mendadak (*ngetem*) di tepi jalan dan kembali melaju saat diklakson (`[K]`).
  - **Ojol:** Lincah menyalip di sela antrean (*lane-splitting*) dan merespons klakson maupun sirine *wanted level*.
- **Radar Mini-Map Real-Time:** Menampilkan jalan protokol, Tol Layang, Monas, halte TransJakarta (`T`), lokasi Grand Heist (`$`), balapan liar, zona faksi, garis GPS, serta unit polisi dengan kerucut penglihatan berkedip merah-biru saat buronan aktif.
- **Grand Heists, Bursa Saham BAJSA, & Balap Liar:** Rencanakan perampokan besar di Papan Heist (`[H]`), sabotase saham rival, dan modifikasi kendaraan 360° di Bengkel Kustom (`[B]`).
- **Dialog Informan NPC (Gemini Server Proxy + Offline Fallback):** Endpoint `POST /api/npc/dialogue` menghasilkan dialog kontekstual & *dynamic side-quest* menggunakan `@google/genai` di server, lengkap dengan fallback deterministik lokal saat offline.
- **Cuaca Dinamis & Audio Multi-Channel:** Transisi mulus *Senja Emas Jakarta*, *Malam*, *Siang*, dan *Hujan* dengan `RoomEnvironment`, disertai mixer volume terpisah (*Master*, *SFX*, *Radio*, *Ambience*) serta penyimpanan **Save Schema v2** (otomatis migrasi dari v1).

---

## Struktur Folder / Architecture

```text
├── server.ts                      # Express entry point (API + Vite middleware dev / static prod)
├── server/
│   └── npcDialogue.ts             # @google/genai proxy, sanitasi prompt & deterministic fallback
├── src/
│   ├── App.tsx                    # Root game orchestrator (phase, audio, save v2, shortcuts)
│   ├── state/
│   │   └── gameStore.ts           # External store (useSyncExternalStore) + 60fps engineTelemetryRef
│   ├── engine/
│   │   ├── WorldEngine.ts         # WebGLRenderer, RoomEnvironment PMREM, rAF loop & dispose()
│   │   ├── CityRenderer.ts        # Bangunan, Tol Layang, Halte, InstancedMesh props & beacons
│   │   ├── WeatherLightingSystem.ts # Skybox shader, pencahayaan dinamis, fog, partikel hujan
│   │   ├── TrafficSystem.ts       # Traffic pooling, TransJakarta/Angkot/Ojol AI & polisi
│   │   └── PlayerController.ts    # Fisika karakter/kendaraan, kamera orbit/TPS, SpatialHashGrid
│   ├── game/
│   │   ├── types.ts               # Definisi tipe terpusat
│   │   ├── archetypes.ts          # Archetype, profil protagonis, outfit & senjata
│   │   ├── weather.ts             # Preset cuaca, transisi pencahayaan & soundscape Jakarta
│   │   ├── economy.ts             # Bursa saham BAJSA, properti & transaksi
│   │   ├── heists.ts              # Distrik, kru heist & kalkulasi Grand Heists
│   │   ├── racing.ts              # Spek kendaraan, balapan liar & traffic waypoint AI
│   │   ├── combat.ts              # Damage, Fokus, upgrade kendaraan/drone & AI musuh
│   │   ├── save.ts                # Save schema v2 & migrasi otomatis v1 -> v2
│   │   ├── sound.ts               # Web Audio synthesizer (Master, SFX, Radio, Ambience)
│   │   ├── rules.ts               # Barrel re-export domain game
│   │   └── world/
│   │       ├── bounds.ts          # Koordinat gedung, trotoar & batas dunia
│   │       ├── spatial.ts         # hash2D, SpatialHashGrid O(1), circle-AABB collision
│   │       └── geometryBuilders.ts# Builder mesh prosedural 3D Jakarta
│   └── components/
│       ├── JakartaWorldCanvas.tsx # Wrapper <canvas> ke WorldEngine
│       ├── MiniMapRadar.tsx       # Radar mini-map terisolasi 20fps
│       ├── GameHud.tsx            # HUD in-game & speedometer
│       ├── StoryDialogueModal.tsx # Dialog misi bercabang + obrolan AI NPC
│       ├── StatusModal.tsx        # Pause menu, peta distrik, mixer audio & daftar kontrol
│       ├── RadialWheelOverlay.tsx # Roda senjata, roda protagonis & quick audio mix
│       ├── HeistPlanningModal.tsx # Papan perencanaan Grand Heist
│       ├── CustomsGarageModal.tsx # Bengkel kustomisasi 360°
│       ├── NabiloPhoneModal.tsx   # Smartphone in-game (Bursa BAJSA, Properti, Balap Liar)
│       └── TitleScreen.tsx        # Layar judul & pemilihan tahap awal
```

---

## Kontrol Keyboard & Mouse

| Tombol | Fungsi |
| :--- | :--- |
| `W A S D` | Berjalan, berlari, atau mengemudikan kendaraan |
| `Seret Mouse` | Putar kamera orbit 360° |
| `Spasi / Klik Kiri` | Menembak / menyerang jarak dekat (atau naik di VTOL/Heli) |
| `X / Klik Kanan` | Bidikan bahu TPS presisi |
| `F` | Masuk / keluar kendaraan terdekat |
| `K` | Bunyikan klakson (membangunkan angkot ngetem & memberi sinyal ojol) |
| `Q` | Aktifkan Fokus khusus protagonis / Nitro kendaraan |
| `G` | Masuk / keluar interior gedung |
| `E` | Bicara dengan pemberi misi terdekat |
| `Y` / `1–7` | Roda senjata radial / pilih slot cepat |
| `C` | Pindah satelit antar 3 protagonis |
| `Tab` | Buka / tutup smartphone iFruit OS |
| `H` | Papan Strategi Grand Heist |
| `B` | Bengkel Kustom 360° |
| `Z` | Aktifkan / nonaktifkan Drone Rajawali-X |
| `V` / `M` | Ganti cuaca Jakarta / senyapkan audio |
| `Esc` / `P` | Menu jeda & pengaturan mixer audio |

---

## Setup & Menjalankan Proyek

1. Salin file contoh konfigurasi lingkungan:
   ```bash
   cp .env.example .env
   ```
   Isi `GEMINI_API_KEY` di `.env` (opsional — jika kosong, dialog NPC otomatis berjalan menggunakan mode *fallback* lokal deterministik). **Jangan** pernah menaruh key pada variabel `VITE_*`.

2. Pasang dependensi & jalankan server pengembangan (port `3000`):
   ```bash
   npm install        # atau: bun install
   npm run dev        # atau: bun dev
   ```

3. Uji tipe TypeScript, unit test, dan production build:
   ```bash
   npm run lint       # tsc --noEmit
   npx --yes tsx --test src/game/rules.test.ts src/game/world/spatial.test.ts
   npm run build      # vite build
   npm run start      # node server.ts (mode produksi setelah build)
   ```
