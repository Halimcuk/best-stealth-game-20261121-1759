// Everything the eye sees, drawn on one canvas with procedural art: no image files, no
// borrowed art. The museum floor is tiled parquet with rugs; shadows are dark pools with
// dotted edges; each guard's vision cone is raycast against the walls, so the cone you see
// is exactly the cone the guard sees through. The HUD bar carries the opals, the coins,
// the alarm meter and the clock, and every screen is painted here too.

import { FIELD, FONT, LOOT, PALETTE, PLAYER } from './config.js';
import { COLS, ORIGIN_X, ORIGIN_Y, ROWS, TILE } from './level.js';
import { castRay } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LOCKDOWN = 'lockdown';

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  }

  function view() {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    return { scale, offsetX, offsetY };
  }

  /** Convert a pointer position in CSS pixels to world pixels. */
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { scale, offsetX, offsetY } = view();
    return {
      x: ((clientX - rect.left) * dpr - offsetX) / scale,
      y: ((clientY - rect.top) * dpr - offsetY) / scale,
    };
  }

  function drawFloor(level) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = ORIGIN_X + col * TILE;
        const y = ORIGIN_Y + row * TILE;
        const key = `${col},${row}`;
        if (level.walls.has(key)) continue;
        ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floorLight : PALETTE.floorDark;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
    // Rugs: the central gallery and the vault, where the marble gives way to carpet.
    ctx.fillStyle = PALETTE.rug;
    ctx.fillRect(500, 352, 280, 144);
    ctx.fillRect(520, 108, 240, 72);
    ctx.strokeStyle = PALETTE.rugEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(500, 352, 280, 144);
    ctx.strokeRect(520, 108, 240, 72);
    // Shadow pools: dark, dotted-edged, and labelled so they read at a glance.
    for (const key of level.shadows) {
      const [col, row] = key.split(',').map(Number);
      const x = ORIGIN_X + col * TILE;
      const y = ORIGIN_Y + row * TILE;
      ctx.fillStyle = PALETTE.shadow;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = PALETTE.shadowEdge;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(120, 160, 220, 0.5)';
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    for (const key of level.shadows) {
      const [col, row] = key.split(',').map(Number);
      ctx.fillText('SHADOW', ORIGIN_X + col * TILE + TILE / 2, ORIGIN_Y + row * TILE + TILE / 2 + 4);
    }
  }

  function drawWallsAndCrates(level) {
    for (const key of level.walls) {
      const [col, row] = key.split(',').map(Number);
      const x = ORIGIN_X + col * TILE;
      const y = ORIGIN_Y + row * TILE;
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(x, y, TILE, 4);
    }
    for (const key of level.crates) {
      const [col, row] = key.split(',').map(Number);
      const x = ORIGIN_X + col * TILE + 3;
      const y = ORIGIN_Y + row * TILE + 3;
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(x, y, TILE - 6, TILE - 6);
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, TILE - 6, TILE - 6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + TILE - 6, y + TILE - 6);
      ctx.moveTo(x + TILE - 6, y);
      ctx.lineTo(x, y + TILE - 6);
      ctx.stroke();
    }
  }

  function drawExit(level, lootCollected) {
    const exit = level.exit;
    const unlocked = lootCollected >= LOOT.neededToEscape;
    const pulse = 0.22 + 0.1 * Math.sin(performance.now() / 300);
    ctx.fillStyle = `rgba(88, 214, 141, ${pulse})`;
    ctx.fillRect(exit.x - 8, exit.y - 8, exit.width + 16, exit.height + 16);
    ctx.fillStyle = unlocked ? PALETTE.exit : '#3f7d5a';
    ctx.fillRect(exit.x + 4, exit.y, exit.width - 8, exit.height);
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 2;
    ctx.strokeRect(exit.x + 4, exit.y, exit.width - 8, exit.height);
    ctx.fillStyle = '#0b0e16';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x + exit.width / 2, exit.y + exit.height / 2 + 4);
    if (!unlocked) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `11px ${FONT}`;
      ctx.fillText(
        `LOCKED · NEED ${LOOT.neededToEscape - lootCollected} MORE`,
        exit.x + exit.width / 2,
        exit.y - 10,
      );
    }
  }

  function drawLoot(state, time) {
    for (const spot of state.loot) {
      if (spot.taken) continue;
      const glow = 10 + 4 * Math.sin(time / 240 + spot.x);
      ctx.fillStyle = PALETTE.lootGlow;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, glow + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.moveTo(spot.x, spot.y - 11);
      ctx.lineTo(spot.x + 8, spot.y);
      ctx.lineTo(spot.x, spot.y + 11);
      ctx.lineTo(spot.x - 8, spot.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawCone(guard, level) {
    const range = 222;
    const halfAngle = 0.63;
    const rays = 26;
    let fill = PALETTE.coneCalm;
    let edge = PALETTE.coneCalmEdge;
    if (guard.state === 'chase') {
      fill = PALETTE.coneAlert;
      edge = 'rgba(229, 83, 75, 0.7)';
    } else if (guard.state === 'investigate' || guard.state === 'search' || guard.suspicion > 0) {
      fill = PALETTE.coneSuspicious;
      edge = 'rgba(250, 166, 52, 0.65)';
    }
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    for (let i = 0; i <= rays; i += 1) {
      const angle = guard.facing - halfAngle + (2 * halfAngle * i) / rays;
      const distance = castRay(level, guard.x, guard.y, angle, range);
      ctx.lineTo(guard.x + Math.cos(angle) * distance, guard.y + Math.sin(angle) * distance);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawGuard(guard) {
    // Body: a maroon coat, easy to tell apart from the teal thief and the floor.
    ctx.fillStyle = PALETTE.guardBody;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e231f';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Nose: where the guard is looking.
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(guard.x + Math.cos(guard.facing) * 20, guard.y + Math.sin(guard.facing) * 20);
    ctx.lineTo(guard.x + Math.cos(guard.facing + 2.5) * 10, guard.y + Math.sin(guard.facing + 2.5) * 10);
    ctx.lineTo(guard.x + Math.cos(guard.facing - 2.5) * 10, guard.y + Math.sin(guard.facing - 2.5) * 10);
    ctx.closePath();
    ctx.fill();
    // Name, and a suspicion arc that fills as the guard grows sure of you.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(guard.name, guard.x, guard.y - 22);
    if (guard.suspicion > 1) {
      ctx.strokeStyle = guard.suspicion >= 55 ? '#f2a634' : '#f2c94c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 19, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    if (guard.state === 'chase') {
      ctx.fillStyle = '#ff6b61';
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText('!', guard.x, guard.y - 30);
    } else if (guard.state === 'investigate' || guard.state === 'search') {
      ctx.fillStyle = '#f2c94c';
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillText('?', guard.x, guard.y - 30);
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (player.hidden) {
      ctx.strokeStyle = 'rgba(88, 214, 141, 0.8)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = PALETTE.exit;
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN', player.x, player.y + PLAYER.radius + 16);
    }
    // Wren: a teal hooded figure, cloak trailing behind the direction of travel.
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.moveTo(player.x - Math.cos(player.facing) * 16, player.y - Math.sin(player.facing) * 16);
    ctx.lineTo(player.x + Math.cos(player.facing + 2.2) * 12, player.y + Math.sin(player.facing + 2.2) * 12);
    ctx.lineTo(player.x + Math.cos(player.facing - 2.2) * 12, player.y + Math.sin(player.facing - 2.2) * 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b3d38';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0b3d38';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.facing) * 5, player.y + Math.sin(player.facing) * 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (player.sneaking) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SNEAKING', player.x, player.y + PLAYER.radius + 14);
    }
    void time;
  }

  function drawCoin(state) {
    if (!state.coin) return;
    const coin = state.coin;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = `rgba(242, 201, 76, ${Math.max(0, 1 - coin.ring)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 8 + coin.ring * 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHud(state) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('VELVET VAULT', 18, 28);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('a moonlight heist', 18, 48);

    ctx.fillStyle = PALETTE.loot;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`◆ OPALS ${state.lootCollected}/5`, 268, 30);
    ctx.fillStyle = state.lootCollected >= LOOT.neededToEscape ? PALETTE.exit : PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(state.lootCollected >= LOOT.neededToEscape ? 'exit unlocked' : `need ${LOOT.neededToEscape} to escape`, 268, 49);

    ctx.fillStyle = '#f2c94c';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`● COINS ${state.coins}`, 470, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('click to toss · lures guards', 470, 49);

    // The alarm meter: green, amber, then red as the museum wakes up.
    const alarmX = 700;
    const alarmWidth = 260;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText('ALARM', alarmX, 30);
    ctx.fillStyle = '#0b0e16';
    ctx.fillRect(alarmX + 70, 16, alarmWidth, 16);
    const alarmColor = state.alarm < 40 ? PALETTE.alarmLow : state.alarm < 75 ? PALETTE.alarmMid : PALETTE.alarmHigh;
    ctx.fillStyle = alarmColor;
    ctx.fillRect(alarmX + 70, 16, (alarmWidth * state.alarm) / 100, 16);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(alarmX + 70, 16, alarmWidth, 16);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    ctx.fillText('100 = lockdown', alarmX + 70, 49);

    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(state.elapsed), FIELD.width - 18, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT}`;
    // Mid-run the score is the loot banked so far; once the run ends it is the final score.
    ctx.fillText(`score ${state.status === 'playing' ? state.lootCollected * LOOT.pointsEach : state.score}`, FIELD.width - 18, 49);
    ctx.textAlign = 'left';

    // Objective line along the bottom, always in view.
    ctx.fillStyle = 'rgba(11, 14, 22, 0.75)';
    ctx.fillRect(0, FIELD.height - 26, FIELD.width, 26);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      'Steal 3+ moon opals, then reach the green EXIT unseen · WASD move · Shift sneak · Space sprint (loud!) · M mute · P pause',
      FIELD.width / 2,
      FIELD.height - 8,
    );
    ctx.textAlign = 'left';
  }

  function drawBanners(state) {
    if (state.spottedFlash > 0) {
      ctx.fillStyle = `rgba(229, 83, 75, ${Math.min(1, state.spottedFlash)})`;
      ctx.font = `bold 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED!', FIELD.width / 2, 118);
      ctx.textAlign = 'left';
    }
    if (state.exitLockedFlash > 0) {
      ctx.fillStyle = PALETTE.alarmMid;
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `EXIT LOCKED — STEAL ${LOOT.neededToEscape - state.lootCollected} MORE OPAL${LOOT.neededToEscape - state.lootCollected === 1 ? '' : 'S'}`,
        FIELD.width / 2,
        150,
      );
      ctx.textAlign = 'left';
    }
  }

  function drawPanel(title, lines, accent) {
    ctx.fillStyle = 'rgba(11, 14, 22, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const panelWidth = 720;
    const panelHeight = 130 + lines.length * 30;
    const x = (FIELD.width - panelWidth) / 2;
    const y = (FIELD.height - panelHeight) / 2;
    ctx.fillStyle = '#171c2c';
    ctx.fillRect(x, y, panelWidth, panelHeight);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, panelWidth, panelHeight);
    ctx.fillStyle = accent;
    ctx.font = `bold 44px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, y + 62);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, y + 104 + index * 30);
    });
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    drawPanel('VELVET VAULT', [
      'Wren the cat-burglar slips into the Gulliver Museum after dark.',
      'Five moon opals glitter in the vault. Steal at least three, then reach the EXIT — unseen.',
      'Guards patrol with lantern cones. Shadows hide you. Crates block their sight.',
      'Sneak slow and silent, or sprint loud and fast. Toss a coin to pull a guard away.',
      'If the ALARM reaches 100, the museum locks down. If a guard touches you, it is over.',
      'WASD / arrows move · Shift sneak · Space sprint · Click tosses a coin · P pause · M mute',
      best > 0 ? `Best score: ${best}` : 'No score yet — make this night count.',
      'Press ENTER or click to begin.',
    ], PALETTE.player);
    void state;
  }

  function drawEnd(title, lines, accent) {
    drawPanel(title, lines, accent);
  }

  /** Paint one frame. `screen` is one of the SCREEN_* constants; `mouse` is the world-space cursor. */
  function draw(state, screen, best, mouse) {
    resize();
    const { scale, offsetX, offsetY } = view();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    const time = performance.now();
    drawFloor(state.level);
    drawExit(state.level, state.lootCollected);
    drawLoot(state, time);
    for (const guard of state.guards) drawCone(guard, state.level);
    drawWallsAndCrates(state.level);
    drawCoin(state);
    for (const guard of state.guards) drawGuard(guard);
    drawPlayer(state, time);
    drawHud(state);
    drawBanners(state);
    if (screen === SCREEN_PLAY && mouse && state.coins > 0 && state.status === 'playing') {
      ctx.strokeStyle = 'rgba(242, 201, 76, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawEnd('PAUSED', ['Take a breath. The guards keep their patrols.', 'Press P or ENTER to slip back into the dark.'], PALETTE.muted);
    else if (screen === SCREEN_WIN) {
      drawEnd('CLEAN GETAWAY', [
        `Opals stolen: ${state.lootCollected} of 5 · time ${formatTime(state.elapsed)}`,
        state.everSpotted ? 'The museum saw you — but you were faster.' : 'GHOST: never spotted once. The perfect night. (+400)',
        `Score: ${state.score}`,
        best > 0 ? `Best score: ${Math.max(best, state.score)}` : '',
        'Press ENTER or click to steal again.',
      ].filter(Boolean), PALETTE.exit);
    } else if (screen === SCREEN_CAUGHT) {
      drawEnd('CAUGHT!', [
        'A guard laid a hand on Wren\'s shoulder. The night ends in the museum cellar.',
        `Opals stolen: ${state.lootCollected} of 5 · score ${state.score}`,
        'Press ENTER or click to try the night again.',
      ], PALETTE.banner);
    } else if (screen === SCREEN_LOCKDOWN) {
      drawEnd('LOCKDOWN', [
        'The alarm hit 100. Shutters slam, lights blaze, and every door seals shut.',
        `Opals stolen: ${state.lootCollected} of 5 · score ${state.score}`,
        'Slower next time: shadows, patience, and one coin at a time.',
        'Press ENTER or click to try the night again.',
      ], PALETTE.banner);
    }
  }

  return { draw, resize, toWorld };
}
