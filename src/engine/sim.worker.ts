/// <reference lib="webworker" />

/**
 * Dedicated Web Worker (`src/engine/sim.worker.ts`) processing Transferable
 * Float32Array vehicle/actor coordinate buffers off the main UI thread so
 * 60 FPS rendering never stutters.
 *
 * Input Float32Array stride = 4 per vehicle: [x, z, heading, speed]
 * Output Float32Array stride = 4 per vehicle: [minAheadDist, distToPlayer, nextX, nextZ]
 */
export function computeSimBatchInPlace(
  inBuf: Float32Array,
  outBuf: Float32Array,
  playerX: number,
  playerZ: number,
  dt: number
): void {
  const count = Math.floor(inBuf.length / 4);
  for (let i = 0; i < count; i++) {
    const baseI = i * 4;
    const vx = inBuf[baseI];
    const vz = inBuf[baseI + 1];
    const heading = inBuf[baseI + 2];
    const speed = inBuf[baseI + 3];

    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    let minAhead = 999;

    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const baseJ = j * 4;
      const ox = inBuf[baseJ];
      const oz = inBuf[baseJ + 1];
      const dx = ox - vx;
      const dz = oz - vz;
      const fwdDot = dx * sinH + dz * cosH;
      if (fwdDot > 0.4 && fwdDot < minAhead) {
        const latDist = Math.abs(dx * cosH - dz * sinH);
        if (latDist < 2.25) {
          minAhead = fwdDot;
        }
      }
    }

    const dxP = playerX - vx;
    const dzP = playerZ - vz;
    const distToPlayer = Math.hypot(dxP, dzP);
    const fwdP = dxP * sinH + dzP * cosH;
    if (fwdP > 0.4 && fwdP < minAhead) {
      const latP = Math.abs(dxP * cosH - dzP * sinH);
      if (latP < 2.1) {
        minAhead = fwdP;
      }
    }

    outBuf[baseI] = minAhead;
    outBuf[baseI + 1] = distToPlayer;
    outBuf[baseI + 2] = vx + sinH * speed * dt;
    outBuf[baseI + 3] = vz + cosH * speed * dt;
  }
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (
    evt: MessageEvent<{
      inBuffer?: ArrayBuffer;
      playerX?: number;
      playerZ?: number;
      dt?: number;
    }>
  ) => {
    const { inBuffer, playerX = 0, playerZ = 0, dt = 1 / 60 } = evt.data || {};
    if (!inBuffer) return;
    const inFloats = new Float32Array(inBuffer);
    const outFloats = new Float32Array(inFloats.length);
    computeSimBatchInPlace(inFloats, outFloats, playerX, playerZ, dt);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(
      {
        inBuffer,
        outBuffer: outFloats.buffer,
      },
      [inBuffer, outFloats.buffer]
    );
  };
}
