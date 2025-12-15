import type { Star } from '../models/Star';



export type NBodyParams = {
  G: number;
  eps: number;        // softening
  dt: number;         // seconds
  mergeDist: number;  // pixels
  lockSunId?: string; // optional: keep Sun fixed
};

function accelAll(stars: Star[], G: number, eps: number) {
  const ax = new Map<string, number>();
  const ay = new Map<string, number>();
  
  for (const a of stars) {
    let sx = 0, sy = 0;
    for (const b of stars) {
      if (a.id === b.id) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + eps * eps;
      const invR = 1 / Math.sqrt(r2);
      const invR3 = invR * invR * invR;

      const k = G * b.mass * invR3;
      sx += dx * k;
      sy += dy * k;
    }
    ax.set(a.id, sx);
    ay.set(a.id, sy);
  }

  return { ax, ay };
}

function mergeIfNeeded(stars: Star[], mergeDist: number) {
  const alive = [...stars];

  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx * dx + dy * dy > mergeDist * mergeDist) continue;

      const big = a.mass >= b.mass ? a : b;
      const small = a.mass >= b.mass ? b : a;

      const m = big.mass + small.mass;
      // inelastic merge: conserve momentum (m*v) [web:323]
      const vx = (big.vx * big.mass + small.vx * small.mass) / m;
      const vy = (big.vy * big.mass + small.vy * small.mass) / m;

      const merged: Star = { ...big, mass: m, vx, vy };

      const bigIndex = a.mass >= b.mass ? i : j;
      const smallIndex = a.mass >= b.mass ? j : i;

      alive[bigIndex] = merged;
      alive.splice(smallIndex, 1);
      j--;
    }
  }

  return alive;
}

// Leapfrog (kick-drift-kick) — хороший базовый симплектический интегратор для орбит [web:273]
export function stepNBodyLeapfrog(starsIn: Star[], p: NBodyParams): Star[] {
  // kick 1/2
  const { ax, ay } = accelAll(starsIn, p.G, p.eps);
  const kicked = starsIn.map((s) => ({
    ...s,
    vx: s.vx + (ax.get(s.id) ?? 0) * (p.dt / 2),
    vy: s.vy + (ay.get(s.id) ?? 0) * (p.dt / 2),
  }));

  // drift
  const drifted = kicked.map((s) => {
    if (p.lockSunId && s.id === p.lockSunId) return { ...s, vx: 0, vy: 0 };
    return { ...s, x: s.x + s.vx * p.dt, y: s.y + s.vy * p.dt };
  });

  // kick 2/2
  const { ax: ax2, ay: ay2 } = accelAll(drifted, p.G, p.eps);
  const out = drifted.map((s) => ({
    ...s,
    vx: s.vx + (ax2.get(s.id) ?? 0) * (p.dt / 2),
    vy: s.vy + (ay2.get(s.id) ?? 0) * (p.dt / 2),
  }));

  return mergeIfNeeded(out, p.mergeDist);
}

export function setCircularOrbitVelocity(body: Star, sun: Star, G: number) {
  const dx = body.x - sun.x;
  const dy = body.y - sun.y;
  const r = Math.sqrt(dx * dx + dy * dy) || 1;

  const v = Math.sqrt((G * sun.mass) / r);
  return { vx: (-dy / r) * v, vy: (dx / r) * v };
}
