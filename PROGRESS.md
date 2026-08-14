# MIDNIGHT LOOP Progress

## 2026-08-12 — MIDNIGHT LOOP refinement pass

- Confirmed the reported steering inversion. The chase view faces +Z, so screen-right is world -X; the old keyboard mapping sent D toward screen-left. Added `digitalSteer`, corrected A/D and arrow mapping, and added a direction regression test.
- Retuned keyboard handling: slower high-speed steering buildup, a 9° freeway-speed limit, stronger speed-scaled yaw damping, more rear stability, and a separate recoverable handbrake yaw envelope.
- Reinspected the original collage and audited the official NIGHT-RUNNERS PROLOGUE presentation as broad mood reference only. Adopted a darkness-first, warm-practical-lighting rule while retaining blue-green primarily inside the instrumentation.
- Renamed the game **MIDNIGHT LOOP** and replaced the neon/synthwave title, palette, panels, typography, bloom, purple city fill, and pervasive cyan emissive treatment with a heavier, muted early-2000s identity.
- Converted the route to five 3.65 m lanes with measured shoulders, a yellow left edge, white right edge, dashed white lane separators, two-piece concrete barriers, reflectors, warm lamp pools, neutral headlights, and original readable green American freeway signs.
- Expanded the traffic pool from 30 to 36 and removed every four-lane assumption from spawning and lane-change bounds.
- Replaced visible severe-collision aftermath with an immediate black impact cut, layered procedural crash audio, and the end-of-run screen. Restart remains immediate.
- Expanded procedural audio with separate road, brake, boost, overrun, stereo passing-traffic, metal/body impact, glass-like crash, tire, wind, drivetrain, near-miss, Thread the Needle, and UI layers.
- Browser validation in desktop Chrome: close pass 1,400; distant pass 0; duplicate identity 1,040 before and after replay; Thread the Needle 5,415 and ×2.50; 157–161 MPH high-speed state remained stable; physical traffic collision produced a full black frame followed by CRASHED / RUN OVER.
- Inspected 1280×720 title, freeway, sign, high-speed, two-car gap, blackout, and result frames. Chrome's extension-controlled window reported 20–22 FPS while controlled/occluded; the same browser previously reported 60 FPS when foregrounded.
- Current final gates: 14/14 automated tests pass and the production build succeeds. The only build notice is Vite's non-fatal bundle-size advisory.

## 2026-08-11 — Reference analysis and assumptions

- Read the complete original goal and all 28 acceptance criteria.
- Inspected the supplied collage. The key hierarchy is dense darkness, wet reflective pavement, warm practical lighting, cyan/green technical instruments, low chase framing, tuner silhouettes, fog, and restrained purple/green accents.
- The project title will be **NITRO//VEIL**; all vehicles, brands, signage, environment layouts, UI, and audio will be original/procedural.
- Desktop Chrome and keyboard are the primary target. The first launch defaults to a balanced graphics presentation and 60 FPS target.
- Vehicle target: 1,360 kg, 2.62 m wheelbase, rear-biased drive, six-speed automatic, 178 mph approximate boosted top speed.
- Physics target: deterministic 120 Hz fixed-step custom bicycle/tire model with bounded lateral force, friction-circle coupling, load transfer, drag, rolling resistance, and Rapier rigid-body/collider support for impacts.
- Highway strategy: a continuously recycled curved route frame. Player and traffic use road-relative longitudinal/lateral coordinates, while the player still evolves through actual velocities and forces—never lane interpolation.
- Near-miss state requires approach, longitudinal overlap, clear pass, minimum side clearance, speed advantage, no contact, and per-vehicle award lockout.
- Boost is included because it closes the intended risk → reward → greater speed loop.
- Browser audio will remain silent until the Start Run interaction unlocks Web Audio.

## Current status

- Milestone planning and project initialization complete.
- Implemented the fixed-step custom tire/drivetrain simulation, original player coupe, chase camera, boost and collision response.
- Implemented recycled curved highway chunks, wet materials, skyline, tunnels, overpasses, gantries, streetlights, and bounded pooled traffic with safe lane changes.
- Implemented pass lifecycle scoring, nonlinear risk awards, duplicate lockout, combo, Thread the Needle, draft release, boost feedback loop, run flow, and local high score.
- Implemented full title/HUD/pause/crash UI, procedural audio, settings, and debug scenarios.
- Next: install the final dependency set, resolve compile/test findings, and begin real-browser playtest/tuning passes.

## 2026-08-12 — Verification pass 1

- Dependency install completed and the project now includes a reproducible lockfile for the installed package manager.
- All 11 unit tests pass: complete close pass, distant-pass rejection, duplicate prevention, collision invalidation, proximity value curve, combo build/timeout/reset, torque curve, speed-sensitive steering, force acceleration, braking, and handbrake yaw.
- TypeScript compilation passes.
- `npm run build` succeeds with the bundled Node runtime on PATH. Vite emits the production files in `dist/`.
- Removed all unused starter application/backend files and eliminated the only external runtime asset request (web fonts), keeping the game self-contained and original.
- Local dev server responds successfully at `http://127.0.0.1:4173/?debug=1`.
- Browser validation remains unproven. Chrome automation currently fails before launch because the Node browser-control kernel cannot write its assets into this session's workspace; the workspace path did not exist when the task session began. The game has been opened/queued in the Codex browser panel, but no interaction or screenshot is being claimed from that.
- Next: retry Chrome attachment in a refreshed workspace session, then perform input/scenario/persistence/console/FPS tests, inspect screenshots, tune, rebuild, and run the final acceptance audit.

## 2026-08-12 — Verification pass 2

