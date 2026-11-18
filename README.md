# NEON SIEGE 5 · Kinetic Rooftops

An original illustrated 3D arcade game built with HTML, Canvas, JavaScript, and procedural artwork. Five playable city and landscape arenas, cartoon robots, precise energy-projectile collision, rooftops you can climb, eight unlockable fictional energy launchers, waves and upgrades, and an **experimental** friend-versus-friend arena.

![Game in Sketchbook City](assets/game-preview.png)

## Quick start

Open `index.html` in a recent desktop Chrome, Firefox, or Edge browser. The game engine has **no external graphics dependency** and no build step; the images under `assets/` are used for map previews. A convenient alternative is opening `Neon_Siege_5_Play.html`, available as a separate single-file download outside this repository.

If opening local files has restrictions, from the directory containing `index.html` run:

```bash
python -m http.server 8000
```

and open `http://localhost:8000`.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D | Move freely relative to the camera, including strafing and diagonals |
| Mouse | Turn 360° and look up/down; click to capture mouse pointer |
| Shift | Sprint |
| Space | Jump |
| Ctrl | Slide |
| C | Directional dash |
| F near a glowing ladder | Climb onto a **3D rooftop** |
| F near a signal beacon | Activate it for credits and shield energy |
| Left mouse | Fire a fictional energy projectile |
| R | Reload |
| 1–8 / mouse wheel / Tab | Switch between unlocked blasters |
| G | EMP pulse in wave mode |
| Escape | Pause solo game; release mouse in 1v1 |

Some controls also have touchscreen buttons. The software 3D renderer is designed mainly for desktop; on slower devices select **Balanced** or **Fast** graphics in the main menu.

## What's changed from the older edition

- The **world is now perspective-projected 3D geometry**, with solid building faces, rooftop platforms, and true vertical camera movement. It doesn't use external Three.js downloads.
- New **momentum-based movement**, camera-relative strafing, jumping, sliding, sprinting and dashing.
- **Ladders with continuous vertical climbing**, so you can explore high roofs and look down at the streets.
- Eight visually distinct, fictional energy blasters. Four are new: **Ion Spark, Comet Driver, Echo Tri-Burst, Zenith Prism**.
- Blasters can be purchased with in-game wave credits; unlocks are saved locally in your browser using `localStorage`.
- Animated **muzzle flashes, visible energy streaks, impact sparks, and projectile trajectories**.
- **No aim assist** in the new projectile system. Shots only damage cartoon enemies when their actual moving projectile intersects the enemy's character hit shape; buildings block shots.
- Each of the five worlds has different world colors, decals, landmarks and reachable rooftops.
- Private peer-to-peer 1v1 arena option for friends (see below).

## Friend 1v1: exchanging connection codes

The browser uses **WebRTC DataChannel** and manually exchanged connection codes rather than an always-on server, rooms database or account system. This approach can work on GitHub Pages. It requires an internet connection, and the other player to have the site open at the same time. Both players should use a modern browser, ideally from an HTTPS GitHub Pages site.

1. Both open the **same published game URL** and choose **1V1 WITH A FRIEND** from the main menu.
2. Player 1 clicks **CREATE MATCH**. Copy the offered connection code and send it privately using a messaging app you already use.
3. Player 2 pastes the offer into the lower box, then clicks **JOIN USING OFFER**. Player 2 sends the resulting **answer code** back.
4. Player 1 pastes the answer into their lower box and clicks **HOST: ACCEPT ANSWER**.
5. Once the direct connection opens, both enter the same world. The match is first to five. Players have equal gear choices in friend mode. After the match, click **REMATCH** to play again.

**Limitations:** This is experimental P2P, not a public matchmaking or dedicated game-server system. Certain school networks, routers, strict firewalls, or NAT configurations need a TURN relay and **will fail without one**. There is no automatic room code, ranking, spectator mode, voice/chat, authoritative anti-cheat, or latency compensation. Only share the temporary connection code with friends you trust; exchanging WebRTC network descriptions may disclose network information to the other peer.

### Multiplayer testing status

The game UI can generate offers and answers, and the internal duel gameplay can be exercised locally. Automated end-to-end network verification could not complete in the isolated test environment because its browser did not produce ICE connection candidates. **A successful internet match is not claimed as tested.**

Technical references: [MDN WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels), [MDN Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API).

## Publish on GitHub Pages

1. Create a GitHub repository at https://github.com/new (for example `neon-siege`).
2. Extract the supplied ZIP and upload **the folder contents**, not the ZIP itself, so `index.html`, `upgrade.js`, `README.md`, `.nojekyll`, and `assets/` are all at your repository root.
3. Commit the files to `main`.
4. Open your repository's **Settings → Pages**. Set **Deploy from a branch**, `main`, `/ (root)` and click **Save**.
5. Open the URL shown by GitHub Pages once publishing completes; share the same URL with a friend.

If you later edit `upgrade.js`, commit your changes and GitHub Pages will redeploy. No secret API keys should ever be committed.

## Project structure

```text
index.html           Original game UI, map generation, wave system, and procedural art
upgrade.js           New 3D renderer, physics, projectile collision, more equipment, WebRTC P2P
assets/*-preview.png  Five bundled map-selection thumbnails
assets/game-preview.png   Game screenshot
assets/rooftop-preview.png Rooftop screenshot
assets/worlds-overview.png Illustrated overview
README.md            Instructions
.nojekyll            GitHub Pages static hosting
404.html             Fallback redirect
```

## Notes

The environments are original fictional places loosely inspired by real-world architecture; none are exact real-world geographic map reproductions. This game is a cartoon arcade experience, not a simulation of real-world weapons. It was built by adapting the user's earlier NEON SIEGE code and adding original 3D and multiplayer features. No source code or artwork from other commercial games was copied.
