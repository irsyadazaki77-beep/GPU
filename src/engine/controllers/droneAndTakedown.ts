import { GRAND_HEISTS } from '../../game/heists';
import { computeDroneEmpRadius } from '../../game/grandPlan6Systems';
import type { HeistId } from '../../game/types';

export interface EmpTargetResult {
  empRadius: number;
  stunnedEnemyIds: string[];
  sabotagedHeistId: HeistId | null;
}

/**
 * Evaluates all entities caught inside a Rajawali-X EMP pulse wave,
 * including living enemies and nearby Grand Heist CCTV security perimeters.
 */
export function evaluateDroneEmpTargets(params: {
  droneX: number;
  droneZ: number;
  droneLevel: number;
  activeHeistId: HeistId | null;
  enemies: { id: string; x: number; z: number; state: 'alive' | 'ko' }[];
}): EmpTargetResult {
  const empRadius = computeDroneEmpRadius(params.droneLevel);
  const stunnedEnemyIds: string[] = [];

  for (const en of params.enemies) {
    if (en.state !== 'alive') continue;
    if (Math.hypot(en.x - params.droneX, en.z - params.droneZ) <= empRadius) {
      stunnedEnemyIds.push(en.id);
    }
  }

  let sabotagedHeistId: HeistId | null = null;
  if (params.activeHeistId) {
    const spec = GRAND_HEISTS.find((h) => h.id === params.activeHeistId);
    if (
      spec &&
      Math.hypot(spec.vaultX - params.droneX, spec.vaultZ - params.droneZ) <=
        empRadius + 8
    ) {
      sabotagedHeistId = spec.id;
    }
  }

  return {
    empRadius,
    stunnedEnemyIds,
    sabotagedHeistId,
  };
}