- Repeated the automated gates from the current writable workspace: 12/12 tests pass, TypeScript passes, and the production build succeeds.
- Proved clean-checkout setup in an isolated directory: fresh `npm install` added 71 packages, then `npm run test` and `npm run build` both passed. Preserved the generated `package-lock.json` and removed the temporary verification directory.
- Rapier now actively calculates kinematic-to-kinematic contacts and the runtime filters broad-phase pairs through precise penetrating contact manifolds before applying the tuned arcade response. A dedicated contact/separation test passes.
- Added `ACCEPTANCE.md` with requirement-by-requirement evidence and an explicit remaining Chrome test script.
- Chrome control failed again because the browser-control service was still the process launched before this workspace existed. The isolated stale service was safely restarted, but Codex did not respawn its connection inside the current app session; browser tooling now requires the Codex app/task to be reopened before validation can continue.

## 2026-08-12 — Browser blocker audit

- The required Chrome-control service remains absent and the Browser tool reports `Transport closed` after the safe service restart.
- This is the third consecutive goal turn with the same browser-validation blocker. The local development server also ended at the turn boundary and can be restarted normally once the app session is refreshed.
- No substitute browser controller was used because the required Browser workflow explicitly disallows standalone Playwright or another browser-control surface for this Chrome task.
- Resume point: restart Codex, reopen this task, launch `npm run dev`, then execute the eight-step Chrome script in `ACCEPTANCE.md`. The goal must remain incomplete until those browser, screenshot, performance, final-playtest, and polish gates pass.

## 2026-08-12 — Resumed live browser pass

- Restarted the Vite server and opened the debug build at 1280×720 in the Codex in-app Chromium browser.
- Captured and inspected the title screen and an active run. The Start Run flow worked without developer tools, the complete HUD rendered, the fixed-step simulation advanced, traffic telemetry was live, and both inspected states held 60 FPS with no browser console warnings or errors.
- The live gameplay capture revealed that the car and city were too dark/blocky relative to the reference. Implemented a focused visual pass: closer chase framing, rounded and brighter tuner bodywork, additional original body details, road/tail/underglow lighting, environment reflections, brighter wet asphalt, facade window bands, road sheen, and more readable traffic materials.
- Added debug-only on-page controls for auto driving, all deterministic scoring scenarios, and forced severe crash. This keeps browser validation usable even when an automation surface cannot hold continuous keyboard input.
- Tightened the Thread the Needle setup so the two traffic cars produce a physically navigable adjacent-lane gap. Added a live duplicate replay using the same traffic identity so browser tests can observe the score remaining unchanged.
- Re-ran TypeScript, all 12 automated tests, and the production build after the changes; every required command passed. The only build notice is Vite's non-fatal bundle-size advisory.
- Saved the inspected pre-polish baseline screenshots under `artifacts/browser/`. They are evidence of the real browser pass, not the mandatory final post-polish capture.
- Remaining browser blocker: desktop Chrome is installed, but its Codex connector has neither the native-host manifest nor registry registration. The prescribed diagnostics say to reinstall the Browser/Chrome plugin from the Codex plugin UI; the app must not repair this host component automatically. After the in-app page hot-reloaded, its localhost URL policy also denied further inspection, so no post-polish screenshot or final full-run claim is being made.

## 2026-08-12 — Chrome resume audit 1

- The game server resumed successfully and responds at `http://127.0.0.1:4173/?debug=1`.
- Desktop Chrome remains unavailable to Codex after restart. Chrome is installed, but diagnostics still find no Chrome user-data directory, no Codex native-host manifest, and no native-host registry registration.
- This is the first occurrence in the fresh resumed-goal blocker audit. Per the Chrome integration's recovery policy, the remaining action is user-side installation/enabling through Codex **Settings → Computer use**, followed by launching Chrome and restarting Codex. The project goal remains incomplete; no substitute browser is being used to claim Chrome acceptance.

## 2026-08-12 — Desktop Chrome final validation and polish

- The user correctly confirmed the Chrome integration was installed; the connector came online and desktop Chrome became fully controllable without reinstalling or enabling elevated CDP access.
- Loaded the debug build at the 1280×720 target, inspected the title and gameplay in Chrome, and confirmed the final error log is empty. Unrelated wallet-extension warnings and Rapier's non-fatal compatibility initialization deprecation remain warnings only.
- Exercised every keyboard mapping in Chrome. W/S/A/D/Space/Shift/R produced the correct browser key codes; Escape paused/resumed, M visibly muted/unmuted, and R recovered the vehicle.
- Fixed live issues found by testing: overexposed environment lighting, excessive chase-camera lag, stale crash callout after restart, ambiguous debug high-speed drip scoring, curvature-dependent pass fixtures, duplicate replay timing, auto-driver instability, and automated collision interference.
- Browser scoring results: normal pass 351, close near miss 1,412 and ×1.25, distant fixture 0, duplicate 1,410 before and after replay, Thread the Needle 5,695 and ×2.50, combo timeout back to ×1.00.
- Browser run-flow results: physical severe collision, dramatic crash slowdown, final telemetry, instant Run It Back, and 1,065-point local record surviving reload.
- Long-form drivetrain run reached 166 MPH in fifth at 6,973 RPM. Final debug High Speed control gives designers an immediate repeatable 157 MPH inspection state while normal gameplay continues to use force-integrated acceleration.
- Completed the final reference comparison and saved post-polish Chrome captures under `artifacts/browser/`. The final visual pass darkened the road, reduced headlight wash, enlarged the chase-car read, retained reflective wet highlights, and preserved cyan/green/purple Y2K instrumentation.
- Final gates pass: TypeScript through `npm run build`, Vite production build, and all 12 automated tests. No game-breaking bug was encountered during a complete scored run.

## 2026-08-12 — Road, camera, drift, traffic, and vehicle refinement

