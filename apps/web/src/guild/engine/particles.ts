const DUST = ["#75679a", "#9a8cba"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  color: string;
  size: number;
}

export class Particles {
  private readonly particles: Particle[] = [];

  clear() {
    this.particles.length = 0;
  }

  puff(x: number, y: number, count: number, spread: number, up: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * spread,
        vy: -Math.random() * up,
        gravity: 160,
        life: 0.22 + Math.random() * 0.2,
        color: DUST[i % DUST.length]!,
        size: Math.random() < 0.5 ? 2 : 1,
      });
    }
  }

  sparks(x: number, y: number, accent: string) {
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      this.particles.push({
        x: x + i * 2,
        y,
        vx: i * 18,
        vy: 6,
        gravity: 0,
        life: 0.18 + Math.abs(i) * 0.03,
        color: i % 2 ? "#ffffff" : accent,
        size: Math.abs(i) < 3 ? 2 : 1,
      });
    }
  }

  step(dt: number) {
    let count = 0;
    for (const particle of this.particles) {
      particle.life -= dt;
      if (particle.life <= 0) continue;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      this.particles[count++] = particle;
    }
    this.particles.length = count;
  }

  draw(context: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    for (const particle of this.particles) {
      context.fillStyle = particle.color;
      context.fillRect(
        Math.round(particle.x) - cameraX,
        Math.round(particle.y) - cameraY,
        particle.size,
        particle.size,
      );
    }
  }
}
