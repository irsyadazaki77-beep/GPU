import React, { useEffect, useState } from 'react';
import {
  ProjectedWorldCallout,
  engineTelemetryRef,
} from '../state/gameStore';

/**
 * Lightweight HUD overlay rendering floating world-space NPC & traffic reaction callouts
 * (e.g. "Woy!", "Minggir bang!", "Santai!") projected from 3D world positions.
 * Polls engineTelemetryRef only at 20Hz and skips React state updates when no callouts exist.
 */
export const WorldCalloutOverlay: React.FC = () => {
  const [items, setItems] = useState<ProjectedWorldCallout[]>([]);

  useEffect(() => {
    let hadItems = false;
    const timer = window.setInterval(() => {
      const live = engineTelemetryRef.worldCallouts;
      if (!live || live.length === 0) {
        if (hadItems) {
          hadItems = false;
          setItems([]);
        }
        return;
      }
      hadItems = true;
      setItems(live.filter((c) => c.visible).map((c) => ({ ...c })));
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-20 overflow-hidden"
      data-testid="world-callout-overlay"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute -translate-x-1/2 -translate-y-full px-2.5 py-1 bg-[#0b101d]/90 border border-amber-400/75 text-amber-200 font-display text-xs font-extrabold tracking-wide uppercase shadow-[0_6px_18px_rgba(0,0,0,0.6)] whitespace-nowrap"
          style={{
            left: `${item.screenX}px`,
            top: `${item.screenY}px`,
            opacity: item.opacity,
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
};
