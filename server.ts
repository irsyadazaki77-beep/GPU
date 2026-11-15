import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import type { NpcDialogueRequest } from './src/game/types';
import { generateNpcDialogue } from './server/npcDialogue';

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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'san-nabilo-api' });
  });

  app.post('/api/npc/dialogue', async (req, res) => {
    if (!isValidDialogueBody(req.body)) {
      res.status(400).json({ error: 'Invalid NPC dialogue payload' });
      return;
    }

    const result = await generateNpcDialogue(req.body);
    res.json(result);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GPU San Nabilo server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
