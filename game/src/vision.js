// What a guard can see, and how fast it grows suspicious. A guard sees Wren only when
// Wren is inside its vision cone, in range, and with no wall or crate between them.
// Shadows and sneaking slow suspicion down; sprinting and standing close speed it up,
// so a near miss in the open is dangerous and a slow crawl through the dark is safe.

import { GUARD } from './config.js';
import { COLS, ORIGIN_Y, ROWS, TILE, isShadowAt, lineOfSightClear } from './level.js';

export function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** March a ray from (x, y) along `angle` until it hits a wall or runs out of range. */
export function castRay(level, x, y, angle, range) {
  const step = 6;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let distance = 0;
  while (distance < range) {
    distance += step;
    const px = x + dx * distance;
    const py = y + dy * distance;
    const col = Math.floor(px / TILE);
    const row = Math.floor((py - ORIGIN_Y) / TILE);
    const key = `${col},${row}`;
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS || level.walls.has(key) || level.crates.has(key)) {
      return Math.max(0, distance - step);
    }
  }
  return range;
}

/**
 * How fast this guard's suspicion should grow toward Wren right now, in points per
 * second; 0 when Wren cannot be seen at all. `player` carries x, y, sneaking and
 * sprinting; the world passes whether Wren is standing in shadow.
 */
export function suspicionRate(guard, player, level) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.sightRange) return 0;
  const angleToPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angleToPlayer, guard.facing)) > GUARD.sightHalfAngle) return 0;
  if (!lineOfSightClear(level, guard.x, guard.y, player.x, player.y)) return 0;
  // Closer is worse: full rate up close, about a third of it at the edge of the cone.
  const distanceFactor = 1 - 0.65 * (distance / GUARD.sightRange);
  let rate = GUARD.suspicionBaseRate * distanceFactor;
  if (isShadowAt(level, player.x, player.y)) rate *= 0.22;
  if (player.sneaking) rate *= 0.55;
  if (player.sprinting) rate *= 1.35;
  return rate;
}

/** True when the guard can see Wren at all, whatever the rate. */
export function guardSeesPlayer(guard, player, level) {
  return suspicionRate(guard, player, level) > 0;
}