- Reproduced the perceived opening-road and low-speed car glitch. The road mesh existed, but the chase camera reset at 8.6 m and immediately drove toward an absolute-speed-derived offset near the rear bumper; broad flat streetlight discs and global fill made asphalt visibility inconsistent.
- Replaced the speed-derived camera position with a stable 7.65 m spring target, added fixed-step render interpolation, disabled near-road frustum culling, removed flat light-pool decals, and retained a DoubleSide fallback. Browser telemetry held 7.65 m at 0.10, 0.45, and 1.15 seconds after Start Run.
- Added a `C`-key hood/first-person camera. Player meshes disappear in that view while the physical headlight remains active. At 158 MPH the camera reached 69.97° FOV with a restrained 0.0204 m speed-vibration amplitude; at 80–87 MPH it remained at 58° with no speed shake.
- Added pure drift qualification and scoring using speed, slip angle, yaw rate, handbrake state, and turn radius. Straight handbrake braking and spins beyond 52° do not score. Live validation produced an 86 MPH, 46.5° slide at a 33.7 m radius and awarded 124 drift points.
- Strengthened synthesized tire squeal with a filtered tonal layer and earlier slip response, plus a distinct completed-drift sting. Added three drift regression tests.
- Increased the traffic pool to 44, raised the normal active target to 28–41, tightened initial staging without same-depth lane walls, and observed 8–10 nearby vehicles at presentation speeds.
- Rebuilt the player coupe and traffic archetypes from small faceted loft shells, tapered cabins, low-sided bumpers, era-style four-round taillamps, low-poly rims, emissive front/rear lighting, and soft underglow. All forms remain fictional runtime geometry.
- Removed the minimap, replaced it with compact sector/camera/drift telemetry, and rebuilt the tachometer with a legible circular 0–8 scale, technical tick ring, cyan operating band, amber transition, and redline arc.
- Lowered global/environment illumination so the player headlight, taillights, reflectors, lane paint, windows, and sparse warm practical lamps establish the road. Added inexpensive individual building-window instances for distant city texture.
- Live browser verification held 59–60 FPS in chase, hood, high-speed, and drift scenarios. The current build has no new browser errors; Rapier's existing non-fatal initialization deprecation warning remains.
- A separate clean browser tab confirmed zero JavaScript errors and only the same non-fatal Rapier warning. The final crash pass observed the active opaque-black cut and an immediate restart returning at 78 MPH.
- Final automated gate for this pass: 4 files / 17 tests pass and the production build succeeds.

## 2026-08-12 — Brake, swerve, traffic-gap, scoring, wheel, and lighting refinement

- Separated service braking from the handbrake at the tire/yaw level. Service brakes now use stable 70/30 front bias, reduce steering while braking, damp lateral motion, and actively converge yaw toward the requested steering path. The handbrake alone lowers rear grip and removes the normal yaw controller.
- Tightened freeway steering to a 7.5° maximum, slowed full-lock keyboard buildup, increased rear grip, and added a bounded high-speed yaw controller. Live 137 MPH repeated swerves stayed within ±0.39 rad/s and recovered on every reversal.
- Added deterministic Brake Test and Swerve Test controls to the debug panel. The live service-brake test decelerated from about 121 to 76 MPH while yaw remained between 0.008 and 0.119 rad/s instead of spinning.
- Rebuilt initial traffic staging as rotating three-car waves across five lanes. A spawn guard preserves same-lane distance and keeps two lanes open in every opening longitudinal band. Browser telemetry reported 3/5 occupied lanes at the start; an eight-sample 159 MPH run never produced a five-wide wall.
- Expanded near-miss clearance from 2.25 to 2.7 m and extended the combo window from 2.65 to 4.25 seconds. A live near miss scored 1,520, remained at ×1.25 after three seconds, and expired after 4.5 seconds.
- Made drift score a persistent independent HUD bank. Holding Space shows live session score, angle, and radius; releasing it retains total drift score and returns to the handbrake prompt.
- Corrected player rim orientation, reduced rim and tire depth, and moved wheel centers from the body edges to an inset 0.89 m track position. Traffic wheel centers moved to 43% body width with shallower sidewalls and rims.
- Split the player headlight into two focused lamps, added five pooled low-cost traffic spotlights, and corrected/reinforced individual road-facing building windows while retaining darkness-first presentation.
- Final automated gate: 5 files / 21 tests pass, including new service-brake, highway-swerve, opening-gap, and five-wide-wall regression coverage. Production build succeeds.

## 2026-08-12 — Restart-road and traffic-headlight refinement

- Reproduced the black-road restart after a long browser run. Endless chunks only recycled forward, while Run It Back returned the car to `z=16` without restoring road geometry around the starting line.
- Added an explicit restart-safe highway reset. It preserves an already valid starting range, but rebuilds all 28 chunks around the new player position when the prior run has moved the active world beyond it.
- Browser regression advanced the world until its live road range was `2400–6600`, forced a severe crash, selected Run It Back, and immediately observed `road COVERED -300–3900` with lane markings, traffic, player headlights, and 60 FPS. No console errors were logged.
- Rebalanced the darkness hierarchy by lowering environment, hemisphere, directional, city-glow, and neutral-fill contributions and reducing asphalt environment response. The player and vehicle lights now carry more of the freeway readability.
- Added an instanced projected headlight beam for every active traffic car plus six nearby true dynamic spotlights. This provides per-car road illumination at a bounded cost; live telemetry showed 28–31 projected beams and six dynamic lights at 60 FPS.
- Removed the tall-hood sedan archetype from the traffic roster and doubled the smaller compact-car entry in its place.
- Added restart-range and traffic-roster regressions. Final automated gate: 6 files / 24 tests pass; TypeScript and the production build succeed.

## 2026-08-12 — Collision-shell and side-scrape refinement

- Traced overly sensitive collisions to full visual-width cuboids and a severity formula dominated by forward speed difference. At racing speed, even a tiny side overlap could therefore be treated like a direct rear impact.
- Inset the player and traffic collision shells while retaining visual body dimensions for near-miss scoring. Plausible gaps now have a small gameplay margin without turning cars into narrow ghost hitboxes.
- Classified contact by the shallowest penetration axis. Side-panel contact uses lateral velocity, shallow penetration, and only a small forward-speed contribution; front/rear contact retains a strong closing-speed response.
- Added a scrape-specific impulse with a small lateral nudge, bounded deterministic yaw, scrape audio/callout, combo penalty, and continued driving. Hard lateral strikes can still cross the severe-crash threshold.
- Added browser telemetry and a deterministic Side Scrape fixture. Live results: 121 MPH graze, severity 6.9, mode still running, zero yaw; Thread the Needle scored 5,780 with no impact; direct collision severity 51.2 ended the run.
- Final gate: 6 files / 26 tests pass, including shallow high-speed scrape and direct rear-impact classification. Production build succeeds and the browser error log is empty.

