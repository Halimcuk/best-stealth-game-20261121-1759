// The run itself: Wren, the guards, the opals, the coins, the alarm and the win/lose
// rules, with no drawing and no browser in it. step() advances one fixed step and returns
// what happened as bit flags, so the caller can play sounds without the world knowing
// about screens or speakers. Nothing here allocates after createWorld returns.

import { ALARM, COINS, GUARD, LOOT, PLAYER } from './config.js';
import { GUARD_PATROLS, circleHitsSolid, isShadowAt, parseLevel } from './level.js';
import { alertGuardToNoise, createGuard, updateGuard } from './guards.js';

export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_COIN = 4;
export const EVENT_WIN = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_LOCKDOWN = 32;
export const EVENT_PLAYER_STEP = 64;
export const EVENT_GUARD_STEP = 128;
export const EVENT_EXIT_LOCKED = 256;

export const STATUS_PLAYING = 'playing';
export const STATUS_WON = 'won';
export const STATUS_CAUGHT = 'caught';
export const STATUS_LOCKDOWN = 'lockdown';

export function createWorld() {
  const level = parseLevel();
  const guards = GUARD_PATROLS.map(createGuard);
  const state = {
    level,
    guards,
    player: {
      x: level.spawn.x,
      y: level.spawn.y,
      facing: -Math.PI / 2,
      moving: false,
      sneaking: false,
      sprinting: false,
      inShadow: false,
      hidden: false,
      stepTimer: 0,
    },
    loot: level.loot.map((spot) => ({ ...spot })),
    lootCollected: 0,
    coins: COINS,
    coin: null,
    alarm: 0,
    elapsed: 0,
    status: STATUS_PLAYING,
    everSpotted: false,
    exitLockedFlash: 0,
    spottedFlash: 0,
    score: 0,
  };

  function reset() {
    state.player.x = level.spawn.x;
    state.player.y = level.spawn.y;
    state.player.facing = -Math.PI / 2;
    state.player.moving = false;
    state.player.sneaking = false;
    state.player.sprinting = false;
    state.player.inShadow = false;
    state.player.hidden = false;
    state.loot.forEach((spot, index) => {
      spot.taken = false;
      level.loot[index].taken = false;
    });
    state.lootCollected = 0;
    state.coins = COINS;
    state.coin = null;
    state.alarm = 0;
    state.elapsed = 0;
    state.status = STATUS_PLAYING;
    state.everSpotted = false;
    state.exitLockedFlash = 0;
    state.spottedFlash = 0;
    state.score = 0;
    state.guards.forEach((guard, index) => {
      const fresh = createGuard(GUARD_PATROLS[index]);
      Object.assign(guard, fresh);
    });
  }

  function movePlayer(dt, moveX, moveY, sneaking, sprinting) {
    const player = state.player;
    const speed = sneaking ? PLAYER.sneakSpeed : sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const length = Math.hypot(moveX, moveY);
    player.moving = length > 0.01;
    player.sneaking = sneaking && player.moving;
    player.sprinting = sprinting && player.moving && !sneaking;
    if (!player.moving) return 0;
    const nx = player.x + (moveX / length) * speed * dt;
    const ny = player.y + (moveY / length) * speed * dt;
    player.facing = Math.atan2(moveY, moveX);
    if (!circleHitsSolid(level, nx, player.y, PLAYER.radius)) player.x = nx;
    if (!circleHitsSolid(level, player.x, ny, PLAYER.radius)) player.y = ny;
    return speed * dt;
  }

  function finalScore() {
    const lootPoints = state.lootCollected * LOOT.pointsEach;
    const timeBonus = Math.max(0, Math.round(LOOT.timeBonusMax * (1 - state.elapsed / LOOT.timeBonusSeconds)));
    const ghostBonus = state.everSpotted ? 0 : LOOT.ghostBonus;
    return lootPoints + timeBonus + ghostBonus;
  }

  /**
   * One fixed step. `input` carries the move direction (-1..1 on each axis), whether Wren
   * is sneaking or sprinting, and a coin toss target ({x, y} in world pixels) or null.
   */
  function step(dt, input) {
    let events = 0;
    if (state.status !== STATUS_PLAYING) return events;
    state.elapsed += dt;
    if (state.exitLockedFlash > 0) state.exitLockedFlash -= dt;
    if (state.spottedFlash > 0) state.spottedFlash -= dt;

    const moved = movePlayer(dt, input.moveX, input.moveY, input.sneak, input.sprint);
    const player = state.player;
    player.inShadow = isShadowAt(level, player.x, player.y);

    // Footsteps: a soft tick on a steady beat, faster when sprinting, silent sneaking.
    if (player.moving && !player.sneaking) {
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = player.sprinting ? 0.24 : 0.36;
        events |= EVENT_PLAYER_STEP;
      }
    }

    // Sprinting is loud: every guard close enough turns toward the noise.
    if (player.sprinting && player.moving) {
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - player.x, guard.y - player.y) < PLAYER.sprintNoiseRadius) {
          alertGuardToNoise(guard, player.x, player.y, GUARD.suspiciousAt);
        }
      }
    }

    // A thrown coin pings where it lands and pulls the nearest guards over to look.
    if (input.toss && state.coins > 0 && !state.coin) {
      state.coins -= 1;
      const dx = input.toss.x - player.x;
      const dy = input.toss.y - player.y;
      const distance = Math.hypot(dx, dy);
      const reach = Math.min(distance, 280);
      const targetX = distance > 0 ? player.x + (dx / distance) * reach : player.x;
      const targetY = distance > 0 ? player.y + (dy / distance) * reach : player.y;
      state.coin = { x: targetX, y: targetY, timer: 0.9, ring: 0 };
      events |= EVENT_COIN;
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - targetX, guard.y - targetY) < GUARD.coinHearingRadius) {
          alertGuardToNoise(guard, targetX, targetY, GUARD.suspiciousAt + 10);
        }
      }
    }
    if (state.coin) {
      state.coin.timer -= dt;
      state.coin.ring += dt;
      if (state.coin.timer <= 0) state.coin = null;
    }

    // Opals: walk over one to pocket it.
    for (const spot of state.loot) {
      if (!spot.taken && Math.hypot(spot.x - player.x, spot.y - player.y) < PLAYER.pickupRadius) {
        spot.taken = true;
        state.lootCollected += 1;
        events |= EVENT_PICKUP;
      }
    }

    // Guards think, look and walk; a fresh chase is the moment the alarm matters.
    let anyChase = false;
    let anyUnease = false;
    let guardStepped = false;
    for (const guard of state.guards) {
      const result = updateGuard(guard, dt, player, level);
      if (result.justSpotted) {
        events |= EVENT_SPOTTED;
        state.everSpotted = true;
        state.spottedFlash = 1.2;
      }
      if (result.stepped) guardStepped = true;
      if (guard.state === 'chase') anyChase = true;
      else if (guard.state === 'investigate' || guard.state === 'search' || guard.suspicion > 0) anyUnease = true;
    }
    if (guardStepped) events |= EVENT_GUARD_STEP;

    // Hidden means unseen and standing in shadow: the safest a thief can be.
    const anySees = state.guards.some((guard) => guard.suspicion > 0);
    player.hidden = player.inShadow && !anySees && !anyChase;

    // The alarm climbs while guards hunt, cools while they are calm.
    if (anyChase) state.alarm += ALARM.chaseRate * dt;
    else if (anyUnease) state.alarm += ALARM.uneaseRate * dt;
    else state.alarm -= ALARM.coolRate * dt;
    state.alarm = Math.max(0, Math.min(ALARM.lockdownAt, state.alarm));

    // Caught on contact, or locked down at full alarm.
    for (const guard of state.guards) {
      if (Math.hypot(guard.x - player.x, guard.y - player.y) < PLAYER.catchRadius) {
        state.status = STATUS_CAUGHT;
        state.score = finalScore();
        return events | EVENT_CAUGHT;
      }
    }
    if (state.alarm >= ALARM.lockdownAt) {
      state.status = STATUS_LOCKDOWN;
      state.score = finalScore();
      return events | EVENT_LOCKDOWN;
    }

    // The exit: reach it with enough opals and the night is yours.
    const exit = level.exit;
    const insideExit =
      player.x > exit.x && player.x < exit.x + exit.width &&
      player.y > exit.y && player.y < exit.y + exit.height;
    if (insideExit) {
      if (state.lootCollected >= LOOT.neededToEscape) {
        state.status = STATUS_WON;
        state.score = finalScore();
        return events | EVENT_WIN;
      }
      if (state.exitLockedFlash <= 0) {
        state.exitLockedFlash = 1.6;
        events |= EVENT_EXIT_LOCKED;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, finalScore };
}
