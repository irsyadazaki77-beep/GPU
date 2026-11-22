import assert from 'node:assert/strict';
import test from 'node:test';
import { GRAND_HEISTS } from '../game/heists';
import { evaluateHeistLaserTripwire } from './heistSecurity3d';

test('evaluateHeistLaserTripwire trips on armed vault lasers and disarms after EMP sabotage', () => {
  const heist = GRAND_HEISTS[0];

  const clearOutside = evaluateHeistLaserTripwire({
    playerX: heist.vaultX,
    playerY: 0,
    playerZ: heist.vaultZ + 12,
    sabotagedIds: [],
  });
  assert.equal(clearOutside.tripped, false);

  const trippedArmed = evaluateHeistLaserTripwire({
    playerX: heist.vaultX + 1.2,
    playerY: 0.4,
    playerZ: heist.vaultZ + 3.8,
    sabotagedIds: [],
  });
  assert.equal(trippedArmed.tripped, true);
  assert.equal(trippedArmed.heistId, heist.id);

  const disarmedByEmp = evaluateHeistLaserTripwire({
    playerX: heist.vaultX + 1.2,
    playerY: 0.4,
    playerZ: heist.vaultZ + 3.8,
    sabotagedIds: [heist.id],
  });
  assert.equal(disarmedByEmp.tripped, false);

  const highFlyOver = evaluateHeistLaserTripwire({
    playerX: heist.vaultX,
    playerY: 4.5,
    playerZ: heist.vaultZ + 3.8,
    sabotagedIds: [],
  });
  assert.equal(highFlyOver.tripped, false);
});