## 2026-08-12 — Instrument, tuner-car, and city-light UI pass

- Rebuilt the lower-right HUD as an overlapping analog instrument cluster: a green 0–200 MPH speedometer, violet 0–8 RPM tachometer, independently animated needles, a live four-digit RPM window, and a dedicated gear readout. All values remain driven by the actual vehicle simulation.
- Reworked menus and telemetry around condensed italic early-digital typography, restrained translucent panels, simple selection bars, and a subtle scanline/dither surface treatment. The presentation stays original while following the supplied underground-racing mood reference.
- Refined the fictional player coupe with graphite bodywork, a taller period wing, four circular lamps set into a dark rear panel, a smaller proportionate plate, a stronger green underglow, and additional lower rear structure.
- Replaced the player road-light rectangle with a purpose-built trapezoidal cone mesh that widens from the two physical lamp positions. Its feathered shader produces one broad headlight pool rather than two hard beams or a visible rectangular card.
- Increased the quantity, aspect variation, and warm/neutral color variation of instanced rectangular building windows without raising dynamic-light count.
- Inspected clean menu and gameplay states in the browser. The live cluster responded to speed, RPM, and gear changes; the coupe, underglow, headlight pool, and facade lights remained readable in the darkness-led freeway composition. Warmed-up foreground telemetry held 60 FPS and the browser log remained free of game errors.
- Final automated gate: 6 files / 26 tests pass and the production build succeeds. The only build note is Vite's non-fatal large-bundle advisory.

## 2026-08-12 — PS2 network/dossier interface pass

- Analyzed the supplied PS2 network-menu and monochrome technical-dossier references as a structural system: one-pixel lavender frames, bright registration nodes, simple row selection, monospaced early-digital type, low-resolution texture, and sparse translucent geometry.
- Rebuilt the title presentation with a network status rail, route dossier, framed run selector, restrained confirm/back prompts, procedural star field, and six CSS-built floating geometric forms. No logos, fonts, or assets were copied from either reference.
- Restyled secondary gameplay telemetry as compact dossier fragments while retaining the prior realistic green/violet analog instrument cluster as the mechanical focal point.
- Applied the same framed row-navigation system to pause, restart, result, debug, settings, and notification surfaces. Warm freeway lighting remains independent from the cool UI palette.
- Inspected the title, live HUD, and pause interface at 1280×720 in the browser. Text remained readable, panels avoided excessive glow, and the procedural geometry remained subordinate to the car and road.
- Final automated gate remains 6 files / 26 tests. The production build succeeds and the browser shows no game errors; only Rapier's known non-fatal initialization deprecation warning remains.

## 2026-08-12 — Old-camera and optical-aberration pass

- Added a single lightweight post-process after bloom. It applies mild lens curvature, highlight-weighted chromatic separation, animated low-resolution grain, faint scanlines, rare compression flecks, and a restrained edge vignette to the rendered road scene.
- Added occasional procedural diagonal star-cross geometry to selected sodium streetlights. It is tied to actual world lamps rather than fixed screen decorations, remains depth-aware, and appears only often enough to suggest an old optical filter.
- Kept the HTML HUD above the stronger camera layer so score, gauges, and technical text stay crisp. The menu retains only the existing subtle surface texture.
- Tuned the result against the supplied references: visible small crosses on isolated lamps, minimal RGB fringing elsewhere, no full-screen rainbow smear, and no dramatic flare on every light.
- Browser-tested the finished pass at 164 MPH with 12 nearby vehicles, 28 projected traffic beams, and six dynamic headlights. Foreground telemetry held 60 FPS and the browser reported no game errors.
- Final automated gate: 6 files / 26 tests pass and the production build succeeds. Rapier's existing non-fatal initialization warning and Vite's bundle-size advisory remain unchanged.

## 2026-08-12 — Camera-filter and rear-light correction

- Reduced the player coupe's four taillights by roughly one-third, moved them inward, and shortened the surrounding rear panel so their scale better matches the supplied tuner-car reference.
- Removed the streetlight flare meshes entirely after browser inspection showed that they read as polygons placed in the world.
- Rebuilt the star-cross response as a screen-aligned highlight filter inside the camera shader. It now samples actual bright pixels along both diagonals and therefore remains a camera artifact rather than scene geometry.
- Increased the animated grain, block noise, scanline contrast, and rare colored compression flecks so the old-camera surface is visibly present during driving. The HTML instrument layer remains above it and stays crisp.
- Optimized the flare kernel from 36 highlight samples to 16 after an initial version measured about 50 FPS. The final 165 MPH browser run returned to 60 FPS with 12 nearby cars, 28 projected traffic beams, and six dynamic headlights.
- Final production build succeeds and all 26 automated gameplay tests pass. No game errors appeared in the browser.

## 2026-08-12 — Brightness, recording texture, rear composition, and headlight continuity

- Raised ACES exposure from 0.82 to 0.96 and modestly increased environment, hemisphere, directional, and neutral fill contributions. Road paint, bodywork, barriers, windows, and traffic now read more clearly without turning the night scene into daylight.
- Strengthened both recording layers: larger and faster animated grain, more visible horizontal scanlines, faint vertical subpixel lines, stronger block noise, and brighter rare compression flecks. The analog HUD remains unaffected above the camera layer.
- Rebuilt the fictional coupe rear around the supplied composition: silver bodywork, higher dark lamp band, four tight circular lamps, central reverse detail, deeper trunk and painted bumper, lower compact plate, wide black bumper opening, low diffuser/exhaust placement, reference-like wing height, and green underglow.
- Traced the incomplete headlight cone to a combination of road-depth intersection, a flat four-vertex projection, near-source fading, and two narrow dynamic spotlights overpowering the wider projected pool.
- Replaced the flat projection with a 20-segment ribbon that updates its vertex height from the procedural road on every frame. Restored depth occlusion, removed the narrow player spotlights, widened the shader footprint, and extended illumination to the vehicle nose. The result remains continuous through elevation changes and does not draw over the car.
- Browser checks covered menu, 92 MPH chase, drift/off-axis, and 169–174 MPH traffic/elevation states. The final warmed-up high-speed state held 60 FPS with 12 nearby vehicles and no browser errors.
- Final production build succeeds and all 26 gameplay tests pass.
## 2026-08-13 — MiniDV night-camera replacement pass

