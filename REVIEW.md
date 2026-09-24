# MIDNIGHT LOOP / Tuner Series 02

Implemented 2026-09-24. This review supersedes older handling/scoring acceptance claims.

## Requirements and implementation

| Request | Implementation | Evidence / remaining gate |
| --- | --- | --- |
| New car tires stay attached | Four centered hub assemblies, shared tire/rim spin pivots, separate rear wheels; sprung body isolated from wheel placement | Actual bundled GLB loaded in regression tests; 240 frames of forward/reverse rotation, steering, and body lean |
| Responsive handling with weight | Combined axle grip limits, progressive lateral saturation, bounded body-slip/yaw assistance, continuous drift-grip blend | Existing steering regressions plus 60/100/140 MPH slaloms pass |
| More useful acceleration | Faster throttle pickup, demand-sensitive kickdown, shift hysteresis, corrected same-tick gear ratio | 60–100 MPH under eight seconds without nitrous; brake/reaccelerate tests |
| Dynamic drift | Handbrake initiates; a qualifying slide continues after release; countersteering controls recovery | Physical transition scenarios at 60/100/140 MPH and drift-state tests |
| Forgiving contact | Oriented SAT/swept contact checks shared by manual and Rapier paths; actual traffic velocity; deterministic bounded impulses; continuous separation correction | Relative-speed scrape/moderate/extreme contact and swept-crossing tests |
| Clean-exit drift scoring | Pending points shown separately; entire award banks once after 0.35 s recovery and 0.5 s qualifying drift; contacts/spins/reverse/recover discard pending points | Banking, transition, invalidation, and ledger tests |
| Fair bonuses | Pre-event multiplier shared across a pass and its bonuses; expiry before awards; simultaneous passes share a tick snapshot; overlapping narrow gaps required for needle; three-second draft eligibility | Pass lifecycle, needle window, ledger reconciliation, duplicate prevention tests |
| Accurate speedometer | SVG faces generate ticks/labels/needles from common 0–220 MPH and 0–8,000 RPM calibration; 7,200 RPM redline; time-based needle damping | Every major mark and refresh-rate-independent damping tested |
| Consistent underground shell | Charcoal/metal panels, ivory instrument marks, acid-green selection, orange needles, condensed title typography; loading/showroom/settings/pause/results/HUD share tokens | Source/build checked; fresh screenshot inspection still required |
| Desktop and phone | Existing keyboard/multi-touch/tilt/swipe controls retained; safe-area layouts, reflowed gauges above phone controls, reduced-motion support | Existing input tests pass; physical iOS/Android playtests still required |

Both selectable cars retain identical physics. Their authored wheel radii affect visual rotation only. The American freeway, recent route variation, engine sound choices, tunnel acoustics, clear lower-left view, static dithering, and absence of fisheye/VHS tracking are preserved.

## Design research and interpretation

- [NIGHT-RUNNERS developer page](https://store.steampowered.com/app/2707900/NIGHTRUNNERS_PROLOGUE/): 1990–2009 street-racing setting, garage/car-meet presentation, configurable camera effects. Our interpretation emphasizes the car and period instruments; it does not reproduce proprietary art or restore previously rejected VHS effects.
- [Original EA Underground 2 manual](https://manuals.plus/m/50c5d562cd775b55ee19afa2a587773422301f1bc5e6cd34f9c8fbb590f8d586.pdf): separate speed, tachometer, and nitrous displays; stability-control settings; skillful driving replenishes nitrous. Applied to legible instruments and the existing risk/reward loop, without adding a career or customization economy.
- [Art of Rally developer site](https://www.artofrally.com/): accessible handling with countersteering, handbrake turns, and recognizable driving techniques. Applied as a design principle, not a claim to reproduce its proprietary physics.
- [Inertial Drift developer listing](https://store.steampowered.com/app/1184480/Inertial_Drift/): deliberate drift control and a consistent period identity informed the review. Its twin-stick scheme is not adopted because this game must retain keyboard and phone controls.
- [PhysX vehicle documentation](https://nvidia-omniverse.github.io/PhysX/physx/5.4.1/docs/Vehicles.html): tire-force generation and combination informed the axle-force limits. The project retains its custom 120 Hz model and does not introduce PhysX.
- [Three.js Object3D](https://threejs.org/docs/pages/Object3D.html): local transforms underpin the centered hub/spin hierarchy. Authored geometry is transformed into the car frame before splitting rear assemblies.
- [Rapier contacts](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection/): contact-pair existence alone is insufficient; penetration is checked before the shared oriented contact calculation. Custom vehicle dynamics continue to own response.

## Score rules

- Pass, draft, and needle awards use the same pre-pass chain × speed multiplier. Multiple passes completed in one physics tick use one multiplier snapshot.
- Needle requires different vehicles on opposite sides, simultaneous longitudinal overlap, positive clearance, and combined side clearance no greater than 1.8 m. Each pair pays once.
- Drift accrual uses the current chain × speed multiplier each physics tick; already accrued points are not multiplied again at banking. Initiation never increments the chain. One completed drift increments it once.
- Passive high-speed points use chain only. Fractions accumulate without per-frame rounding loss.
- Light scrapes reduce the chain; harder contact resets it. Any contact cancels a pending drift. Earned run points are retained.
- A normal closing speed of 30 m/s triggers an extreme crash. Absolute road speed does not determine whether a scrape is fatal.
- Series 02 records use `midnight-loop-v2-high-score`; prior scores remain stored and appear as a labeled legacy record. Existing vehicle, audio, and control preferences are preserved.

## Validation and remaining limitations

99 tests pass, TypeScript checks pass, and production bundling succeeds. Existing warnings: Rapier initialization deprecation and the large Three.js/Rapier bundle advisory. Neither is a new runtime-error finding.

Browser automation could not initialize in this environment. No fresh browser screenshots, JavaScript-console audit, GPU frame-time benchmark, or physical-phone validation is claimed. Earlier screenshots are historical and are not evidence for this revision.

Remaining visual acceptance checks: inspect loading, both showroom cars, expanded settings, active driving, pause, crash, results, and restart at 1280×720, 1920×1080, 390×844, and 360×640. Check wheel position while steering/drifting, gauge readability without covering the car, combined touch inputs, tilt calibration, lost-pointer cleanup, audio unlock, and five-minute frame-time stability on actual iOS/Android hardware. Compare each device against the previous build on that same device; aim for 60 FPS where hardware supports it.

Local preview: `http://127.0.0.1:4175/`. Add `?debug=1` for deterministic scenarios. Publication follows the GitHub Pages workflow on the main branch; deployment does not replace the outstanding visual and physical-device checks.
