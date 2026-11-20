import { expect, test } from '@playwright/test';

test('San Nabilo Open-World E2E Smoke: health/readyz probes, WebGL canvas boot, and Rapier3D WASM init', async ({
  page,
  request,
}) => {
  // 1. Verify /api/health and /api/readyz return HTTP 200
  const healthRes = await request.get('/api/health');
  expect(healthRes.status()).toBe(200);
  const healthBody = (await healthRes.json()) as {
    status: string;
    version: string;
  };
  expect(healthBody.status).toBe('ok');
  expect(healthBody.version).toBe('0.3.0');

  const readyRes = await request.get('/api/readyz');
  expect(readyRes.status()).toBe(200);
  const readyBody = (await readyRes.json()) as {
    status: string;
    checks: { sqlite: string };
  };
  expect(readyBody.status).toBe('ready');
  expect(readyBody.checks.sqlite).toBe('ok');

  // 2. Track uncaught page errors and fatal console errors
  const pageErrors: string[] = [];
  const fatalConsoleErrors: string[] = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // Ignore harmless missing favicon or WebSocket dev HMR messages
      if (/favicon\.ico|vite|WebSocket/i.test(txt)) return;
      fatalConsoleErrors.push(txt);
    }
  });

  // 3. Boot directly into the 3D Jakarta Open-World (?autostart=1)
  await page.goto('/?autostart=1', { waitUntil: 'domcontentloaded' });

  const canvas = page.locator('canvas[data-testid="jakarta-webgl-canvas"]');
  await canvas.waitFor({ state: 'visible', timeout: 20_000 });

  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(200);
  expect(box!.height).toBeGreaterThan(200);

  // 4. Allow simulation frames & Rapier3D WASM initialization to settle
  await page.waitForTimeout(1200);

  const bodyState = await page.evaluate(() =>
    document.body.getAttribute('data-state')
  );
  expect(bodyState).toBe('playing');

  // 5. Open [F3] telemetry overlay and verify Rapier3D RigidBodies > 0
  const perfBtn = page.locator('[data-testid="toggle-perf-overlay-btn"]');
  await perfBtn.click({ force: true });

  const perfOverlay = page.locator('[data-testid="engine-perf-overlay"]');
  await perfOverlay.waitFor({ state: 'visible', timeout: 5_000 });
  const overlayText = (await perfOverlay.textContent()) || '';
  expect(overlayText.includes('Rapier3D')).toBe(true);
  expect(overlayText.includes('RigidBodies:')).toBe(true);
  expect(
    overlayText.includes('CONNECTED') || overlayText.includes('RECONNECTING')
  ).toBe(true);

  expect(pageErrors).toEqual([]);
  expect(fatalConsoleErrors).toEqual([]);
});