- Removed the previous VHS-style HTML overlay and its fixed scanlines, coarse moving grain pattern, vertical recording lines, compression blocks, colored flecks, and barrel distortion instead of layering another nostalgic filter over them.
- Rebuilt the camera shader around the four supplied references: dirty green/yellow night white balance, restrained saturation, crushed green-black shadows, clipped warm-white highlights, softened and lightly quantized chroma, shadow-weighted animated CCD/CMOS noise, and slight speed-dependent image persistence.
- Replaced the earlier general-purpose diagonal flare sampler with thresholded optical diffraction controls (`starburstIntensity`, `starburstThreshold`, `starburstLength`, `starburstRotation`, and `starburstChromaticSpread`). It produces two longer diagonal axes plus shorter horizontal/vertical rays only around extreme highlights.
- Raised bloom into a medium-radius, lower-threshold muddy optical response while keeping the world dark; kept chromatic misregistration subtle and concentrated near edges, blown lights, collisions, and extreme speed.
- Follow-up browser inspection found the first balance too destructive: pale plates and body highlights bloomed into white blobs, the headlight pool formed a hard wedge, signs smeared, and the 110° FOV made the player car too small. Reduced bloom/starburst/clipping, sensor noise, chroma blur, aberration, and motion persistence; converted player and traffic plates to dark tone-mapped materials; restored a soft gradual headlight cone; and capped speed FOV near 86°. The corrected live run holds 60 FPS with the car silhouette and red lamps readable at 161–182 MPH.

## 2026-08-13 — Drift score banking and feedback

- Changed drift scoring from small continuous additions into a clear banked award: the active drift readout now identifies points as unbanked, and a valid completed drift adds its full rounded value to the overall run score exactly once.
- Added a prominent top-center confirmation in the form `DRIFT +95 // TOTAL 000 095`, making both the award and its effect on the main score immediately visible.
- Added a pure score-banking helper and regression coverage for rounding and duplicate prevention.
- Browser-verified the complete flow with the deterministic drift fixture: the main score changed from `000 000` to `000 095`, the drift bank showed `00095`, and the popup displayed the matching award and total.
- Final production build succeeds and all 30 automated gameplay tests pass.

## 2026-08-13 — HUD simplification

- Removed the complete lower-left gameplay panel, including its sector, camera-mode, and separate drift-bank readouts. Camera changes and banked drift awards remain communicated through the top-center callouts.
- Removed the border, background, padding, and corner accent from the top-left score, leaving only the run score and best-score typography floating over gameplay.
- Browser-checked the simplified HUD during a live high-speed run. The lower-left view is completely clear and the score has no surrounding container.
- Production build succeeds and all 30 automated gameplay tests pass.

## 2026-08-13 — 150+ mph control, nitrous, and lighting refinement

- Reproduced the high-speed pendulum problem with the deterministic swerve fixture: the old 138 mph setup produced an 8.8 m/s lateral-velocity spike during direction changes.
- Accelerated only the non-handbrake keyboard steering crossover, reduced body-slip damping while countersteering, and blended the requested direction back through the front tire's existing friction capacity. Handbrake steering keeps its previous response and drift envelope.
- Raised the deterministic swerve fixture to 157 mph and added regression coverage requiring a prompt, bounded left-to-right lane-direction change at 150 mph. In browser sampling, ordinary pre-barrier lateral velocity stayed around 2 m/s and yaw stayed below 0.19 rad/s during repeated reversals.
- Rebuilt nitrous audio from a thin high-frequency hiss into layered filtered pressure noise, a bass-heavy low-frequency surge, and a short ignition transient. Added animated white-green exhaust cones, soft outlet glows, and trailing additive plumes at both exhaust tips.
- Increased environment, road-marker, building-window, skyline, traffic-headlight, city-fill, and player-light contributions by approximately 15 percent.
- Rebuilt the player headlight projection with transparent geometry margins, a broader curved feather, softer near/far fades, and lower near-field intensity. Moved the projection safely beyond the hood camera.
- Fixed the hood camera's high-speed positional lag, which was placing it several metres behind its mount and exposing the player's own headlight geometry as a white rectangular blob. The hood mount now stays physically attached while retaining smoothed look direction and speed vibration.
- Browser-checked chase and hood views at 155–174 mph. The headlight pool is a continuous soft cone, the hood-view obstruction is gone, the exhaust nitrous is visible, gameplay held roughly 50–60 FPS after warm-up, and no browser errors were recorded.
- Production build succeeds and all 31 automated gameplay tests pass. The existing non-fatal Rapier initialization deprecation warning remains.

## 2026-08-14 — Arcade highway handling, true headlights, and dense-traffic pass

- Compared the current tire-force model with established real-time vehicle conventions: slip-limited tires remain the physical foundation, while keyboard response now adds a bounded high-speed road-frame stability force similar to the trajectory assists commonly used in arcade racers.
- Removed the remaining 150+ mph pendulum behavior at both sources. The force assist makes lateral velocity follow a reversed key promptly, while the chase camera now uses restrained steering look-ahead instead of panning several metres into the turn and visually pushing the car the other way.
- Kept the assist fully disabled under handbrake input, preserving the existing loose rear axle, tire sound, and drift scoring.
- Deleted the player headlight projection mesh and shader. A true wide-angle spotlight now produces one soft merged pool across several lanes; a gentle full-frame lower-road exposure lift keeps it visible through the crushed camera grade, with no mesh silhouette, trapezoid, rectangular edge, or hood-camera clipping.
- Raised the traffic pool from 44 to 56, made the 1.32× dense setting the default, tightened the opening waves to 46 m, shortened recycle distance, reduced traffic speed variance, and prevented lane changes from sealing the last open corridor.
- Browser-verified chase and hood lighting, the deterministic 157 mph swerve, 47–56 active traffic light pools, 9–12 nearby vehicles, and roughly 50–60 FPS during the stress run. The broad road light has no visible polygon edge and the swerve fixture remained near 0.2 m/s lateral velocity with only 0.0066 rad rear slip immediately after reversal.
- Final automated gate: 6 files / 32 tests pass and the production build succeeds. Rapier's existing non-fatal initialization deprecation warning and Vite's bundle-size advisory remain unchanged.

