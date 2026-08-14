# MIDNIGHT LOOP Acceptance Audit

Status meaning: **Proven** has current automated, implementation, or desktop-Chrome evidence.

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Installs/runs from clean checkout | Proven | Prior isolated `npm install`, test, and build pass; lockfile retained. |
| 2 | `npm run build` succeeds | Proven | Current TypeScript and Vite production build succeeds. |
| 3 | Chrome has no serious console errors | Proven | Desktop Chrome final log audit has no game errors. |
| 4 | Start without developer tools | Proven | Title-screen Start Run enters an active run and unlocks audio. |
| 5 | Keyboard controls work in expected direction | Proven | A/D and arrow events reach Chrome; deterministic direction regression proves A=screen-left and D=screen-right. |
| 6 | Force/velocity player movement | Proven | 120 Hz custom force integration; player never uses lane interpolation. |
| 7 | Stable speed-sensitive steering | Proven | 29° low-speed to 7.5° freeway-speed range, smoothed buildup, controlled yaw, brake stability, and normal-vs-handbrake regression tests. Live 137 MPH slalom remained within ±0.39 rad/s. |
| 8 | Functional RPM/gears | Proven | Wheel-speed-derived RPM, torque curve, six-speed automatic, engine braking, and live HUD telemetry. |
| 9 | Independent multi-lane traffic | Proven | 44 pooled vehicles, six original faceted archetypes, five lanes, following logic, safe lane changes, per-car projected headlights, six nearby dynamic spotlights, and gap-preserving opening waves capped at 3/5 occupied lanes. |
| 10 | Curves and visual variety | Proven | Recycled curves, tunnels, overpasses, skyline, industrial/downtown sectors, lamps, and freeway gantries. |
| 11 | Reliable near misses | Proven | Chrome close fixture 1,400; distant fixture 0; unit pass lifecycle tests pass. |
| 12 | Proximity affects score | Proven | Nonlinear scoring test makes 0.5 m worth more than 3× a 2 m pass. |
| 13 | Duplicate farming prevented | Proven | Chrome duplicate stayed 1,040 before/after replay; unit lockout passes. |
| 14 | Combo scoring | Proven | 4.25-second chain window verified live: ×1.25 remained after three seconds and expired after 4.5 seconds; build/timeout/reset tests pass. |
| 15 | Collision affects car/combo | Proven | Inset Rapier/manual shells and axis-based impact classification distinguish scrapes from frontal contact. A live 121 MPH side graze stayed running at severity 6.9 with zero yaw; the direct fixture remained fatal at severity 51.2. |
| 16 | Severe crash ends run cleanly | Proven | Live traffic contact produced an opaque black impact frame and then final telemetry. |
| 17 | Immediate restart | Proven | After a browser run advanced the active road to 2400–6600, Run It Back rebuilt -300–3900 around the starting car and immediately restored a covered, illuminated 80 MPH run. |
| 18 | Persistent high score | Proven | Existing local record survived rename migration and Chrome reload. |
| 19 | Complete HUD | Proven | Score, record, combo, overlapping analog speed/RPM gauges with independent live needles, numeric RPM, gear, boost, sector, camera mode, and drift feedback inspected at 1280×720; the low-value minimap was intentionally removed. |
| 20 | Early-2000s underground visual identity | Proven | Inspected a brighter darkness-led five-lane freeway, continuous road-conforming headlight pool, warm rectangular facade lights, green signs, silver fictional tuner coupe with a reference-aligned rear composition, cool PS2-era dossier UI, and a strong old-camera treatment with coarse moving grain, recording lines, highlight-only RGB separation, and compression flecks. |
| 21 | Post-polish screenshot inspected | Proven | Title, 157–161 MPH freeway, gantry, Thread the Needle, blackout, and result frames inspected. |
| 22 | Gameplay tested in browser | Proven | Desktop Chrome exercised title, high speed, score fixtures, collision, result, restart, persistence, and keyboard events. |
| 23 | Automated core tests pass | Proven | 6 files / 26 tests pass: scoring, combo, drift, traffic formations, scrape/impact classification, removed-sedan roster, restart road coverage, drivetrain, service-brake stability, high-speed swerve recovery, handbrake, and Rapier. |
| 24 | Desktop performance bounded | Proven | Fixed 44-car pool and 28 recycled road chunks; foreground in-app Chromium held 59–60 FPS during chase, hood, 158 MPH, and drift tests. |
| 25 | README explains run/play | Proven | Setup, designer debug path, controls, scoring, architecture, physics, audio, and limitations documented. |
| 26 | No required proprietary assets/music | Proven | All geometry, textures, signs, UI, and audio are original runtime code/synthesis. References informed mood only. |
| 27 | No known game-breaking full-run bugs | Proven | Scored run, crash, final telemetry, record, and restart all complete in Chrome. |
| 28 | Feels like a small racing game | Proven | Coherent handling, five-lane traffic risk, score mastery, boost economy, audio feedback, crash finality, menus, HUD, and replay loop. |

## Current refinement results

- Close near miss: 1,400 points and ×1.25.
- Distant pass: 0 points.
- Duplicate replay: 1,040 before and after the same traffic identity passed twice.
- Thread the Needle: 5,415 points, ×2.50, and full boost.
- High-speed presentation: stable 157–161 MPH in fifth gear.
- Collision presentation: black impact cut → CRASHED / RUN OVER → immediate restart.
- Opening camera stability: 7.65 m at 0.10, 0.45, and 1.15 seconds; no initial road dropout observed after the continuity fix.
- High-speed camera: 69.97° FOV and 0.0204 m vibration at 158 MPH; 58° and zero speed vibration below 100 MPH.
- Drift presentation: 86 MPH, 46.5°, 33.7 m radius, scoring active; invalid straight braking and excessive spins rejected.
- Camera modes: chase and mesh-free headlight-active hood/first-person views both verified.
- Instrument/UI pass: live analog speed and RPM needles, numeric RPM, gear, coupe silhouette, underglow, broad headlight cone, and denser facade lights inspected in browser at a warmed-up 60 FPS.
- PS2 interface pass: title, gameplay HUD, and pause states inspected at 1280×720; lavender linework, list selection, technical rows, dither, and floating geometry remained readable without changing the freeway's warm lighting hierarchy.
- Optical-filter correction: removed world-space flare polygons, strengthened visible grain/scanlines, and moved diagonal light aberration wholly into the screen-space highlight shader. A 165 MPH run with 12 nearby vehicles held 60 FPS and the HUD remained crisp.
- Final visual correction: raised exposure, strengthened the 2000s recording texture, rebuilt the rear composition, and replaced the clipped headlight card with a 20-segment road-conforming ribbon. Browser runs across straight, off-axis, traffic, and elevated sections retained a complete light footprint and reached 60 FPS after warmup.
- Final automated gate: 6 files / 26 tests; production build succeeds.
