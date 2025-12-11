import type { Star } from '../models/Star';

export interface PhysicsState {
  positions: Map<string, { x: number; y: number }>;
  velocities: Map<string, { vx: number; vy: number }>;
}

export class GravityEngine {
  private G: number; // Гравитационная константа
  private timeStep: number;
  private damping: number; // Затухание для стабильности

  constructor(G: number = 0.5, timeStep: number = 0.016, damping: number = 0.99) {
    this.G = G;
    this.timeStep = timeStep;
    this.damping = damping;
  }

  // Расчёт силы притяжения между двумя звёздами
  private calculateForce(star1: Star, star2: Star, pos1: {x: number, y: number}, pos2: {x: number, y: number}): { fx: number; fy: number } {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const distSquared = dx * dx + dy * dy;
    const dist = Math.sqrt(distSquared);

    // Избегаем деления на ноль и слишком сильных сил на малых расстояниях
    const minDist = 50;
    const effectiveDist = Math.max(dist, minDist);
    const effectiveDistSquared = effectiveDist * effectiveDist;

    // F = G * m1 * m2 / r^2
    const forceMagnitude = (this.G * star1.mass * star2.mass) / effectiveDistSquared;

    // Нормализованный вектор направления
    const fx = (dx / effectiveDist) * forceMagnitude;
    const fy = (dy / effectiveDist) * forceMagnitude;

    return { fx, fy };
  }

  // Один шаг симуляции (метод Эйлера)
  step(stars: Star[], state: PhysicsState): PhysicsState {
    const newPositions = new Map(state.positions);
    const newVelocities = new Map(state.velocities);

    // Инициализация для новых звёзд
    stars.forEach(star => {
      if (!state.positions.has(star.id)) {
        newPositions.set(star.id, { x: star.x || 0, y: star.y || 0 });
        newVelocities.set(star.id, { vx: star.vx || 0, vy: star.vy || 0 });
      }
    });

    // Расчёт ускорений для каждой звезды
    const accelerations = new Map<string, { ax: number; ay: number }>();

    stars.forEach(star1 => {
      let totalFx = 0;
      let totalFy = 0;

      stars.forEach(star2 => {
        if (star1.id !== star2.id) {
          const pos1 = newPositions.get(star1.id)!;
          const pos2 = newPositions.get(star2.id)!;
          const { fx, fy } = this.calculateForce(star1, star2, pos1, pos2);
          totalFx += fx;
          totalFy += fy;
        }
      });

      // a = F / m
      const ax = totalFx / star1.mass;
      const ay = totalFy / star1.mass;
      accelerations.set(star1.id, { ax, ay });
    });

    // Обновление скоростей и позиций
    stars.forEach(star => {
      const vel = newVelocities.get(star.id)!;
      const pos = newPositions.get(star.id)!;
      const acc = accelerations.get(star.id)!;

      // v = v + a * dt
      let vx = vel.vx + acc.ax * this.timeStep;
      let vy = vel.vy + acc.ay * this.timeStep;

      // Применяем затухание
      vx *= this.damping;
      vy *= this.damping;

      // x = x + v * dt
      const x = pos.x + vx * this.timeStep;
      const y = pos.y + vy * this.timeStep;

      newVelocities.set(star.id, { vx, vy });
      newPositions.set(star.id, { x, y });
    });

    return {
      positions: newPositions,
      velocities: newVelocities
    };
  }

  setGravity(G: number) {
    this.G = G;
  }

  setTimeStep(dt: number) {
    this.timeStep = dt;
  }

  setDamping(d: number) {
    this.damping = d;
  }
}