## 2026-08-14 — Headlight visibility and moonlit skyline

- Restored a clearly visible player headlight footprint after live inspection showed the dark camera grade was visually swallowing the true spotlight. The dynamic wide-angle light remains, while its fully feathered camera-space exposure response is now strong enough to read across several lanes in both chase and hood views without a projection polygon or hard cone edge.
- Replaced the effectively invisible fogged full-moon sphere with a small procedural crescent sprite, a separate cool halo, and three layered translucent cloud wisps. The halo renders behind the clouds and the crescent just in front, giving the bloom a broken, cloud-filtered appearance.
- Added a low-intensity cool directional moonlight that lifts surrounding facades, barriers, lane paint, and asphalt slightly without changing the darkness-led art direction.
- Browser-checked the crescent and cloud bloom during live chase-camera play, then confirmed the restored road illumination in chase and hood cameras. The final composition keeps the moon small and the headlight pool broad and readable.
- All 32 automated gameplay tests pass; the final production build succeeds.

## 2026-08-14 — Player scale, acceleration, drift-entry, and swerve pass

- Lowered the fictional player coupe to the common compact traffic sedan's approximately 1.34 m visual roof line, reduced its width and length slightly, and inset its collision shell to make visibly open traffic gaps genuinely driveable.
- Increased drivetrain torque by 15 percent and added a modest mid-speed recovery factor that tapers away at higher speed. Brake-and-pass acceleration is stronger without bypassing gears, RPM, traction capacity, drag, or the fixed-step force simulation.
- Shortened drift scoring's initiation delay from 0.28 to 0.16 seconds and made the handbrake release rear grip more promptly. The normal steering stability assist remains disabled during handbrake slides.
- Increased keyboard steering response, lane-change lateral target, and bounded trajectory acceleration while retaining the prior high-speed reversal damping and front-axle authority.
- Browser-checked the resized coupe beside the common sedan, the drift fixture, and the 157 mph left-right swerve. At the sampled high-speed state, rear slip remained 0.0037 rad and the car stayed inside the controlled yaw envelope.
- Final automated gate: 6 files / 35 tests pass and the production build succeeds. Browser logs contain no game errors; Rapier's existing non-fatal initialization deprecation warning remains.

## 2026-08-14 — Low-poly tuner-coupe model rebuild

- Rebuilt the player-car silhouette from the supplied current/target comparison while keeping the fictional Asterion identity and lightweight PS2-era faceting. The shell is lower, slightly wider, longer through the rear quarters, and uses a more heavily sloped coupe cabin and rear glass.
- Replaced the tall slab rear with a short tapered bumper loft that wraps into the quarters, a recessed dark plate pocket, a restrained lower cutout, side skirts, and separate rear-quarter shoulders that tuck the wheels into the body.
- Replaced the four flat red dots with two distinct lamp pairs in an `O o    o O` arrangement. Each lamp has a dark cylindrical housing, low-poly emissive red ring, dark inset center, and a restrained lamp-local bloom sprite; braking raises emissive output and bloom without replacing the visible geometry.
- Rebuilt the spoiler as a wide thin blade on two substantial trunk-mounted pedestals with base plates, end plates, and a slight rearward pitch.
- Replaced green underglow with a blue-violet point source and soft elliptical pavement pool. Exhaust remains two small clean dark-metal tips; green nitrous flames remain temporary boost-only effects.
- Increased wheel diameter, reduced the tire sidewall visually, darkened the rims, widened the rear track slightly, and retained the existing wheel pivots and simulated steering/rotation.
- TypeScript verification, all 35 automated gameplay tests, and the production build pass. The local preview responds successfully at `http://127.0.0.1:4175/`.

## 2026-08-14 — Wide player and traffic headlight pass

- Re-aimed the player's true scene spotlight more steeply so its road wash begins close to the front bumper instead of landing mostly in the far distance. Increased its physically based intensity, angle, softness, and useful range while retaining geometry-free edges.
- Widened traffic's pooled headlight footprint to 8.4 m and lengthened it to 38 m. The shader now begins illuminating near each front bumper, stays useful farther down-road, feathers over a broader lateral area, and fades naturally without exposing the underlying plane boundary.
- Raised the six nearest traffic vehicles' true spotlights from an effectively invisible contribution to a useful warm-white asphalt response, increased their cone angle and range, and aimed them slightly downward.
- Added a hood-camera-aware camera-grade mask. Hood view receives a higher, wider, softly feathered road wash while chase view keeps the same source anchored visually near the player's car.
- Added regression coverage requiring traffic light pools to span more than two freeway lanes and extend beyond 32 m.
- TypeScript verification, all 36 automated tests, and the production build pass.

## 2026-08-14 — Heavy ordered-dither experiment

- Added a default-enabled `Heavy dither` option under Video Settings so the treatment can be compared instantly without removing the existing camera grade.
- Applied a stable 4×4 Bayer matrix in two-pixel blocks after bloom, headlight exposure, MiniDV color grading, and sensor noise. Reduced the rendered scene to a nine-step per-channel color ladder and blended the result at 94 percent for an intentionally strong early-digital texture.
- Kept the HTML instruments and menu typography outside the shader so driving information remains readable while the 3D scene, fog, asphalt, cars, lights, and skyline receive the full effect.
- TypeScript verification, all 36 automated tests, and the production build pass.

