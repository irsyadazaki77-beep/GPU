# GPU: San Nabilo Open-World (Jakarta) — Grand Plan 4.0 ("GTA V" Scale)

Game aksi open-world 3D bertema Jakarta yang dibangun di atas Three.js, `@dimforge/rapier3d-compat` (WebAssembly Physics Engine), React 19, TypeScript, Tailwind CSS v4, WebSocket Co-Op Multiplayer (`ws`), SQLite WAL Cloud Save, dan Express + `@google/genai` (server-side AI dialogue & voice proxy).

*A 3D Jakarta-themed open-world action game engineered with a decoupled 60fps Three.js engine, Chunked World Streaming (`SpatialChunkLoader`), Seamless Enterable Interiors (`InteriorManager`), Systemic Economy & BAJSA Stock Sabotage (`economy.ts`), 5-Star Jakarta Police Escalation & Flood Hydroplaning (`wantedSystem.ts`), Multi-Protagonist Heist Role Switching (`heistRoles.ts`), fixed-timestep Rapier 3D rigid-body vehicle & water buoyancy physics, reactive pedestrian crowd AI, 3D HRTF spatial audio, hardened WebSocket Co-Op multiplayer, and SQLite WAL Cloud Save Schema v3.*

---

## Fitur Utama / Key Features (Grand Plan 3.0 + 4.0)

- **Fase A — Chunked World Streaming & 3 Zona Ekspansi Baru (`src/engine/chunkLoader.ts`):**
  - **SpatialChunkLoader (250m × 250m Grid):** Memuat dan melepas geometri distrik (`THREE.Group`), cincin LOD (`lodBuilder.ts`), dan collider statis Rapier3D (`physicsWorld.ts`) secara dinamis berdasarkan radius posisi pemain (`activeRadius = 2`, `preloadRadius = 3`) dengan anggaran frame (`maxOpsPerStep = 2`) agar FPS tetap 60fps stabil.
  - **3 Zona Ekspansi Jakarta Baru:**
    1. **Pelabuhan Tanjung Priok:** Tumpukan kontainer kargo, gantry crane pelabuhan, dan misi penyelundupan kontainer.
    2. **Tol Layang & Simpang Susun Semanggi:** Koridor jalan layang bertingkat untuk balap liar berkecepatan tinggi dan penghindaran helikopter polisi.
    3. **Teluk Jakarta & Kepulauan Seribu:** Kawasan perairan utara dengan dermaga Ancol/PIK, pulau karang, dan fisika apung (*buoyancy*) untuk kendaraan baru **`speedboat`**.
- **Fase B — Seamless Enterable Interiors & Safehouse Trio (`src/engine/interiorManager.ts`):**
  - Transisi portal instan tanpa *reload* halaman untuk masuk ke **Safehouse Trio** (`safehouse_trio`), **Markas Faksi** (`faction_hq_jalanan`, `faction_hq_sindikat`, `faction_hq_rakyat`), **Toko Siber Glodok** (`glodok_tech_shop`), **Warung Kopi**, **Garasi Modifikasi**, dan **Lobi Bank Sentral**.
  - Fitur **Istirahat Safehouse** memajukan jam dunia Jakarta +6 jam, memulihkan HP/Armor penuh, meredakan level buronan, dan menyimpan otomatis ke Save Schema v3.
- **Fase C — Ekonomi Sistemik: Turf War × Bisnis Bawah Tanah × Bursa Saham BAJSA (`src/game/economy.ts`):**
  - Perebutan teritori distrik (*Turf War*), insiden jalan raya (*World Clock Road Events*), dan sabotase bisnis secara langsung mengguncang harga saham **BAJSA** (*supply/demand shock* + kurva pemulihan *mean-reversion* menuju `basePrice`).
  - **4 Bisnis Bawah Tanah Jakarta** (*Bengkel Modifikasi Blok M*, *Armada Ojol Tanah Abang*, *Gudang Kontainer Tanjung Priok*, *Server Farm Glodok*) yang bisa dibeli dan di-upgrade (Lv. 1–5) untuk menghasilkan pendapatan pasif dan operasi sabotase kompetitor.
- **Fase D — Eskalasi Polisi 5 Bintang Jakarta & Cuaca Banjir (`src/game/wantedSystem.ts`, `src/engine/physicsWorld.ts`):**
  - **★1:** Kejaran motor Patwal (`ojek`).
  - **★★2:** Mobil patroli (`polisi`) dengan prediksi lintasan **Manuver PIT** (*lead-target intercept*).
  - **★★★3:** Barikade jalan raya (*roadblock*) + **Paku Ranjau** (*spike strips*) yang mengempiskan ban & memangkas kecepatan.
  - **★★★★4:** Pengerahan unit taktis lapis baja Brimob (`barracuda`).
  - **★★★★★5:** Helikopter polisi (`heli`) dengan lampu sorot (`SpotLight`) pelacak & penyekatan total distrik (*district lockdown*).
  - **Genangan Banjir & Hydroplaning:** Saat cuaca hujan deras (`hujan`), zona cekungan jalan mengalami reduksi traksi ban lateral dan gaya hambat air (*hydroplaning drag*).
