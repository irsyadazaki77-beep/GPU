import React, { useEffect, useRef } from 'react';
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

    return () => {
      controllerRef.current = null;
      engineRef.current = null;
      engine.dispose();
    };
  }, [controllerRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0b0d12]"
    />
  );
};