## 2026-08-14 — Traffic silhouette and physically separated lighting pass

- Removed the SUV and pickup silhouettes from ordinary traffic after the high bonnet/cabin profile continued to read as a malformed tall-hood sedan. Normal traffic now uses only the lower compact and coupe bodies; the separately modeled full-size truck remains a rare, clearly legible hazard.
- Removed the player-headlight exposure shape from the full-screen camera shader. The player now uses a substantially stronger real spotlight with a broad angle, near-maximum penumbra, downward aim, and long falloff so it illuminates the asphalt in both chase and hood views instead of brightening arbitrary screen pixels.
- Reworked traffic's inexpensive projected headlight material with independent feathering on all four mesh edges and an earlier longitudinal falloff. The light reaches zero before the plane boundary, eliminating the visible rectangular drop-off.
- Made white and yellow lane paint non-emissive, non-metallic, darker, and rougher so it remains readable in headlights without entering bloom/starburst as if it were a light source.
- Shifted orange optical emphasis to the roadside lamps: sodium cores are warmer and each lamp now carries a larger low-opacity additive orange halo.
- TypeScript verification, all 36 automated tests, and the production build pass. The live preview responds at `http://127.0.0.1:4175/`; direct visual browser control was unavailable for this pass.

## 2026-08-14 — Selective optical effects and full-moon pass

- Raised the global bloom and starburst thresholds so ordinary bright surfaces no longer trigger the optical treatment. Lane paint is now darker, fully rough, non-metallic, and non-emissive.
- Reduced the player's true scene spotlight intensity from 1320 to 430 to prevent severe specular bloom when following traffic. Added a separate fully feathered asphalt-only wash below the raised lane geometry, preserving a readable headlight footprint without brightening lane paint or nearby vehicle bodies.
- Changed street and tunnel fixtures to overbright tungsten yellow-orange sources. Added dedicated additive halos to both fixture types, while slightly increasing starburst strength and reach for sources that cross the new selective threshold.
- Replaced the small crescent with a 512 px procedurally textured full moon containing broad dark maria, dozens of crater depressions and highlighted rims, a larger disc, and a 148-unit atmospheric halo behind the cloud layer.
- TypeScript verification, all 36 automated gameplay tests, and the production build pass. The live preview responds successfully at `http://127.0.0.1:4175/`.

## 2026-08-14 — Resting taillight diffraction

- Replaced the player and traffic taillight halo maps with a dedicated red optical texture that combines a soft radial bloom and two short diagonal diffraction rays.
- The restrained star remains visible at resting brightness; braking scales and brightens the same effect rather than adding a separate oversized flare.
- TypeScript verification, all 36 automated tests, and the production build pass.

## 2026-08-14 — Painted-line optical treatment restored

- Restored the brighter reflective/emissive material treatment exclusively to the white lane dividers and white/yellow edge paint so those markings again enter bloom and starburst under the current camera grade.
- Left the reduced player-headlight reflection, selective tungsten fixtures, moon, traffic bodies, and taillight treatments unchanged.
- TypeScript verification, all 36 automated tests, and the production build pass.

## 2026-08-14 — Celestial anchoring

- Separated the full moon, atmospheric halo, and moonlit cloud wisps from the recycling distant-building group.
- The celestial group now tracks the player's continuous road position and heading at a fixed distant offset, eliminating forward parallax and the periodic jumps caused by skyline recentering while retaining natural movement when the player deliberately changes camera direction.
- TypeScript verification, all 36 automated tests, and the production build pass.

## 2026-08-14 — Predictable traffic lane changes

- Added visible rear amber indicators to every traffic archetype. The appropriate side flashes for at least 1.25 seconds before lateral motion begins and remains active until the vehicle settles in the destination lane.
- Added a final front/rear gap check after the warning phase, plus conflict detection for nearby vehicles signaling toward the same destination lane. Unsafe maneuvers are cancelled and retried later.
- Replaced exponential lane interpolation with a fixed-duration fifth-order S-curve. Lateral speed is zero at entry and exit, peaks smoothly in the middle, and now drives the visible body yaw and collision-relative lateral velocity.
- Added regression coverage for signal lead time, exact lane endpoints, zero entry/exit velocity, and smooth midpoint motion.
- TypeScript verification, all 37 automated tests, and the production build pass.

## 2026-08-14 — Following-car headlight glare adjustment

- Increased only the player's true scene spotlight from 430 to 520 intensity (500 to 600 under boost), restoring a modest warm glare on the vehicle directly ahead without changing the separate asphalt wash or global optical thresholds.
- TypeScript verification, all 37 automated tests, and the production build pass.

## 2026-08-14 — Persistent player asphalt headlights

- Fixed the apparent start-of-run headlight “unroll,” which was caused by the long near-coplanar light wash progressively intersecting the highway's elevation changes.
- Shortened the player wash to traffic-like proportions, raised it slightly above the asphalt, and increased its road-light contribution by roughly 65 percent. Its complete feathered footprint is now present immediately and remains stable as the road rises and falls.
- TypeScript verification, all 37 automated tests, and the production build pass.

## 2026-08-14 — Dynamic run-opening drone shot

- Added a 5.2-second opening cinematic to every normal run. It begins approximately 135 m behind, 68 m to the side, and 76 m above the moving player car, framing the highway, skyline, clouds, and full moon.
- The camera follows cubic position and look-target paths through a lateral aerial sweep and descending approach, then exactly matches the existing chase-camera position, target, and speed-sensitive FOV at handoff.
- The vehicle, traffic, lighting, engine audio, and fixed-step simulation are live throughout the shot. Steering, scoring, and collisions remain suppressed until control is handed to the player.
- The HUD fades in during the final quarter of the descent. Enter, Space, or Escape skips immediately to the chase camera. Debug-mode starts bypass the cinematic to preserve deterministic browser fixtures.
- Added regression coverage for the cinematic easing endpoints and midpoint. TypeScript verification, all 38 automated tests, and the production build pass; the live preview responds at `http://127.0.0.1:4175/`.