- **Fase E — Multi-Protagonis Heist Switching, Side-Jobs Lokal & Custom Race UGC (`src/game/heistRoles.ts`, `src/game/racing.ts`):**
  - **Pergantian Peran Trio (`[C]`):** **Nabilo** (*Heavy Enforcer & Getaway Driver*, reduksi damage +25%), **Raka** (*High-Speed Courier & Flanker*, akselerasi motor/sprint +22%), dan **Kirana** (*Glodok Tech Hacker*, kemampuan retas lampu lalu lintas distrik jadi hijau & butakan kamera/helikopter selama 20 detik).
  - **3 Side-Jobs Khas Jakarta:** *Ojol Express*, *Glodok Underground Arena*, dan *Priok Container Heist*.
  - **Custom Race Track UGC & Multiplayer Sync:** Buat, validasi (3–10 checkpoint), ekspor/impor JSON sirkuit balap kustom, dan sinkronkan antar pemain di ruangan WebSocket `street_race` (`custom_race_sync`).

---

## Struktur Folder / Architecture

```text
├── server.ts                      # Express + WebSocket entry point (/api/health, /api/readyz, Cloud Save, Multiplayer)
├── server/
│   ├── npcDialogue.ts             # @google/genai proxy, WorldContextSnapshot, rate-limit & fallback
│   ├── npcDialogue.test.ts        # Unit test sanitasi, memori dunia, rate-limit & offline fallback
│   ├── npcVoice.ts                # Gemini TTS proxy dengan LRU voice cache
│   ├── multiplayer.ts             # Hardened WebSocket room server (8-player cap, anti-teleport, custom_race_sync)
│   ├── multiplayer.test.ts        # Integration test WebSocket server, 20Hz broadcast, room overflow & anti-cheat
│   ├── cloudSave.ts               # Embedded SQLite WAL store (.data/san_nabilo.db) & strict Save Schema v3 validator
│   └── cloudSave.test.ts          # Unit/integration test SQLite WAL concurrency, player isolation & HTTP endpoints
├── e2e/
│   └── smoke.spec.ts              # Playwright E2E smoke test (health/readyz, WebGL canvas, Rapier3D WASM)
├── src/
│   ├── App.tsx                    # Root game orchestrator (phase, jam dunia 24J, save v3, shortcuts)
│   ├── state/
│   │   ├── gameStore.ts           # External store (useSyncExternalStore) + 60fps engineTelemetryRef
│   │   └── save.test.ts           # Unit test migrasi Save Schema v1/v2 -> v3 & ekspor/impor slot
│   ├── engine/
│   │   ├── chunkLoader.ts         # SpatialChunkLoader (250m x 250m grid, LOD ring & Rapier collider bridge)
│   │   ├── chunkLoader.test.ts    # Unit test chunk coordinate hashing, Chebyshev radius & Rapier disposal
│   │   ├── interiorManager.ts     # Seamless interior portal manager, Safehouse rest (+6h) & loadout swap
│   │   ├── WorldEngine.ts         # WebGLRenderer, RoomEnvironment PMREM, rAF loop & dispose()
│   │   ├── physicsWorld.ts        # @dimforge/rapier3d-compat rigid-body, flood hydroplaning & water buoyancy
│   │   ├── CityRenderer.ts        # Bangunan, 3 Zona Ekspansi (Priok, Semanggi, Teluk Jakarta) & chunk streaming
│   │   ├── TrafficSystem.ts       # Traffic AI, 5-star police PIT/spike-strip pursuit & speedboat spawns
│   │   └── PlayerController.ts    # Kendali karakter/kendaraan, kamera orbit/TPS, drift & kombat
│   ├── game/
│   │   ├── economy.ts             # Sistem ekonomi BAJSA, 4 bisnis bawah tanah, sabotase & mean-reversion
│   │   ├── economy.test.ts        # Unit test stock shock, mean-reversion, portfolio PnL & bisnis pasif
│   │   ├── wantedSystem.ts        # Eskalasi polisi 1-5 bintang, PIT vector, paku ranjau & cooldown LOS
│   │   ├── wantedSystem.test.ts   # Unit test wanted escalation, PIT intercept, spike strip & cooldown decay
│   │   ├── heistRoles.ts          # Trio Heist switching, Kirana 20s cyber hack, AI support & 3 side-jobs
│   │   ├── racing.ts              # Street racing, speedboat specs & Custom Race Track UGC JSON import/export
│   │   └── rules.ts               # Barrel re-export domain game & unit test (rules.test.ts)
│   └── components/
│       ├── GameHud.tsx            # HUD in-game, speedometer, insiden jalan & overlay performa [F3]
│       ├── InteractiveWorldMap.tsx# Peta dunia interaktif, Turf War × BAJSA shock & jam dunia 24J
│       ├── NabiloPhoneModal.tsx   # Smartphone iFruit (BAJSA PnL, Bisnis & Sabotase, Side-Jobs, Garasi Pegasus)
│       └── StatusModal.tsx        # Menu jeda, manajemen 3 slot Save v3, Cloud Sync & lobi Co-Op
```

---

## Verifikasi Kualitas Lengkap (Verification Gate)

```bash
npm run lint          # tsc --noEmit (0 errors)
npm test              # Menjalankan seluruh 9 suite unit & integration test
npm run build         # Bundel produksi Vite (dist/)
npm run build:server  # Bundel produksi server Express + WebSocket (dist-server/server.js)
npm run test:e2e      # Playwright E2E smoke test di Chromium headless
```
