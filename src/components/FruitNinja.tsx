import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  time: number;
}

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  emoji: string;
  color: string;
  rotation: number;
  rotationSpeed: number;
  isSliced: boolean;
  halves: Half[];
}

interface Half {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  isTop: boolean;
  sliceAngle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const FRUIT_TYPES = [
  { emoji: '🍎', color: '#ef4444' }, // Red
  { emoji: '🍊', color: '#f97316' }, // Orange
  { emoji: '🍉', color: '#ef4444' }, // Red
  { emoji: '🍇', color: '#a855f7' }, // Purple
  { emoji: '🍑', color: '#f472b6' }, // Pink
  { emoji: '🥝', color: '#84cc16' }, // Green
  { emoji: '🍋', color: '#eab308' }, // Yellow
];

export const FruitNinja: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let fruits: Fruit[] = [];
    let particles: Particle[] = [];
    let bladeTrail: Point[] = [];
    let lastSpawnTime = 0;
    let fruitIdCounter = 0;

    // --- Physics & Game Constants ---
    const GRAVITY = 0.15;
    const SPAWN_RATE = 800; // ms (faster spawn)
    const BLADE_LIFE = 150; // ms

    // --- Input Handling ---
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      // Allow slightly out of bounds tracking to catch fast swipes
      if (x >= -50 && x <= canvas.width + 50 && y >= -50 && y <= canvas.height + 50) {
        bladeTrail.push({ x, y, time: Date.now() });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove, { passive: true });

    // --- Helper: Line-Circle Collision ---
    const distToSegmentSquared = (p: Point, v: Point, w: Point) => {
      const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
      if (l2 === 0) return Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2);
      let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) + Math.pow(p.y - (v.y + t * (w.y - v.y)), 2);
    };

    const checkSlice = (fruit: Fruit, p1: Point, p2: Point) => {
      if (fruit.isSliced) return false;
      const distSq = distToSegmentSquared({ x: fruit.x, y: fruit.y, time: 0 }, p1, p2);
      return distSq <= Math.pow(fruit.size / 2, 2);
    };

    // --- Jackpot Event ---
    const handleJackpot = () => {
      const startTime = Date.now();
      const duration = 12000; // 12 seconds

      const spawnSlowFruit = () => {
        const elapsed = Date.now() - startTime;
        if (elapsed < duration) {
          const type = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
          fruits.push({
            id: fruitIdCounter++,
            x: Math.random() * canvas.width,
            y: -50, // Start from top
            vx: 0, // No horizontal movement for orderly fall
            vy: 0.8, // Constant slow vertical speed
            size: 60 + Math.random() * 20, // Larger size
            emoji: type.emoji,
            color: type.color,
            rotation: 0, // No rotation for orderly fall
            rotationSpeed: 0,
            isSliced: false,
            halves: []
          });
          
          // Spawn interval: more frequent spawn for continuous flow
          setTimeout(spawnSlowFruit, 400 + Math.random() * 200);
        }
      };
      
      spawnSlowFruit();
    };
    window.addEventListener('fruit-jackpot', handleJackpot);

    // --- Game Loop ---
    const render = (timestamp: number) => {
      // Auto-resize canvas to match its CSS size
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Spawn Fruits (Removed automatic spawning)
      lastSpawnTime = timestamp;

      // 2. Update & Draw Blade
      const now = Date.now();
      bladeTrail = bladeTrail.filter(p => now - p.time < BLADE_LIFE);
      
      if (bladeTrail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(bladeTrail[0].x, bladeTrail[0].y);
        for (let i = 1; i < bladeTrail.length; i++) {
          ctx.lineTo(bladeTrail[i].x, bladeTrail[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      // 3. Update & Draw Fruits
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];

        if (!f.isSliced) {
          // Physics
          f.x += f.vx;
          f.y += f.vy;
          // Apply gravity only if not a slow-falling fruit (or reduce gravity for them)
          f.vy += GRAVITY * 0.2; // Reduced gravity for slow effect
          f.rotation += f.rotationSpeed;

          // Check Slicing
          if (bladeTrail.length > 1) {
            const p1 = bladeTrail[bladeTrail.length - 2];
            const p2 = bladeTrail[bladeTrail.length - 1];
            if (checkSlice(f, p1, p2)) {
              f.isSliced = true;
              const sliceAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
              
              // Create halves
              const speed = 4;
              f.halves = [
                { x: f.x, y: f.y, vx: f.vx + Math.cos(sliceAngle - Math.PI/2) * speed, vy: f.vy + Math.sin(sliceAngle - Math.PI/2) * speed, rotation: f.rotation, rotationSpeed: f.rotationSpeed - 0.15, isTop: true, sliceAngle },
                { x: f.x, y: f.y, vx: f.vx + Math.cos(sliceAngle + Math.PI/2) * speed, vy: f.vy + Math.sin(sliceAngle + Math.PI/2) * speed, rotation: f.rotation, rotationSpeed: f.rotationSpeed + 0.15, isTop: false, sliceAngle }
              ];

              // Create particles
              for (let p = 0; p < 20; p++) {
                particles.push({
                  x: f.x,
                  y: f.y,
                  vx: f.vx + (Math.random() - 0.5) * 12,
                  vy: f.vy + (Math.random() - 0.5) * 12,
                  life: 1,
                  maxLife: 20 + Math.random() * 30,
                  color: f.color,
                  size: Math.random() * 8 + 3
                });
              }
            }
          }

          // Draw whole fruit
          if (!f.isSliced) {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.rotation);
            ctx.font = `${f.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f.emoji, 0, 0);
            ctx.restore();
          }
        } else {
          // Update and draw halves
          f.halves.forEach(half => {
            half.x += half.vx;
            half.y += half.vy;
            half.vy += GRAVITY;
            half.rotation += half.rotationSpeed;

            ctx.save();
            ctx.translate(half.x, half.y);
            ctx.rotate(half.sliceAngle); // Align with slice
            
            // Clip half
            ctx.beginPath();
            if (half.isTop) {
              ctx.rect(-f.size * 1.5, -f.size * 1.5, f.size * 3, f.size * 1.5);
            } else {
              ctx.rect(-f.size * 1.5, 0, f.size * 3, f.size * 1.5);
            }
            ctx.clip();

            // Draw fruit inside clip
            ctx.rotate(-half.sliceAngle + half.rotation); // Apply original rotation relative to slice
            ctx.font = `${f.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(f.emoji, 0, 0);
            ctx.restore();
          });
        }

        // Remove if off screen
        if (f.y > canvas.height + 150) {
          fruits.splice(i, 1);
        }
      }

      // 4. Update & Draw Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += GRAVITY;
        p.life++;

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const opacity = 1; // Keep fully visible
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}FF`; // Full opacity
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('fruit-jackpot', handleJackpot);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ touchAction: 'none' }}
    />
  );
};
