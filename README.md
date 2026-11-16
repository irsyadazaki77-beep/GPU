# GPU: San Nabilo Open-World (Jakarta) — v0.3.0

Game aksi open-world 3D bertema Jakarta yang dibangun di atas Three.js, `@dimforge/rapier3d-compat` (WebAssembly Physics Engine), React 19, TypeScript, Tailwind CSS v4, WebSocket Co-Op Multiplayer (`ws`), dan Express + `@google/genai` (server-side AI dialogue & voice proxy).

*A 3D Jakarta-themed open-world action game engineered with a decoupled 60fps Three.js engine, fixed-timestep Rapier 3D rigid-body vehicle physics, reactive pedestrian crowd AI, 3D HRTF spatial audio, real-time WebSocket Co-Op multiplayer, Save Schema v3 with Cloud Sync, and a server-side Gemini NPC dialogue & TTS voice backend.*

---

## Fitur Utama / Key Features

- **Trio Protagonis & 3 Archetype Jakarta:** Mulai sebagai *Anak Jalanan* (`anak_jalanan`), *Mantan Kurir* (`mantan_kurir`), atau *Teknisi Glodok* (`teknisi_glodok`), lalu berganti perspektif satelit antar Nabilo, Raka, dan Kirana (`[C]`).
- **Sistem Faksi, Perang Teritori (Turf War), & 15 Babak Cerita:** Pengaruhi reputasi *Jawara Jalanan* (`jalanan`), *Eksekutif Sindikat* (`sindikat`), dan *Bela Rakyat* (`rakyat`) lintas 13 distrik Jakarta (Monas, Sudirman, SCBD, Tanah Abang, Kota Tua, Blok M, Tanjung Priok, Ancol, Halim, Senayan GBK, Kemayoran, PIK 2, TMII) serta klaim dividen pasif dari distrik yang dikuasai.
- **Physics Engine Nyata (`@dimforge/rapier3d-compat`) & Lalu Lintas Khas Jakarta:**
  - **Rapier 3D Rigid-Body & Raycast Suspension:** Fixed-timestep (`dt = 1/60`) dengan kurva friksi drift realistis, reaksi impuls tabrakan antar kendaraan, dan sinkronisasi collider gedung Jakarta.
  - **TransJakarta, Angkot M-15, & Ojol AI:** Mematuhi lampu lalu lintas 4-fase (*Traffic Lights*), berhenti di halte, *ngetem* di tepi jalan, menyalip antrean (*lane-splitting*), serta menghindari insiden **World Clock Road Events** (*Proyek Jalan* & *Macet Mendadak*) dengan rute alternatif GPS.
- **Crowd & Pedestrian AI (`src/engine/crowdAi.ts`):** Pejalan kaki terinstansiasi (`THREE.InstancedMesh`) dengan state machine (`WALKING`, `CROSSING_AT_GREEN`, `FLEEING`, `CROWDING`) yang menyeberang saat lampu hijau pejalan kaki, berlari panik saat baku tembak/buronan tinggi, dan bereaksi terhadap klakson.
- **3D HRTF Spatial Audio & Radio FM (`src/engine/spatialAudio.ts` & `src/game/sound.ts`):** Panner 3D berbasis jarak dan arah kamera untuk klakson TransJakarta, knalpot Ojol, sirine polisi, derit ban drift, serta 5 stasiun radio FM Jakarta (*Prambors*, *Radio Koplo*, *Synth SCBD*, *Indie Senopati*, *Berita Kriminal*).
- **AI Living City & Voice-First NPC (`server/npcDialogue.ts` & `server/npcVoice.ts`):**
  - Mengirim `WorldContextSnapshot` (protagonis aktif, distrik, level buronan, reputasi faksi, jumlah teritori, dan 3 aksi terakhir pemain) ke `POST /api/npc/dialogue` untuk menghasilkan dialog Bahasa Indonesia khas jalanan Jakarta.
  - Sintesis suara informan via `POST /api/npc/voice` (`gemini-3.8-flash-lite-tts`) dengan *in-memory LRU cache* dan teks subtitle yang disinkronkan di `StoryDialogueModal`.
- **Co-Op Multiplayer & Cloud Save Schema v3 (`server/multiplayer.ts`, `src/engine/netSync.ts`, `src/game/save.ts`):**
  - Sinkronisasi WebSocket 20Hz -> 60fps interpolasi mulus untuk lobi **Free-Roam**, **Street Racing**, dan **Co-Op Grand Heist** (hingga 8 pemain per ruangan).
  - **Save Schema v3:** Manajemen 3 slot penyimpanan, ekspor/impor file JSON, migrasi otomatis dari Save Schema v1/v2 -> v3, serta sinkronisasi Cloud Save (`GET/POST /api/saves/:slotId`).
- **Photo Mode Sinematik, Kontrol Layar Sentuh Mobile, & Optimasi 60 FPS:** Mode foto dengan filter warna & aturan sepertiga (`[N]`), virtual joystick + HTML5 Gamepad untuk perangkat mobile, `THREE.LOD` 3-tingkat, Web Worker simulasi (`src/engine/sim.worker.ts`), serta overlay telemetri performa (`[F3]`).

---

## Struktur Folder / Architecture

