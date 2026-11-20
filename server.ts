import 'dotenv/config';
import express, { type Express } from 'express';
import fs from 'node:fs';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  NpcDialogueRequest,
  NpcVoiceRequest,
  ViralPostRequest,
} from './src/game/types';
import {
  type CloudSaveStore,
  getDefaultCloudSaveStore,
  parseSlotIdParam,
  validatePlayerToken,
  validateStrictSaveSchemaV3,
} from './server/cloudSave';
import { attachMultiplayerWebSocketServer } from './server/multiplayer';
import {
  checkNpcDialogueRateLimit,
  generateNpcDialogue,
} from './server/npcDialogue';
import { generateNpcVoice } from './server/npcVoice';
import {
  checkViralRateLimit,
  generateViralSocialPost,
} from './server/socialViral';

const PORT = Number(process.env.PORT) || 3000;

function isValidDialogueBody(body: unknown): body is NpcDialogueRequest {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Partial<NpcDialogueRequest>;
  return (
    typeof candidate.npcName === 'string' &&
    typeof candidate.locationName === 'string' &&
    typeof candidate.missionTitle === 'string' &&
    typeof candidate.playerPrompt === 'string' &&
    typeof candidate.origin === 'string' &&
    typeof candidate.wantedLevel === 'number' &&
    !!candidate.reputation &&
    typeof candidate.reputation === 'object'
  );
}

function isValidVoiceBody(body: unknown): body is NpcVoiceRequest {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Partial<NpcVoiceRequest>;
  return (
    typeof candidate.text === 'string' &&
    candidate.text.trim().length > 0 &&
    typeof candidate.speakerName === 'string'
  );
}

export interface CreateAppOptions {
  cloudSaveStore?: CloudSaveStore;
  distDir?: string;
}

export function createApiApp(options?: CreateAppOptions): Express {
  const app = express();
  const saveStore = options?.cloudSaveStore ?? getDefaultCloudSaveStore();
  const distDir = options?.distDir ?? path.resolve(process.cwd(), 'dist');

  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'san-nabilo-api', version: '0.3.0' });
  });

  app.get('/api/readyz', (_req, res) => {
    const sqliteOk = saveStore.isReady();
    const indexHtmlPath = path.join(distDir, 'index.html');
    const distAvailable = fs.existsSync(indexHtmlPath);
    const requireDist = process.env.NODE_ENV === 'production';

    if (!sqliteOk || (requireDist && !distAvailable)) {
      res.status(503).json({
        status: 'not_ready',
        service: 'san-nabilo-api',
        version: '0.3.0',
        checks: {
          sqlite: sqliteOk ? 'ok' : 'error',
          staticAssets: distAvailable ? 'ok' : 'missing',
        },
      });
      return;
    }

    res.json({
      status: 'ready',
      service: 'san-nabilo-api',
      version: '0.3.0',
      checks: {
        sqlite: 'ok',
        staticAssets: distAvailable ? 'ok' : 'dev_middleware',
      },
    });
  });

  app.post('/api/npc/dialogue', async (req, res) => {
    if (!isValidDialogueBody(req.body)) {
      res.status(400).json({ error: 'Invalid NPC dialogue payload' });
      return;
    }

    const clientKey = req.ip || 'anonymous';
    const rate = checkNpcDialogueRateLimit(clientKey);
    if (!rate.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterMs: rate.retryAfterMs,
      });
      return;
    }

    const result = await generateNpcDialogue(req.body);
    res.json(result);
  });

  app.post('/api/npc/voice', async (req, res) => {
    if (!isValidVoiceBody(req.body)) {
      res.status(400).json({ error: 'Invalid NPC voice payload' });
      return;
    }

    const result = await generateNpcVoice(req.body);
    res.json(result);
  });

  app.post('/api/social/viral-post', async (req, res) => {
    const body = req.body as Partial<ViralPostRequest> | undefined;
    if (
      !body ||
      typeof body !== 'object' ||
      typeof body.districtName !== 'string' ||
      typeof body.protagonistName !== 'string'
    ) {
      res.status(400).json({ error: 'Invalid NabiloGram viral post payload' });
      return;
    }

    const clientKey = req.ip || 'anonymous';
    const rate = checkViralRateLimit(clientKey);
    if (!rate.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterMs: rate.retryAfterMs,
      });
      return;
    }

    const result = await generateViralSocialPost(body as ViralPostRequest);
    res.json(result);
  });

  // Cloud Save Schema v3 Endpoints (GET / POST /api/saves/:slotId) with Player Isolation
  app.get('/api/saves/:slotId', (req, res) => {
    const slotId = parseSlotIdParam(req.params.slotId);
    if (!slotId) {
      res.status(400).json({
        error: 'Invalid save slot ID (must match ^[a-zA-Z0-9_-]{1,32}$)',
      });
      return;
    }

    const playerToken = validatePlayerToken(req.header('x-player-token'));
    if (!playerToken) {
      res.status(401).json({
        error: 'Missing or invalid X-Player-Token header',
      });
      return;
    }

    const snapshot = saveStore.getSlot(slotId, playerToken);
    res.json({ slotId, exists: Boolean(snapshot), snapshot });
  });

  app.post('/api/saves/:slotId', (req, res) => {
    const slotId = parseSlotIdParam(req.params.slotId);
    if (!slotId) {
      res.status(400).json({
        error: 'Invalid save slot ID (must match ^[a-zA-Z0-9_-]{1,32}$)',
      });
      return;
    }

    const playerToken = validatePlayerToken(req.header('x-player-token'));
    if (!playerToken) {
      res.status(401).json({
        error: 'Missing or invalid X-Player-Token header',
      });
      return;
    }

    const validation = validateStrictSaveSchemaV3(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const saved = saveStore.putSlot(slotId, req.body, playerToken);
    if (!saved) {
      res.status(400).json({ error: 'Invalid Save Schema v3 payload' });
      return;
    }
    res.json({ status: 'ok', slotId, savedAt: saved.savedAt, snapshot: saved });
  });

  return app;
}

export async function startServer(port: number = PORT): Promise<HttpServer> {
  const distDir = path.resolve(process.cwd(), 'dist');
  const app = createApiApp({ distDir });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = createHttpServer(app);
  attachMultiplayerWebSocketServer(httpServer);

  return new Promise((resolve) => {
    httpServer.listen(port, '0.0.0.0', () => {
      console.log(
        `GPU San Nabilo server + WebSocket running at http://0.0.0.0:${port}`
      );
      resolve(httpServer);
    });
  });
}

const isMainEntry = (() => {
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return (
      currentFile === executedFile ||
      executedFile.endsWith('/server.ts') ||
      executedFile.endsWith('/server.js')
    );
  } catch {
    return false;
  }
})();

if (isMainEntry) {
  void startServer();
}
