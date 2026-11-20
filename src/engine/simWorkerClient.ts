import { computeSimBatchInPlace } from './sim.worker';

export class SimWorkerClient {
  private worker: Worker | null = null;
  private busy = false;
  private disposed = false;
  private inBuffer: ArrayBuffer;
  private outBuffer: ArrayBuffer;
  private latestOut: Float32Array;
  private fallbackIn: Float32Array;
  private capacity: number;

  constructor(maxVehicles: number = 48) {
    this.capacity = Math.max(8, maxVehicles);
    this.inBuffer = new ArrayBuffer(
      this.capacity * 4 * Float32Array.BYTES_PER_ELEMENT
    );
    this.outBuffer = new ArrayBuffer(
      this.capacity * 4 * Float32Array.BYTES_PER_ELEMENT
    );
    this.latestOut = new Float32Array(this.capacity * 4);
    this.fallbackIn = new Float32Array(this.capacity * 4);

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
            this.outBuffer = evt.data.outBuffer;
            this.latestOut = new Float32Array(this.outBuffer);
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

  private ensureCapacity(neededVehicles: number): void {
    if (neededVehicles <= this.capacity || this.busy) return;
    this.capacity = Math.max(neededVehicles, this.capacity * 2);
    const bytes = this.capacity * 4 * Float32Array.BYTES_PER_ELEMENT;
    this.inBuffer = new ArrayBuffer(bytes);
    this.outBuffer = new ArrayBuffer(bytes);
    this.latestOut = new Float32Array(this.capacity * 4);
    this.fallbackIn = new Float32Array(this.capacity * 4);
  }

  public stepBatch(
    vehicles: { x: number; z: number; heading: number; speed: number }[],
    playerX: number,
    playerZ: number,
    dt: number
  ): Float32Array {
    this.ensureCapacity(vehicles.length);
    const count = Math.min(this.capacity, vehicles.length);

    if (this.worker) {
      if (this.busy) {
        // Never stall main thread when async worker is already crunching current frame
        return this.latestOut;
      }
      if (
        this.inBuffer.byteLength >= count * 16 &&
        this.outBuffer.byteLength >= count * 16
      ) {
        const view = new Float32Array(this.inBuffer, 0, count * 4);
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
              outBuffer: this.outBuffer,
              playerX,
              playerZ,
              dt,
            },
            [this.inBuffer, this.outBuffer]
          );
          return this.latestOut;
        } catch {
          this.busy = false;
        }
      }
      return this.latestOut;
    }

    // Immediate zero-GC synchronous fallback in non-worker / test environments
    for (let i = 0; i < count; i++) {
      const v = vehicles[i];
      const base = i * 4;
      this.fallbackIn[base] = v.x;
      this.fallbackIn[base + 1] = v.z;
      this.fallbackIn[base + 2] = v.heading;
      this.fallbackIn[base + 3] = v.speed;
    }
    computeSimBatchInPlace(
      this.fallbackIn.subarray(0, count * 4),
      this.latestOut,
      playerX,
      playerZ,
      dt
    );
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
