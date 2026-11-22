// Guard brains: patrol, investigate, chase and search. A guard walks its patrol loop and
// looks where it walks. Suspicion makes it leave the loop to check the last place it saw
// Wren; a full alarm makes it chase. Lose it — break line of sight and stay quiet — and it
// searches the spot, scans, and walks back to its patrol, giving Wren a second chance.

import { GUARD } from './config.js';
import { circleHitsSolid, tileCenterX, tileCenterY } from './level.js';
import { suspicionRate } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';

function moveToward(guard, targetX, targetY, speed, dt, level) {
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return 0;
  const step = Math.min(distance, speed * dt);
  const nx = guard.x + (dx / distance) * step;
  const ny = guard.y + (dy / distance) * step;
  // Axis-separated sliding so a guard never clips through a wall corner.
  if (!circleHitsSolid(level, nx, guard.y, 12)) guard.x = nx;
  if (!circleHitsSolid(level, guard.x, ny, 12)) guard.y = ny;
  guard.facing = Math.atan2(dy, dx);
  return step;
}

export function createGuard(def) {
  const waypoints = def.waypoints.map(([col, row]) => ({ x: tileCenterX(col), y: tileCenterY(row) }));
  const start = waypoints[0];
  const next = waypoints[1] ?? waypoints[0];
  return {
    name: def.name,
    waypoints,
    waypointIndex: 1 % waypoints.length,
    x: start.x,
    y: start.y,
    facing: Math.atan2(next.y - start.y, next.x - start.x),
    speed: GUARD.patrolSpeed,
    state: GUARD_PATROL,
    suspicion: 0,
    stateTimer: 0,
    lastSeenX: start.x,
    lastSeenY: start.y,
    lostSightTimer: 0,
    scanAngle: 0,
    stepTimer: 0,
  };
}

/** Point this guard at a noise (a sprinting footstep, a thrown coin) and send it to look. */
export function alertGuardToNoise(guard, x, y, suspicionBump) {
  if (guard.state === GUARD_CHASE) return;
  guard.lastSeenX = x;
  guard.lastSeenY = y;
  guard.suspicion = Math.max(guard.suspicion, suspicionBump);
  if (guard.state === GUARD_PATROL) {
    guard.state = GUARD_INVESTIGATE;
    guard.stateTimer = 0;
  }
}

/**
 * One fixed step of one guard. Returns an event flag for the world: whether this guard
 * just started chasing (a fresh spot) and whether it took a footstep this step.
 */
export function updateGuard(guard, dt, player, level) {
  let justSpotted = false;
  const rate = suspicionRate(guard, player, level);
  if (rate > 0) {
    guard.suspicion = Math.min(GUARD.alertAt, guard.suspicion + rate * dt);
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    guard.lostSightTimer = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt);
    guard.lostSightTimer += dt;
  }

  if (guard.state !== GUARD_CHASE && guard.suspicion >= GUARD.alertAt) {
    guard.state = GUARD_CHASE;
    guard.stateTimer = 0;
    justSpotted = true;
  } else if (
    guard.state === GUARD_PATROL &&
    guard.suspicion >= GUARD.suspiciousAt
  ) {
    guard.state = GUARD_INVESTIGATE;
    guard.stateTimer = 0;
  }

  let stepped = false;
  guard.stepTimer -= dt;
  const noteStep = (moved) => {
    if (moved > 0.5 && guard.stepTimer <= 0) {
      guard.stepTimer = 0.42;
      stepped = true;
    }
  };

  if (guard.state === GUARD_PATROL) {
    const target = guard.waypoints[guard.waypointIndex];
    const moved = moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, level);
    noteStep(moved);
    if (Math.hypot(target.x - guard.x, target.y - guard.y) < 6) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    }
  } else if (guard.state === GUARD_INVESTIGATE) {
    const moved = moveToward(guard, guard.lastSeenX, guard.lastSeenY, GUARD.investigateSpeed, dt, level);
    noteStep(moved);
    if (Math.hypot(guard.lastSeenX - guard.x, guard.lastSeenY - guard.y) < 10) {
      guard.state = GUARD_SEARCH;
      guard.stateTimer = 0;
      guard.scanAngle = guard.facing;
    }
  } else if (guard.state === GUARD_CHASE) {
    if (rate > 0) {
      const moved = moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt, level);
      noteStep(moved);
    } else if (guard.lostSightTimer > GUARD.chaseMemory) {
      guard.state = GUARD_SEARCH;
      guard.stateTimer = 0;
      guard.scanAngle = guard.facing;
    } else {
      const moved = moveToward(guard, guard.lastSeenX, guard.lastSeenY, GUARD.chaseSpeed, dt, level);
      noteStep(moved);
    }
    if (guard.suspicion < GUARD.suspiciousAt && guard.lostSightTimer > GUARD.chaseMemory) {
      guard.state = GUARD_SEARCH;
      guard.stateTimer = 0;
    }
  } else if (guard.state === GUARD_SEARCH) {
    guard.stateTimer += dt;
    // Scan the room: slowly sweep the vision cone back and forth.
    guard.facing = guard.scanAngle + Math.sin(guard.stateTimer * 1.6) * 1.1;
    if (guard.stateTimer > GUARD.searchSeconds) {
      guard.state = GUARD_PATROL;
      guard.stateTimer = 0;
      // Walk back to the nearest waypoint instead of cutting across the museum.
      let best = 0;
      let bestDistance = Infinity;
      guard.waypoints.forEach((point, index) => {
        const d = Math.hypot(point.x - guard.x, point.y - guard.y);
        if (d < bestDistance) {
          bestDistance = d;
          best = index;
        }
      });
      guard.waypointIndex = best;
    }
  }

  // A calm guard forgets: suspicion only sticks while something keeps feeding it.
  if (guard.state === GUARD_PATROL && guard.suspicion < GUARD.suspiciousAt) {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionDecay * dt * 0.5);
  }
  return { justSpotted, stepped };
}
