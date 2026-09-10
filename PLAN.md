# AERONAUT — implementation plan

## Experience
A playable, cinematic island flight game. Open on a live 3D scene with a compact flight briefing, choose an expedition or free flight, and launch immediately. A warm ivory and orange aviation interface sits over blue ocean, forested islands, and dramatic mountains.

## Stack
- TypeScript + Three.js for the simulation and WebGL rendering.
- Vite for development and a portable static production build.
- Semantic HTML/CSS for a responsive HUD and touch controls.
- Procedural geometry and shaders: no asset downloads or paid service required at runtime.
- Web Audio for an engine that responds to throttle; local storage for personal bests.
- No backend or Docker required. Optional container instructions can serve the production build.

## Implementation sequence
1. Scaffold the app, scripts, and explicit simulation state.
2. Create the archipelago: shaped terrain, water shader, clouds, trees, runway, and a detailed aircraft.
3. Add accessible arcade flight dynamics: pitch, banking, coordinated turns, throttle, stall behavior, terrain collision, and reset.
4. Add an ordered checkpoint expedition, elapsed time, scoring, completion, and free flight.
5. Build the flight briefing, instrument HUD, compass, minimap, pause/help, camera switching, audio, lighting presets, and touch joystick.
6. Tune rendering and responsive layout; cap pixel ratio and instance repeated scenery.
7. Validate with TypeScript, production build, deterministic simulation tests, and runtime smoke checks. Fix problems and record limitations.
8. Document controls and launch instructions, leave a local preview running, and follow the user's hosting preference.

## Acceptance checks
- A fresh install starts with documented commands and builds to static files.
- Aircraft motion is time based; pause and inactive tabs do not advance gameplay.
- Keyboard and touch inputs steer and change throttle; inputs reset on focus loss.
- Checkpoints only count in order; collision and completion allow restarting.
- HUD values derive from simulation state and camera choices work.
- Mobile layout keeps launch, pause, throttle, and flight controls reachable.
- Graphics failures show a useful message instead of a blank page.

## Scope
An arcade flight experience, not a certified training simulator. No multiplayer, real-world navigation data, accounts, or server infrastructure.

## Validation record
- TypeScript and the Vite production build pass.
- 13 simulation checks pass, including a continuously steered complete expedition, frame-rate consistency, stall behavior, terrain collision, pause, throttle bounds, route clearance, ordered scoring, and ring-plane crossing.
- Automated headless Edge checks pass for desktop launch, keyboard climb, three cameras, pause/resume, mute, lighting, restart, help, and free flight.
- Portrait (390 × 844) and landscape (844 × 390) touch layouts pass launch visibility, joystick climb, and horizontal overflow checks.
- Captured and visually inspected desktop and mobile screenshots. Fixed a landscape footer overlap and reframed the portrait aircraft.
- No JavaScript runtime or WebGL shader errors in the smoke run.
- Browser tests use installed Microsoft Edge; run `npm run test:smoke` while the dev server is running. Screenshots are written to ignored `.artifacts/`.
- The production JavaScript bundle is approximately 140 KB gzipped. Vite reports its standard uncompressed 500 KB chunk-size advisory because Three.js is bundled with the game.
- Local delivery selected by default; no external site was registered or published. Docker configuration is provided but was not built or run.
- Mobile input was checked in emulation, not on a physical phone. Arcade flight, scenery-only runway, and hardware-dependent WebGL performance are documented in README.md.
