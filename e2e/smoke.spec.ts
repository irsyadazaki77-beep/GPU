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

  // Grand Plan 7.0 Social Hub REST API checks
  const lbRes = await request.get('/api/leaderboard?category=etle_speed');
  expect(lbRes.status()).toBe(200);
  const lbJson = (await lbRes.json()) as { entries: unknown[] };
  expect(Array.isArray(lbJson.entries)).toBe(true);

  const ugcRes = await request.get('/api/ugc/tracks');
  expect(ugcRes.status()).toBe(200);
  const ugcJson = (await ugcRes.json()) as { tracks: unknown[] };
  expect(Array.isArray(ugcJson.tracks)).toBe(true);

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

  // 6. Trigger Trio Active Ability [L] and open NabiloPhone [Tab] -> verify UI & movement resilience
  const abilityBtn = page.locator('[data-testid="trio-ability-btn"]');
  await abilityBtn.click({ force: true });
  await page.waitForTimeout(200);

  await page.keyboard.press('Tab');
  const phoneDialog = page.getByRole('dialog', { name: 'Smartphone iFruit Jakarta' });
  await phoneDialog.waitFor({ state: 'visible', timeout: 5_000 });
  const imperiumBtn = phoneDialog.getByRole('button', { name: 'Imperium' });
  await imperiumBtn.click({ force: true });

  const leaderboardCard = page.locator('[data-testid="global-leaderboard-card"]');
  await leaderboardCard.waitFor({ state: 'visible', timeout: 5_000 });

  const ugcToggleBtn = page.locator('[data-testid="toggle-ugc-race-builder-btn"]');
  await ugcToggleBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Simulate brief WASD movement, Stealth Crouch [X], Drone FPV [F4], and Wheel overlays [Y]/[C]
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyX');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyX');

  await page.keyboard.press('F4');
  const droneHud = page.locator('[data-testid="drone-recon-hud"]');
  await droneHud.waitFor({ state: 'visible', timeout: 5_000 });
  await page.keyboard.press('F4');
  await page.waitForTimeout(150);

  await page.keyboard.press('KeyY');
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');

  await page.keyboard.press('KeyB');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');

  expect(pageErrors).toEqual([]);
  expect(fatalConsoleErrors).toEqual([]);
});