## 2026-08-14 — Triple-width headlight street spread

- Widened the far-end asphalt footprint for both the player and every traffic vehicle to exactly three times its previous coverage (traffic: 8.4 m to 25.2 m; player: 10.4 m to 31.2 m).
- Reduced the near-cone shader width by the reciprocal amount, preserving the exact physical footprint at each bumper. A smooth nonlinear expansion now opens the light across the road only with distance.
- Retained the existing longitudinal reach, intensity, complete edge feathering, and real spotlights. Updated regression coverage verifies the traffic pool's exact three-times width.
- TypeScript verification, all 38 automated tests, and the production build pass.

## 2026-08-14 — Centerline drone path and closer FOV

- Moved the entire aerial portion of the opening cinematic onto the highway centerline. It now starts 92 m above and 80 m behind the moving car with no lateral offset, then remains over the road until the final chase settle, preventing procedural roadside buildings from intersecting the camera.
- Tightened the normal chase/hood FOV range from approximately 66–86 degrees to 62–80 degrees, with slightly reduced boost and braking excursions, so the player car remains larger and closer throughout the speed range.
- Added a live chase-pose interface. Every cinematic frame now targets the chase camera's exact internal position, look target, and FOV; the final intro frame and first playable frame are mathematically identical even with acceleration pullback and speed-based look-ahead.
- Added regression coverage for the revised 62–80 degree range. TypeScript verification, all 39 automated tests, and the production build pass.

## 2026-08-14 — Recessed headlamps and dimensional city-light rebuild

- Recessed the visible white headlamp lenses into the player and traffic front fascias, eliminating the small rectangular meshes that appeared to float ahead of each hood. Road-light projection geometry is unchanged.
- Increased nearby procedural structures from 10 to 14 per 150 m highway segment and expanded their individual window capacity from 160 to 760. Window dots and irregular horizontal office bands now follow each building's actual rotation across both the road-facing and perpendicular façades.
- Rebuilt the distant skyline as dark structural masses with up to 5,600 separately instanced windows across two visible faces per tower. Warm office light, neutral white, cool blue, muted green, occasional overbright rooms, fully dark floors, and uneven occupancy create depth without becoming a flat luminous wall.
- Kept the expanded city efficient through instancing: the distant window field remains one additional draw call, while each reusable nearby segment uses the same three batched building/window draws as before.
- TypeScript verification, all 39 automated tests, and the production build pass.
## 2026-08-14 — Brighter photographic city windows and safe intro handoff

- Lifted nearby and distant building-window luminance above the selective bloom threshold while preserving dark building bodies.
- Added restrained additive halo batches behind window panes for softer, slightly defocused nighttime city lights without multiplying individual dynamic lights.
- Kept warm, neutral, cool, and muted-green window variation across two perpendicular facades for three-dimensional tower readability.
- Added a 120 m cinematic-only opening buffer to the initial traffic placement, leaving the player centered with a safe clear area when control begins; ordinary dense traffic recycling remains unchanged.
- Added regression coverage for the cinematic traffic buffer.
- TypeScript verification, all 40 automated tests, and the production build pass; the live preview responds at `http://127.0.0.1:4175/`.

## 2026-08-14 — Center-lane intro lock and outside-lane establishing traffic

- Locked the moving player to the exact center-lane road spline throughout the intro, including road heading and road-relative velocity, so the first controllable frame begins precisely centered even on a curved highway segment.
- Added two staggered traffic pairs to the far-left and far-right lanes for the establishing shot while leaving the middle three lanes clear.
- Delayed those four vehicles' lane-change decisions until after the cinematic handoff, preserving the safe opening composition.
- Added regression coverage for the outside-lane cinematic tableau.
- TypeScript verification, all 41 automated tests, and the production build pass.

## 2026-08-14 — Collision, headlight projection, and unified risk scoring pass

- Replaced axis-aligned player/traffic overlap with road-relative projected footprints that expand correctly with player and traffic yaw. Drifted front/rear corners can no longer pass invisibly through an unrotated collision box.
- Added minimum-penetration positional correction before collision impulse response, fixing kinematic bodies continuing through one another during scrape cooldown; corrected the side-contact impulse normal.
- Replaced player and traffic headlamp boxes with zero-depth fascia planes, removing emissive side faces that appeared to float during drifts and passes.
- Aligned the player and traffic asphalt-light projection planes to the local highway grade and lowered them onto the road surface, preventing long headlight polygons from hovering above elevation changes.
- Drift recognition now begins at shallow, intentional handbrake slip instead of requiring a near-sideways attitude. Live drift points enter the overall score immediately, drift initiation raises the chain, and completion pays a smaller bank bonus.
- Added 100/120/140/160 MPH risk tiers up to ×2.0. The effective multiplier is shown in the HUD, boosts near-miss/drift awards, and high-speed driving earns continuous score above 100 MPH.
- Near misses now use the actual collision footprints rather than wider visual-body estimates. Thread the Needle compares the two vehicles' physical overlap times within a 0.65 s window, making staggered two-car gaps register reliably.
- Scrapes reduce the chain while preserving its remaining timer; major impacts still break it.
- TypeScript verification, all 45 automated tests, and the production build pass. The only build notice remains Vite's non-fatal bundle-size advisory.

## 2026-08-14 — Player lamp cleanup, faster intro, and hosted music fix

- Increased the player taillights' resting emissive intensity and soft sprite opacity slightly, with a modest braking-state increase for clearer nighttime bloom.
- Shortened the intro from 5.2 to 4.35 seconds and lowered its opening/sweep control points from 92/58 m to 70/44 m for a faster, closer establishing shot.
- Removed the player car's two remaining front lens planes entirely; the real spotlight and asphalt wash remain, so no visible rectangular lamp geometry can float ahead during a drift.
- Fixed the soundtrack URL to resolve under both localhost and the GitHub Pages repository subpath, raised its mix from .24 to .34, and initiates playback immediately inside the Start Run user gesture.
- Added regression coverage for local and GitHub Pages soundtrack URLs.
