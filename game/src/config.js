// Every tuning number and colour for Velvet Vault, in one place. The playfield is a fixed
// 1280x800 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. The top 64 pixels are the HUD bar; the museum floor sits below it.

export const FIELD = { width: 1280, height: 800, hudHeight: 64 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  sneakSpeed: 96,
  sprintSpeed: 238,
  /** Sprinting is loud: guards inside this radius turn toward the noise. */
  sprintNoiseRadius: 210,
  /** A guard this close catches Wren on contact. */
  catchRadius: 26,
  /** Loot is picked up this close. */
  pickupRadius: 24,
};

export const GUARD = {
  /** How far a guard can see, in pixels. */
  sightRange: 222,
  /** Half of the vision cone's angle, in radians. */
  sightHalfAngle: 0.63,
  patrolSpeed: 64,
  investigateSpeed: 98,
  chaseSpeed: 152,
  /** Suspicion per second when Wren stands lit, close, and still in a cone. */
  suspicionBaseRate: 58,
  /** Suspicion drains this fast per second once Wren is out of sight. */
  suspicionDecay: 26,
  /** At this suspicion a guard leaves patrol to investigate the last seen spot. */
  suspiciousAt: 55,
  /** At this suspicion a guard gives chase and the alarm starts climbing. */
  alertAt: 100,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  chaseMemory: 2.6,
  /** Seconds a guard scans a spot it investigated before giving up. */
  searchSeconds: 3.0,
  /** How far a thrown coin's ping carries: guards inside it come to look. */
  coinHearingRadius: 330,
};

export const ALARM = {
  /** Alarm points per second while any guard is chasing. */
  chaseRate: 9,
  /** Alarm points per second while any guard is suspicious or searching. */
  uneaseRate: 3,
  /** Alarm points per second the alarm cools down while every guard is calm. */
  coolRate: 2.5,
  /** At 100 the museum locks down and the run is over. */
  lockdownAt: 100,
};

export const LOOT = {
  /** Opals needed before the exit door unlocks. */
  neededToEscape: 3,
  /** Points per opal. */
  pointsEach: 100,
  /** Bonus for escaping without ever being chased. */
  ghostBonus: 400,
  /** Biggest time bonus; it shrinks the longer a run takes. */
  timeBonusMax: 300,
  timeBonusSeconds: 240,
};

export const COINS = 3;

export const PALETTE = {
  backdrop: '#0b0e16',
  hud: '#141826',
  hudLine: '#2a3048',
  floorLight: '#232838',
  floorDark: '#1d2231',
  rug: '#3a2b3d',
  rugEdge: '#54405a',
  wall: '#3d4358',
  wallTop: '#5a6280',
  shadow: '#0d1526',
  shadowEdge: '#2c4a72',
  crate: '#6b4a2f',
  crateEdge: '#8f653d',
  player: '#2fd6c0',
  playerDark: '#178a7d',
  guard: '#e5534b',
  guardBody: '#c93a32',
  coneCalm: 'rgba(250, 204, 84, 0.20)',
  coneCalmEdge: 'rgba(250, 204, 84, 0.55)',
  coneSuspicious: 'rgba(250, 166, 52, 0.30)',
  coneAlert: 'rgba(229, 83, 75, 0.34)',
  loot: '#7df3ff',
  lootGlow: 'rgba(125, 243, 255, 0.35)',
  exit: '#58d68d',
  exitGlow: 'rgba(88, 214, 141, 0.30)',
  text: '#eef1f5',
  muted: '#9aa3b8',
  alarmLow: '#58d68d',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  banner: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
