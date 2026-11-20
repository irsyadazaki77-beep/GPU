import React, { useEffect, useRef, useState } from 'react';
import {
  WorldControllerHandle,
  WorldEngine,
  WorldEngineProps,
} from '../engine/WorldEngine';

export type { WorldControllerHandle } from '../engine/WorldEngine';

interface JakartaWorldCanvasProps extends WorldEngineProps {
  controllerRef: React.MutableRefObject<WorldControllerHandle | null>;
}

export const JakartaWorldCanvas: React.FC<JakartaWorldCanvasProps> = ({
  controllerRef,
  ...engineProps
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const initialPropsRef = useRef<WorldEngineProps>(engineProps);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.props = engineProps;
    }
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new WorldEngine(container, initialPropsRef.current);
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
  }, [controllerRef]);

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
