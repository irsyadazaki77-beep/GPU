import 'dotenv/config';
import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import type { NpcDialogueRequest, NpcVoiceRequest } from './src/game/types';
import {
  getCloudSaveSlot,
  parseSlotIdParam,
  putCloudSaveSlot,
} from './server/cloudSave';
import { attachMultiplayerWebSocketServer } from './server/multiplayer';
import {
  checkNpcDialogueRateLimit,
  generateNpcDialogue,
} from './server/npcDialogue';
import { generateNpcVoice } from './server/npcVoice';

const PORT = 3000;

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'san-nabilo-api', version: '0.3.0' });
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

  // Cloud Save Schema v3 Endpoints (GET / POST /api/saves/:slotId)
  app.get('/api/saves/:slotId', (req, res) => {
    const slotId = parseSlotIdParam(req.params.slotId);
    if (!slotId) {
      res.status(400).json({ error: 'Invalid save slot ID (must be 1, 2, or 3)' });
      return;
    }
    const snapshot = getCloudSaveSlot(slotId);
    res.json({ slotId, exists: Boolean(snapshot), snapshot });
  });

  app.post('/api/saves/:slotId', (req, res) => {
    const slotId = parseSlotIdParam(req.params.slotId);
    if (!slotId) {
      res.status(400).json({ error: 'Invalid save slot ID (must be 1, 2, or 3)' });
      return;
    }
    const saved = putCloudSaveSlot(slotId, req.body);
    if (!saved) {
      res.status(400).json({ error: 'Invalid Save Schema v3 payload' });
      return;
    }
    res.json({ status: 'ok', slotId, savedAt: saved.savedAt, snapshot: saved });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = createHttpServer(app);
  attachMultiplayerWebSocketServer(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`GPU San Nabilo server + WebSocket running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
