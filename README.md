# Velvet Vault — a moonlight heist

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Halimcuk/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Halimcuk/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Referral code: `jcrs26fr`

VELVET VAULT is an original top-down stealth game built for make.fun's
"Make the best stealth game" bounty ($50 in USDC).

Wren the cat-burglar slips into the Gulliver Museum after dark. Five moon opals
glitter in the vault. Steal at least three, then reach the green EXIT — unseen.

## The game

- **A museum with three ways up** — the west stairs, the central gallery doors,
  and the east stairs — so a patient thief can always pick the route whose
  guards are looking elsewhere.
- **5 guards with real vision cones** — Vesper, Marlowe, Ivo, Sable and Bram
  patrol learnable loops. Each cone is raycast against the walls, so the cone
  you see is exactly the cone the guard sees through.
- **Detection with a second chance** — suspicion builds in the open, crawls in
  shadow, and drains when you break line of sight. A suspicious guard comes to
  check; a sure guard gives chase; lose it and it searches, then walks back to
  its patrol.
- **Shadows and cover** — dark pools hide you, crates block sight and movement,
  sneaking is slow and quiet, sprinting is fast and loud enough to hear.
- **Alarms and lures** — the ALARM meter climbs while guards hunt and cools
  while they are calm; at 100 the museum locks down. Click the floor to toss
  one of 3 coins and pull a guard away.
- **Win and lose, clearly** — reach the EXIT with 3+ opals for a clean getaway
  (ghost bonus if never spotted); get touched by a guard and you are caught.
- **Feel and polish** — suspicion arcs over guard's heads, `?` and `!` marks,
  a SPOTTED! banner, HIDDEN indicator, footsteps that pan with the nearest
  guard, and fully synthesised WebAudio sounds (steps, pickup chime, alert
  sting, win arpeggio). No audio files, no network, ever.
- **Keyboard and mouse** — WASD / arrows move, `Shift` sneak, `Space` sprint,
  click tosses a coin, `P` pause, `M` mute, `Enter` start / restart.

## Play it

Serve `game/` with any static server and open `index.html` in desktop
Chrome. It plays offline: every file it loads lives under `game/`.

```sh
node serve.ts   # then open http://localhost:8080
```

## Files

- `game/index.html` — page and HUD shell
- `game/src/config.js` — every tuning number and colour
- `game/src/level.js` — the museum tile map, walls, shadows, loot and patrols
- `game/src/vision.js` — vision cones, line of sight and suspicion rates
- `game/src/guards.js` — guard brains: patrol, investigate, chase, search
- `game/src/world.js` — the run: player, loot, coins, alarm, win/lose
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/input.js` — keyboard and mouse
- `game/src/render.js` — procedural canvas art, HUD and screens
- `game/src/shots.js` — the staged screenshot scenes
- `game/src/main.js` — boot, fixed-step loop and screens
- `main.ts` — hands game/ and screenshots/ in and writes dossier.json
- `screenshots/` — 4 real renders of the game: cover, hiding, chase, getaway
