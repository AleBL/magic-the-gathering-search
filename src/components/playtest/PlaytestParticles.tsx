import { useEffect, useRef, useState } from 'react';

import { useVisualEffects } from '../../hooks/useVisualEffects';
import { usePlaytestContext } from '../playtest/PlaytestContext';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

type BurstKind = 'draw' | 'defeat';

interface BurstParticle {
  id: number;
  size: number;
  tx: number; // travel X in px
  ty: number; // travel Y in px
  duration: number;
  color: string;
}

interface Burst {
  id: number;
  particles: BurstParticle[];
}

const BURST_COLORS: Record<BurstKind, string[]> = {
  draw: ['#818cf8', '#c084fc', '#fcd34d', '#6ee7b7'],
  defeat: ['#ef4444', '#f87171', '#b91c1c']
};

function makeBurst(kind: BurstKind): Burst {
  const palette = BURST_COLORS[kind];
  const count = 22;
  const particles: BurstParticle[] = Array.from({ length: count }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 80 + Math.random() * 160;
    return {
      id: i,
      size: Math.random() * 6 + 4,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 40, // bias upward
      duration: 800 + Math.random() * 500,
      color: palette[i % palette.length]
    };
  });
  return { id: Date.now() + Math.random(), particles };
}

export function PlaytestParticles() {
  const { motionEnabled } = useVisualEffects();
  const { lifeTotal } = usePlaytestContext();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const prevLifeRef = useRef(lifeTotal);

  // Ambient floaters (static set generated once).
  useEffect(() => {
    const newParticles: Particle[] = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 100 + Math.random() * 20,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 10
    }));
    setParticles(newParticles);
  }, []);

  const spawnBurst = (kind: BurstKind) => {
    const burst = makeBurst(kind);
    setBursts((prev) => [...prev, burst]);
    const maxDuration = Math.max(...burst.particles.map((p) => p.duration));
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burst.id));
    }, maxDuration + 100);
  };

  // Opening-hand celebration when the board first mounts.
  useEffect(() => {
    if (!motionEnabled) return;
    spawnBurst('draw');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defeat burst when life drops to zero.
  useEffect(() => {
    const prev = prevLifeRef.current;
    prevLifeRef.current = lifeTotal;
    if (motionEnabled && prev > 0 && lifeTotal <= 0) {
      spawnBurst('defeat');
    }
  }, [lifeTotal, motionEnabled]);

  if (!motionEnabled) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-indigo-500/20 dark:bg-indigo-400/10 blur-[1px]"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animation: `float-particle ${particle.duration}s ease-in infinite`,
            animationDelay: `${particle.delay}s`
          }}
        />
      ))}

      {/* Event bursts radiate from the centre of the board. */}
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute left-1/2 top-1/2">
          {burst.particles.map((p) => (
            <span
              key={p.id}
              className="particle-burst"
              style={
                {
                  '--bx': '0px',
                  '--by': '0px',
                  '--bs': `${p.size}px`,
                  '--btx': `${p.tx}px`,
                  '--bty': `${p.ty}px`,
                  '--bd': `${p.duration}ms`,
                  backgroundColor: p.color
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