```text
├── server.ts                      # Express + WebSocket entry point (API, Cloud Save, Multiplayer)
├── server/
│   ├── npcDialogue.ts             # @google/genai proxy, WorldContextSnapshot, rate-limit & fallback
│   ├── npcDialogue.test.ts        # Unit test sanitasi, memori dunia, rate-limit & offline fallback
│   ├── npcVoice.ts                # Gemini TTS proxy dengan LRU voice cache
│   ├── multiplayer.ts             # WebSocket room server (Free-Roam, Street Race, Co-Op Heist)
│   └── cloudSave.ts               # Endpoint penyimpanan Cloud Save Schema v3
├── src/
│   ├── App.tsx                    # Root game orchestrator (phase, jam dunia 24J, save v3, shortcuts)
│   ├── state/
│   │   ├── gameStore.ts           # External store (useSyncExternalStore) + 60fps engineTelemetryRef
│   │   └── save.test.ts           # Unit test migrasi Save Schema v1/v2 -> v3 & ekspor/impor slot
│   ├── engine/
│   │   ├── WorldEngine.ts         # WebGLRenderer, RoomEnvironment PMREM, rAF loop & dispose()
│   │   ├── physicsWorld.ts        # @dimforge/rapier3d-compat fixed-timestep rigid-body physics
│   │   ├── crowdAi.ts             # State machine pejalan kaki (WALKING, CROSSING_AT_GREEN, FLEEING, CROWDING)
│   │   ├── spatialAudio.ts        # Web Audio API 3D HRTF PannerNode & listener sinkronisasi kamera
│   │   ├── netSync.ts             # Client WebSocket multiplayer & interpolasi entitas 20Hz -> 60fps
│   │   ├── lodBuilder.ts          # 3-tier THREE.LOD builder untuk gedung & kendaraan jauh
│   │   ├── sim.worker.ts          # Web Worker simulasi berbasis Transferable Float32Array
│   │   ├── CityRenderer.ts        # Bangunan, Tol Layang, Halte, LOD & InstancedMesh props
│   │   ├── CrowdSystem.ts         # InstancedMesh pejalan kaki 13 distrik Jakarta
│   │   ├── TrafficSystem.ts       # Traffic pooling, TransJakarta/Angkot/Ojol AI & insiden jalan
│   │   └── PlayerController.ts    # Kendali karakter/kendaraan, kamera orbit/TPS, drift & kombat
│   ├── game/
│   │   ├── types.ts               # Definisi tipe terpusat & WorldContextSnapshot
│   │   ├── save.ts                # Save Schema v3, 3 slot, JSON export/import, migrasi v1/v2 -> v3 & cloud sync
│   │   ├── sound.ts               # Web Audio synthesizer (Master, SFX, Radio, Ambience)
│   │   └── rules.ts               # Barrel re-export domain game & unit test (rules.test.ts)
│   └── components/
│       ├── GameHud.tsx            # HUD in-game, speedometer, insiden jalan & overlay performa 60fps
│       ├── InteractiveWorldMap.tsx# Peta dunia interaktif, kontrol Turf War & jam dunia 24J
│       ├── StoryDialogueModal.tsx # Dialog misi bercabang, obrolan AI NPC & streaming suara/subtitle
│       ├── PhotoModeOverlay.tsx   # Studio kamera sinematik [N]
│       ├── MobileTouchControls.tsx# Virtual D-pad & tombol aksi layar sentuh mobile
│       └── StatusModal.tsx        # Menu jeda, manajemen 3 slot Save v3, Cloud Sync & lobi Co-Op
```

---

## Kontrol Keyboard, Mouse & Mobile

| Tombol | Fungsi |
| :--- | :--- |
| `W A S D` / Virtual Stick | Berjalan, berlari, atau mengemudikan kendaraan |
| `Seret Mouse` | Putar kamera orbit 360° |
| `Spasi / Klik Kiri` | Menembak / menyerang jarak dekat (atau rem tangan drift di mobil) |
| `X / Klik Kanan` | Bidikan bahu TPS presisi |
| `F` / `G` | Masuk / keluar kendaraan terdekat atau masuk interior gedung |
| `K` | Bunyikan klakson (membangunkan angkot ngetem & memberi sinyal ojol) |
| `R` | Ganti stasiun Radio FM saat mengemudi |
| `Q` | Aktifkan Fokus khusus protagonis / Nitro kendaraan |
| `E` | Bicara dengan pemberi misi terdekat |
| `Y` / `1–7` | Roda senjata radial / pilih slot cepat |
| `C` | Pindah satelit antar 3 protagonis (Nabilo, Raka, Kirana) |
| `Tab` | Buka / tutup smartphone iFruit OS (BAJSA, Properti, Balap Liar) |
| `H` / `B` / `J` | Papan Strategi Grand Heist / Bengkel Kustom 360° / Warung Kuliner |
| `N` / `U` | Photo Mode Sinematik / Mode HUD Zen |
| `F3` | Tampilkan / sembunyikan Overlay Performa 60 FPS & Jaringan Co-Op |
| `Esc` / `P` | Menu jeda, Peta Distrik, Slot Save v3, & Pengaturan |

---

## Setup & Verifikasi

1. Salin konfigurasi lingkungan:
   ```bash
   cp .env.example .env
   ```
   Isi `GEMINI_API_KEY` di `.env` (opsional — jika kosong, dialog dan suara NPC otomatis menggunakan mode *fallback* lokal deterministik).

2. Pasang dependensi & jalankan server pengembangan (port `3000`):
   ```bash
   npm install
   npm run dev
   ```

3. Jalankan verifikasi kualitas (Lint, Unit Tests, & Production Build):
   ```bash
   npm run lint       # tsc --noEmit (0 errors)
   npm test           # Menjalankan seluruh suite unit test (rules, spatial, save v3, npcDialogue)
   npm run build      # Bundel produksi Vite
   npm run start      # Menjalankan server produksi Express + WebSocket
   ```
