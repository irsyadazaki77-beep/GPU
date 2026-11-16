import { computeSimBatchInPlace } from './sim.worker';

export class SimWorkerClient {
  private worker: Worker | null = null;
  private busy = false;
  private disposed = false;
  private inBuffer: ArrayBuffer;
  private latestOut: Float32Array;
  private readonly capacity: number;

  constructor(maxVehicles: number = 36) {
    this.capacity = maxVehicles;
    this.inBuffer = new ArrayBuffer(maxVehicles * 4 * Float32Array.BYTES_PER_ELEMENT);
    this.latestOut = new Float32Array(maxVehicles * 4);

    if (typeof window !== 'undefined' && typeof window.Worker === 'function') {
      try {
        this.worker = new Worker(
          new URL('./sim.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.worker.onmessage = (
          evt: MessageEvent<{ inBuffer?: ArrayBuffer; outBuffer?: ArrayBuffer }>
        ) => {
          this.busy = false;
          if (this.disposed) return;
          if (evt.data?.inBuffer) {
            this.inBuffer = evt.data.inBuffer;
          }
          if (evt.data?.outBuffer) {
            this.latestOut = new Float32Array(evt.data.outBuffer);
          }
        };
        this.worker.onerror = () => {
          this.busy = false;
        };
      } catch {
        this.worker = null;
      }
    }
  }

  public stepBatch(
    vehicles: { x: number; z: number; heading: number; speed: number }[],
    playerX: number,
    playerZ: number,
    dt: number
  ): Float32Array {
    const count = Math.min(this.capacity, vehicles.length);
    if (
      this.worker &&
      !this.busy &&
      this.inBuffer.byteLength >= count * 16
    ) {
      const view = new Float32Array(this.inBuffer);
      for (let i = 0; i < count; i++) {
        const v = vehicles[i];
        const base = i * 4;
        view[base] = v.x;
        view[base + 1] = v.z;
        view[base + 2] = v.heading;
        view[base + 3] = v.speed;
      }
      this.busy = true;
      try {
        this.worker.postMessage(
          {
            inBuffer: this.inBuffer,
            playerX,
            playerZ,
            dt,
          },
          [this.inBuffer]
        );
        return this.latestOut;
      } catch {
        this.busy = false;
      }
    }

    // Immediate synchronous fallback when worker is busy or in non-worker environments
    const localIn = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const v = vehicles[i];
      const base = i * 4;
      localIn[base] = v.x;
      localIn[base + 1] = v.z;
      localIn[base + 2] = v.heading;
      localIn[base + 3] = v.speed;
    }
    computeSimBatchInPlace(localIn, this.latestOut, playerX, playerZ, dt);
    return this.latestOut;
  }

  public isWorkerActive(): boolean {
    return Boolean(this.worker);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
