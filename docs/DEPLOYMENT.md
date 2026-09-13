# GitHub Pages deployment plan

Requested September 12, 2026: make AERONAUT publicly playable for friends.

## Destination

- Source: https://github.com/johnfabian/flight-sim-codex (existing public repository).
- Game: https://johnfabian.github.io/flight-sim-codex/.
- The existing johnfabian.github.io homepage and its other pages stay intact.
- Static hosting only; no account, backend, paid service, or application secrets required.

## Release steps

1. Configure relative Vite asset URLs so the build runs beneath the project path.
2. Add a GitHub Actions workflow that installs locked dependencies on Node 24, runs simulation tests, builds the production site, uploads only dist, and deploys to Pages.
3. Run the simulation tests and production build locally. Exercise the production build with the existing Edge smoke checks for desktop and emulated touch gameplay.
4. Enable GitHub Pages with GitHub Actions as its publishing source, commit the validated changes, and push to main.
5. Confirm the workflow succeeds, the public page and bundled assets load, and desktop/mobile smoke checks pass against the public URL.
6. Share the game URL. Future pushes to main automatically publish after tests and build pass.

## Rollback

Revert the faulty source commit on main and push the revert. The workflow rebuilds and publishes the previous behavior. A failed build does not replace the currently deployed game. The Actions run and github-pages environment record deployment history.

## Validation

- All 13 simulation tests pass on Node 24.
- TypeScript checks and the production build pass; HTML references relative bundled assets and favicon. Vite reports its existing Three.js bundle-size advisory (approximately 140 KB gzipped JavaScript).
- Production preview passes desktop launch, climb, camera changes, pause/resume, mute, lighting, restart, help, free flight, and portrait/landscape emulated touch checks with no runtime or shader errors. The initial sandbox run blocked an optional font request; the network-enabled run passes.
- GitHub Actions [release run 34731044460](https://github.com/johnfabian/flight-sim-codex/actions/runs/34731044460) successfully built and deployed commit `35a90424543e71ab13ac56cafeba0f1171b408a0`.
- The public HTTPS page, favicon, JavaScript, and stylesheet all return HTTP 200.
- The same desktop and portrait/landscape emulated touch smoke checks pass against https://johnfabian.github.io/flight-sim-codex/ with no runtime or shader errors.
- The existing root homepage repository was not modified. Physical phone testing remains outside this release's automated checks.
