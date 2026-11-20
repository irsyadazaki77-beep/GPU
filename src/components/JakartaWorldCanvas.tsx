import React, { Component, useEffect, useRef, useState } from 'react';
import {
  WorldControllerHandle,
  WorldEngine,
  WorldEngineProps,
} from '../engine/WorldEngine';

export type { WorldControllerHandle } from '../engine/WorldEngine';

interface JakartaWorldCanvasProps extends WorldEngineProps {
  controllerRef: React.MutableRefObject<WorldControllerHandle | null>;
}

function detectWebGL2Support(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class CanvasErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { hasError: false, message: '' };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Gagal menginisialisasi renderer 3D WebGL2.',
    };
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090c14] text-[#f4f1ea] p-6 text-center">
          <div className="font-display text-2xl font-extrabold uppercase tracking-wider text-[#ff6b4a]">
            Renderer Jakarta 3D Tidak Tersedia
          </div>
          <p className="text-xs text-[#94a3b8] mt-2 max-w-md leading-relaxed">
            {this.state.message}
          </p>
          <p className="text-[11px] text-[#64748b] mt-3 max-w-md">
            Pastikan akselerasi perangkat keras WebGL2 aktif di peramban kamu, lalu muat ulang halaman.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const JakartaWorldCanvasInner: React.FC<JakartaWorldCanvasProps> = ({
  controllerRef,
  ...engineProps
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const initialPropsRef = useRef<WorldEngineProps>(engineProps);
  const [webglSupported] = useState<boolean>(() => detectWebGL2Support());
  const [initError, setInitError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.props = engineProps;
    }
  });

  useEffect(() => {
    if (!webglSupported) return;
    const container = mountRef.current;
    if (!container) return;

    let engine: WorldEngine;
    try {
      engine = new WorldEngine(container, initialPropsRef.current);
    } catch (err) {
      setInitError(
        err instanceof Error
          ? err.message
          : 'WebGL2 tidak dapat diinisialisasi pada perangkat ini.'
      );
      return;
    }

    engineRef.current = engine;
    controllerRef.current = engine.getControllerHandle();

    const canvas = container.querySelector('canvas');
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };

    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      controllerRef.current = null;
      engineRef.current = null;
      engine.dispose();
    };
  }, [controllerRef, webglSupported]);

  if (!webglSupported || initError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090c14] text-[#f4f1ea] p-6 text-center">
        <div className="font-display text-2xl font-extrabold uppercase tracking-wider text-[#f59e0b]">
          WebGL2 Diperlukan untuk San Nabilo 3D
        </div>
        <p className="text-xs text-[#94a3b8] mt-2 max-w-md leading-relaxed">
          {initError ||
            'Peramban atau lingkungan grafis saat ini belum mendukung konteks WebGL2 untuk merender peta 3D Jakarta.'}
        </p>
        <p className="text-[11px] text-[#64748b] mt-3 max-w-md">
          Aktifkan Hardware Acceleration / WebGL2 pada browser modern (Chrome, Edge, Firefox, atau Safari) lalu muat ulang.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0b0d12]"
    >
      {contextLost && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090c14]/95 text-[#f4f1ea] p-6 text-center">
          <div className="font-display text-2xl font-extrabold uppercase tracking-wider text-[#ff6b4a]">
            Memulihkan Renderer Jakarta 3D
          </div>
          <p className="text-xs text-[#94a3b8] mt-2 max-w-sm">
            Konteks GPU WebGL sempat terputus. Permainan otomatis memulihkan tampilan kota begitu GPU siap kembali.
          </p>
        </div>
      )}
    </div>
  );
};

export const JakartaWorldCanvas: React.FC<JakartaWorldCanvasProps> = (
  props
) => (
  <CanvasErrorBoundary>
    <JakartaWorldCanvasInner {...props} />
  </CanvasErrorBoundary>
);
