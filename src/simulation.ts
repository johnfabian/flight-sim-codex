export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));
export interface Vec { x: number; y: number; z: number }
export interface Input { pitch: number; roll: number; yaw: number; throttle: number }
export interface Flight {
  position: Vec; previous: Vec; heading: number; pitch: number; roll: number;
  speed: number; throttle: number; verticalSpeed: number; elapsed: number;
  checkpoint: number; score: number; status: 'briefing' | 'flying' | 'paused' | 'crashed' | 'complete';
  mode: 'expedition' | 'free'; stall: boolean; distance: number;
}
export const islands = [
  { x: -1400, z: -1800, rx: 1650, rz: 2300, height: 570 },
  { x: 2050, z: -3700, rx: 1850, rz: 2100, height: 960 },
  { x: -1100, z: -6600, rx: 2000, rz: 1700, height: 780 },
  { x: 2800, z: -8200, rx: 1400, rz: 1800, height: 560 },
  { x: -3300, z: -4300, rx: 900, rz: 1400, height: 410 },
  { x: 3700, z: 700, rx: 1200, rz: 1700, height: 500 },
];
export function terrainHeight(x: number, z: number): number {
  let h = -25;
  for (const island of islands) {
    const dx = (x - island.x) / island.rx, dz = (z - island.z) / island.rz;
    const angle = Math.atan2(dz, dx);
    const r = Math.sqrt(dx * dx + dz * dz) * (1 + 0.09 * Math.sin(angle * 5) + 0.05 * Math.cos(angle * 9));
    if (r < 1) {
      const shape = Math.pow(1 - r, 1.65);
      const detail = Math.sin(x * .005 + z * .003) * .17 + Math.cos(z * .009 - x * .002) * .11 + Math.sin(x * .021 + z * .013) * .035;
      h = Math.max(h, shape * island.height * (1 + detail) - 7);
    }
  }
  // A flat coastal strip for the island airfield.
  if (x > -1020 && x < -720 && z > -440 && z < 290) {
    const edge = Math.min(x + 1020, -720 - x, z + 440, 290 - z);
    h = h + (13 - h) * clamp(edge / 65, 0, 1);
  }
  return h;
}
export const checkpoints: (Vec & { name: string })[] = [
  { x: 0, y: 280, z: -900, name: 'Into the blue' },
  { x: 80, y: 340, z: -2000, name: 'The channel' },
  { x: 0, y: 390, z: -3200, name: 'Between giants' },
  { x: -180, y: 440, z: -4500, name: 'Northern passage' },
  { x: -200, y: 790, z: -5700, name: 'Climb to the clouds' },
  { x: 700, y: 690, z: -6800, name: 'Over the ridge' },
  { x: 1600, y: 510, z: -7600, name: 'The far islands' },
  { x: 2200, y: 380, z: -9200, name: 'Edge of the world' },
];
export const GATE_RADIUS = 120;
export function createFlight(mode: Flight['mode'] = 'expedition'): Flight {
  return { position: { x: 0, y: 280, z: 380 }, previous: { x: 0, y: 280, z: 380 }, heading: 0, pitch: 0, roll: 0, speed: 67, throttle: .68, verticalSpeed: 0, elapsed: 0, checkpoint: 0, score: 0, status: 'briefing', mode, stall: false, distance: 0 };
}
export function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x-a.x, dy=b.y-a.y, dz=b.z-a.z;
  const length = dx*dx+dy*dy+dz*dz;
  const t = length ? clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/length,0,1) : 0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy,p.z-a.z-t*dz);
}
export function stepFlight(s: Flight, input: Input, delta: number, ground = terrainHeight): void {
  if (s.status !== 'flying') return;
  const dt = clamp(delta, 0, .05);
  s.previous = { ...s.position };
  s.throttle = clamp(s.throttle + input.throttle * dt * .28, 0, 1);
  s.roll = damp(s.roll, -input.roll * 1.05, 2.6, dt);
  s.pitch = damp(s.pitch, input.pitch * .47, 1.7, dt);
  s.heading += (Math.sin(s.roll) * .48 + input.yaw * .2) * dt;
  s.speed = damp(s.speed, 25 + s.throttle * 76 - Math.sin(s.pitch) * 22, .25, dt);
  s.stall = s.speed < 37;
  s.verticalSpeed = Math.sin(s.pitch) * s.speed - (s.stall ? (37 - s.speed) * 1.9 : 0);
  s.position.x -= Math.sin(s.heading) * Math.cos(s.pitch) * s.speed * dt;
  s.position.z -= Math.cos(s.heading) * Math.cos(s.pitch) * s.speed * dt;
  s.position.y += s.verticalSpeed * dt;
  s.distance += s.speed * dt;
  s.elapsed += dt;
  if (s.position.y < Math.max(0, ground(s.position.x, s.position.z)) + 3 || s.position.y > 3600 || Math.abs(s.position.x) > 14500 || Math.abs(s.position.z) > 18000) {
    s.status = 'crashed'; return;
  }
  if (s.mode === 'expedition' && s.checkpoint < checkpoints.length) {
    const gate = checkpoints[s.checkpoint];
    // Intersect the ring's plane so approaching its front does not collect it early.
    const crosses = s.previous.z >= gate.z && s.position.z < gate.z;
    const fraction = crosses ? (gate.z - s.previous.z) / (s.position.z - s.previous.z) : 0;
    const distance = crosses ? Math.hypot(
      s.previous.x + (s.position.x - s.previous.x) * fraction - gate.x,
      s.previous.y + (s.position.y - s.previous.y) * fraction - gate.y,
    ) : Infinity;
    if (distance < GATE_RADIUS) {
      s.score += Math.round(500 + 500 * (1 - distance / GATE_RADIUS));
      s.checkpoint++;
      if (s.checkpoint === checkpoints.length) s.status = 'complete';
    }
  }
}
