// The Gulliver Museum at night, as a tile map. One character per 40 px tile:
//   #  wall (blocks movement and sight)
//   .  open floor
//   s  shadow floor (dark patches: guards spot Wren far slower there)
//   C  crate (cover: blocks movement and sight, hide behind it)
//   L  a moon opal (loot)
//   P  Wren's starting tile
//   E  the exit door
// The museum has three ways up from the entrance hall to the vault: the west stairs,
// the central gallery doors and the east stairs, so a patient thief can always pick
// the route whose guards are looking elsewhere.

export const TILE = 40;
export const ORIGIN_X = 0;
export const ORIGIN_Y = 72;
export const COLS = 32;
export const ROWS = 18;

const MAP = [
  '################################',
  '#....s....#....L....#....E.....#',
  '#.........#.........#....L.....#',
  '#..L......#....s....#.....s....#',
  '#.........#.........#..........#',
  '###...######...######...#####..#',
  '#..............................#',
  '#..C.......s........s......C...#',
  '#..............................#',
  '#....L...................L.....#',
  '#..C.......s........s......C...#',
  '#..............................#',
  '####....######....######....####',
  '#..............................#',
  '#.....s...........s............#',
  '#..............................#',
  '#..............P...............#',
  '################################',
];

/** Guard patrols: each guard walks its waypoints in a loop and looks where it walks. */
export const GUARD_PATROLS = [
  { name: 'Vesper', waypoints: [[13, 2], [18, 2], [18, 4], [13, 4]] },
  { name: 'Marlowe', waypoints: [[6, 8], [25, 8]] },
  { name: 'Ivo', waypoints: [[3, 6], [3, 11], [7, 11], [7, 6]] },
  { name: 'Sable', waypoints: [[24, 6], [28, 6], [28, 11], [24, 11]] },
  { name: 'Bram', waypoints: [[8, 15], [23, 15]] },
];

export function tileCenterX(col) {
  return ORIGIN_X + col * TILE + TILE / 2;
}

export function tileCenterY(row) {
  return ORIGIN_Y + row * TILE + TILE / 2;
}

export function tileAtPixel(x, y) {
  return {
    col: Math.floor((x - ORIGIN_X) / TILE),
    row: Math.floor((y - ORIGIN_Y) / TILE),
  };
}

/** Parse the map strings into the sets and spots the rest of the game reads. */
export function parseLevel() {
  const walls = new Set();
  const crates = new Set();
  const shadows = new Set();
  const loot = [];
  let spawn = { x: tileCenterX(15), y: tileCenterY(16) };
  let exit = { x: tileCenterX(25), y: tileCenterY(1), width: TILE, height: TILE };
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = MAP[row][col];
      const key = `${col},${row}`;
      if (ch === '#') walls.add(key);
      else if (ch === 'C') crates.add(key);
      else if (ch === 's') shadows.add(key);
      else if (ch === 'L') loot.push({ col, row, x: tileCenterX(col), y: tileCenterY(row), taken: false });
      else if (ch === 'P') spawn = { x: tileCenterX(col), y: tileCenterY(row) };
      else if (ch === 'E') exit = { x: ORIGIN_X + col * TILE, y: ORIGIN_Y + row * TILE, width: TILE, height: TILE };
    }
  }
  return { walls, crates, shadows, loot, spawn, exit };
}

/** True when the tile is a wall or a crate, or outside the museum. */
export function isSolidTile(level, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  const key = `${col},${row}`;
  return level.walls.has(key) || level.crates.has(key);
}

/** True when the point stands on a shadow tile. */
export function isShadowAt(level, x, y) {
  const { col, row } = tileAtPixel(x, y);
  return level.shadows.has(`${col},${row}`);
}

/** True when the straight line between two points crosses no wall or crate. */
export function lineOfSightClear(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const { col, row } = tileAtPixel(x0 + dx * t, y0 + dy * t);
    if (isSolidTile(level, col, row)) return false;
  }
  return true;
}

/** True when a circle of the given radius at (x, y) touches a wall or a crate. */
export function circleHitsSolid(level, x, y, radius) {
  const left = Math.floor((x - radius - ORIGIN_X) / TILE);
  const right = Math.floor((x + radius - ORIGIN_X) / TILE);
  const top = Math.floor((y - radius - ORIGIN_Y) / TILE);
  const bottom = Math.floor((y + radius - ORIGIN_Y) / TILE);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (!isSolidTile(level, col, row)) continue;
      const nearestX = Math.max(ORIGIN_X + col * TILE, Math.min(x, ORIGIN_X + (col + 1) * TILE));
      const nearestY = Math.max(ORIGIN_Y + row * TILE, Math.min(y, ORIGIN_Y + (row + 1) * TILE));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Breadth-first walk over open tiles from the spawn: every loot opal and the exit must be
 * reachable on foot, or the level is unwinnable. Used by the play-test, not by the game.
 */
export function reachableTiles(level) {
  const start = tileAtPixel(level.spawn.x, level.spawn.y);
  const seen = new Set([`${start.col},${start.row}`]);
  const queue = [[start.col, start.row]];
  while (queue.length > 0) {
    const [col, row] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = `${col + dc},${row + dr}`;
      if (seen.has(next) || isSolidTile(level, col + dc, row + dr)) continue;
      seen.add(next);
      queue.push([col + dc, row + dr]);
    }
  }
  return seen;
}
