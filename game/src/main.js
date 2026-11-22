// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, paused, win, caught and
// lockdown. The title screen runs the museum as a quiet backdrop, guards on patrol.
//
// ?seed=N fixes the run's randomness. ?shot=cover|hide|chase|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot. window.__velvet exposes the live world for play-testing.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_COIN, EVENT_EXIT_LOCKED, EVENT_GUARD_STEP, EVENT_LOCKDOWN, EVENT_PICKUP, EVENT_PLAYER_STEP, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_LOCKDOWN, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  best = 0;
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (clientX, clientY) => renderer.toWorld(clientX, clientY));
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    input.takeToss();
    announce('Playing. Steal three opals, then reach the exit unseen.');
  }

  function endGame(nextScreen, message) {
    screen = nextScreen;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(message);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMuted();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_CAUGHT || screen === SCREEN_LOCKDOWN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playEvents(events) {
    const player = world.state.player;
    if (events & EVENT_PLAYER_STEP) audio.playerStep(player.sprinting);
    if (events & EVENT_GUARD_STEP) {
      // The nearest guard's step, panned by which side of Wren it walks on.
      let nearest = null;
      let nearestDistance = Infinity;
      for (const guard of world.state.guards) {
        const distance = Math.hypot(guard.x - player.x, guard.y - player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = guard;
        }
      }
      if (nearest && nearestDistance < 300) {
        audio.guardStep(
          Math.max(-1, Math.min(1, (nearest.x - player.x) / 280)),
          Math.max(0, 1 - nearestDistance / 300),
        );
      }
    }
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_COIN) audio.coinPing();
    if (events & EVENT_SPOTTED) {
      audio.alertSting();
      announce('Spotted! Break line of sight!');
    }
    if (events & EVENT_EXIT_LOCKED) {
      audio.exitLocked();
      announce('The exit is locked. Steal more opals first.');
    }
    if (events & EVENT_WIN) {
      audio.win();
      endGame(SCREEN_WIN, `Clean getaway. Score ${world.state.score}.`);
    } else if (events & EVENT_CAUGHT) {
      audio.lose();
      endGame(SCREEN_CAUGHT, `Caught. Score ${world.state.score}.`);
    } else if (events & EVENT_LOCKDOWN) {
      audio.lose();
      endGame(SCREEN_LOCKDOWN, `Lockdown. The alarm hit 100. Score ${world.state.score}.`);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the guards patrol the empty museum behind the title.
      const idle = { moveX: 0, moveY: 0, sneak: false, sprint: false, toss: null };
      const player = world.state.player;
      const savedX = player.x;
      const savedY = player.y;
      player.x = -100;
      player.y = -100;
      world.step(STEP, idle);
      player.x = savedX;
      player.y = savedY;
      return;
    }
    const direction = input.moveDirection();
    const events = world.step(STEP, {
      moveX: direction.x,
      moveY: direction.y,
      sneak: input.sneaking,
      sprint: input.sprinting,
      toss: input.takeToss(),
    });
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, input.mouse);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Play-testing hooks: the live world, the screen, and small debug helpers.
  window.__velvet = {
    world,
    get screen() {
      return screen;
    },
    start: startGame,
    debug: {
      teleport(x, y) {
        world.state.player.x = x;
        world.state.player.y = y;
      },
      setAlarm(value) {
        world.state.alarm = value;
      },
      collect(count) {
        let taken = 0;
        for (const spot of world.state.loot) {
          if (taken >= count) break;
          if (!spot.taken) {
            spot.taken = true;
            taken += 1;
          }
        }
        world.state.lootCollected += taken;
      },
    },
  };

  announce('Velvet Vault. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
