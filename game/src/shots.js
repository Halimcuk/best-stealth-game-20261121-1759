// The screenshot scenes behind ?shot=cover|hide|chase|win. Each one sets the real game
// state to a moment a real run reaches — a guard mid-patrol, Wren flat in a shadow, a
// chase at high alarm, the getaway — then the renderer paints it twice, so the frame is
// exactly what the game itself draws. No scene invents a sprite the game cannot show.

import { tileCenterX, tileCenterY } from './level.js';
import { SCREEN_PLAY, SCREEN_WIN } from './render.js';

function placeGuard(guard, col, row, facing, suspicion, stateName) {
  guard.x = tileCenterX(col);
  guard.y = tileCenterY(row);
  guard.facing = facing;
  guard.suspicion = suspicion;
  guard.state = stateName;
  guard.stateTimer = 0;
  guard.lastSeenX = guard.x;
  guard.lastSeenY = guard.y;
}

function collectOpals(world, count) {
  let taken = 0;
  for (const spot of world.state.loot) {
    if (taken >= count) break;
    spot.taken = true;
    taken += 1;
  }
  world.state.lootCollected = taken;
}

/**
 * Set `world` to the named scene and return the screen to draw over it. Any other name
 * is the cover: the whole game in one frame — museum rooms, guards with cones, loot,
 * shadows, crates, the exit and the alarm meter.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'hide') {
    // Wren flat in the west gallery's shadow while Ivo's cone sweeps just past.
    state.player.x = tileCenterX(11);
    state.player.y = tileCenterY(7);
    state.player.sneaking = true;
    state.player.facing = Math.PI;
    state.player.inShadow = true;
    state.player.hidden = true;
    placeGuard(state.guards[2], 7, 7, Math.PI, 34, 'investigate');
    placeGuard(state.guards[1], 18, 8, 0, 0, 'patrol');
    placeGuard(state.guards[0], 15, 3, -Math.PI / 2, 0, 'patrol');
    collectOpals(world, 1);
    state.alarm = 14;
    state.elapsed = 61;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // The near miss: Sable has Wren dead in his cone, the alarm nearly full, the exit far.
    state.player.x = tileCenterX(26);
    state.player.y = tileCenterY(10);
    state.player.facing = Math.PI;
    state.player.sprinting = true;
    placeGuard(state.guards[3], 24, 8, Math.PI / 2, 100, 'chase');
    placeGuard(state.guards[1], 18, 8, 0, 62, 'investigate');
    placeGuard(state.guards[4], 14, 15, 0, 0, 'patrol');
    state.guards[3].lastSeenX = state.player.x;
    state.guards[3].lastSeenY = state.player.y;
    collectOpals(world, 4);
    state.alarm = 78;
    state.elapsed = 132;
    state.everSpotted = true;
    state.spottedFlash = 1.2;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'win') {
    // The getaway: every opal pocketed, the exit reached, never spotted once.
    collectOpals(world, 5);
    state.player.x = tileCenterX(25);
    state.player.y = tileCenterY(1);
    state.elapsed = 187;
    state.everSpotted = false;
    state.status = 'won';
    state.score = world.finalScore();
    return { screen: SCREEN_WIN };
  }
  // Cover: mid-run in the central gallery. Marlowe's cone crosses Wren's path, Vesper
  // patrols the vault above, two opals are already pocketed, the alarm hums at 32.
  state.player.x = tileCenterX(15);
  state.player.y = tileCenterY(9);
  state.player.facing = -Math.PI / 2;
  placeGuard(state.guards[1], 20, 8, Math.PI, 46, 'investigate');
  state.guards[1].lastSeenX = state.player.x;
  state.guards[1].lastSeenY = state.player.y;
  placeGuard(state.guards[0], 14, 2, Math.PI / 2, 0, 'patrol');
  placeGuard(state.guards[2], 4, 9, 0, 0, 'patrol');
  placeGuard(state.guards[3], 26, 7, Math.PI, 0, 'patrol');
  placeGuard(state.guards[4], 11, 15, 0, 0, 'patrol');
  collectOpals(world, 2);
  state.alarm = 32;
  state.elapsed = 96;
  return { screen: SCREEN_PLAY };
}
