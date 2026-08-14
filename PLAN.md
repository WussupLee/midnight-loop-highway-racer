# MIDNIGHT LOOP Development Plan

## Goal

Deliver a complete, replayable desktop-browser highway score-attack racer with original Y2K street-racing atmosphere, force/velocity-based driving, moving traffic, risk scoring, persistent high scores, procedural audio, and verified browser play.

## Milestones

1. **Foundation** — Vite + TypeScript + Three.js + Rapier shell, fixed-step loop, road, original player coupe, chase camera, input.
2. **Vehicle** — bicycle-model tire forces, friction limits, load transfer, engine torque curve, automatic six-speed gearbox, braking, handbrake, speed-sensitive steering.
3. **Highway & traffic** — curved/elevated reusable road segments, tunnels/overpasses/city dressing, pooled traffic archetypes, lane following and safe lane changes.
4. **Risk loop** — validated pass lifecycle, proximity/speed scoring, duplicate prevention, combo expiry/reset, boost reward, collisions, severe-crash run ending.
5. **Presentation** — gritty wet-road art direction, warm freeway lighting, restrained blue-green instrumentation, menus, tachometer, callouts, camera speed effects, and procedural Web Audio.
6. **Quality** — deterministic debug scenarios, unit tests for pure systems, production build, Chrome playtests, screenshots, performance inspection, tuning.
7. **Completion** — acceptance-criteria audit and a final playtest/polish pass.
8. **Player-feedback refinement** — eliminate opening road/camera glitches, add a first-person camera and scored drifting, raise useful traffic density, rebuild the instrument cluster and low-poly vehicles, remove the minimap, and re-light the freeway around headlights and sparse practical sources.

## Verification gates

- `npm run test` for pure gameplay logic.
- `npm run build` for production output.
- Real-browser start, keyboard driving, traffic, near miss, collision, restart, persistence, debug state, console, screenshot, and FPS checks.
- Final requirement-by-requirement audit against all 28 acceptance criteria.
