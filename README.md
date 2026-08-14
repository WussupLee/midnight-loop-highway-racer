# MIDNIGHT LOOP

The hosted version is deployed automatically to GitHub Pages whenever the default branch is updated.

MIDNIGHT LOOP is an original browser-based 3D highway score-attack racer. It combines force-integrated arcade-simulation handling, five lanes of independent traffic, close-pass scoring, a rechargeable boost system, a persistent local record, and a gritty early-2000s American freeway atmosphere. It uses no licensed cars, brands, maps, or proprietary game assets. The local build includes the user-supplied background track described below.

## Start the game

Requirements: Node.js 22 or newer and desktop Chrome.

```bash
npm install
npm run dev
```

Midnight Loop opens at the local address printed by Vite. The dedicated preview used for this project is `http://127.0.0.1:4175/`, keeping it separate from other local game projects. Click **Start Run** once to enable the engine/effects audio and background music, then begin driving.

For a designer-friendly test build, add `?debug=1` to the address. The on-screen panel can start automatic driving, jump to 157 MPH, force a crash, and stage every scoring scenario without developer tools.

Production validation:

```bash
npm run test
npm run build
npm run preview
```

## Controls

| Control | Action |
| --- | --- |
| W / Up Arrow | Throttle |
| S / Down Arrow | Brake; reverse below walking speed |
| A / Left Arrow | Steer left |
| D / Right Arrow | Steer right |
| Space | Handbrake drift |
| Shift | Boost while the meter has charge |
| C | Switch between chase and hood/first-person cameras |
| R | Recover onto the freeway |
| Escape | Pause / resume |
| M | Mute / unmute |

Steering is speed-sensitive and smoothed for keyboard play. Normal high-speed steering uses a front-axle-led, tightly controlled yaw envelope with additional rear stabilization during rapid left-right transitions; its tuned lateral response is quick enough for dense-traffic lane changes. Service braking adds straight-line lateral and yaw stabilization; it does not release rear grip. The handbrake is deliberately separate: it releases rear grip quickly, opens the wider drift envelope, and enables drift scoring. A stronger mid-speed torque recovery makes brake-and-pass moves responsive while preserving the simulated gearbox and tire-force limits.

Traffic collision shells sit slightly inside the visible body panels. A shallow door-to-door overlap is treated as a scrape: it produces sound, a small lateral nudge, mild combo damage, and no artificial spin. Front/rear impacts and hard lateral strikes still use the full crash response. This lets visually plausible gaps remain playable without making direct collisions harmless.

## How to score

Pass traffic with genuine side clearance while moving substantially faster. A score is awarded only after approach, overlap, and clean separation; sitting beside a vehicle earns nothing. Score scales with clearance, speed, closing speed, and the active risk-chain multiplier. Each traffic spawn can award only once, preventing repeated farming.

Near misses inside 4.25 seconds build the chain up to ×8. The recognition envelope is forgiving enough for keyboard lane changes, while the nonlinear score still strongly favors genuinely close passes. Very close fast passes become Perfect Passes. Crossing a narrow gap between two cars triggers Thread the Needle. Drafting before a pass adds a release bonus. Sustained handbrake slides accumulate an unbanked drift session after the car reaches a genuine slip angle, yaw rate, speed, and curved radius; a straight brake lockup or backwards spin does not qualify. When a valid drift ends, its complete award is added once to the overall run score and a top-center popup shows both `DRIFT +points` and the updated total. Risk refills boost, which creates the loop: risk → speed → greater risk.

## Architecture

- `src/main.ts` — fixed-step loop, input, run flow, Rapier synchronization, scoring orchestration, HUD, crash cut, and debug bridge.
- `src/game/vehicle.ts` — deterministic 120 Hz custom tire, steering, yaw, drivetrain, brake, handbrake, drag, and load-transfer simulation.
- `src/game/scoring.ts` — pure pass lifecycle, nonlinear scoring, duplicate prevention, and combo logic.
- `src/game/drift.ts` — pure drift qualification, radius/angle validation, point accumulation, and completion awards.
- `src/game/world.ts` — restart-safe recycled curved five-lane freeway, shoulders, Jersey barriers, tunnels, overpasses, original green signage, warm lighting, and skyline.
- `src/game/traffic.ts` — bounded 56-vehicle pool, a low-profile traffic mix (compact, coupe, SUV, and pickup, plus rare large trucks), gap-preserving three-car opening waves, safe lane changes, hybrid traffic headlights, and collisions.
- `src/game/vehicleMeshes.ts` — shared PS2-era faceted loft geometry, low-cost round lamps, and soft additive glow texture generation for underglow and night-visible brake-light halos.
- `src/game/visuals.ts` — original silver tuner coupe, reference-aligned four-round rear composition, raised wing, compact lower plate, bumper opening, green underglow, broad soft dynamic headlights, chase/hood cameras, and speed effects.
- `src/game/audio.ts` — procedural engine, throttle, overrun, road, braking, tires, boost, wind, stereo traffic passes, impacts, crash layers, UI, and background-track playback.

## Music asset

The game includes the user-supplied recording `FREE PLAYBOI CARTI x PIERRE BOURNE x TLOP5 TYPE BEAT YUGIOH w. NEONN.mp3`, stored locally as `public/audio/midnight-loop-background.mp3`. It starts after **Start Run** (to satisfy browser autoplay rules), pauses with the game, obeys the **M** master mute control, and rewinds when returning to the title screen. No license file accompanied the recording; anyone distributing or publishing this build must independently confirm they have the necessary rights to use it.

Three.js renders with ACES tone mapping, fog, dark wet materials, darkness-led exposure, warm practical lamps, reflective markings, muddy optical bloom, dense rectangular facade lights, and restrained green/violet instrumentation. A small procedural crescent moon sits above the skyline with layered wispy clouds, cool bloom, and a restrained directional moonlight contribution across buildings and pavement. A single lightweight camera shader recreates early-2000s Japanese highway footage and consumer MiniDV night response: limited dynamic range, clipped warm-white highlights, crushed green-black shadows, subtle yellow/green white-balance error, restrained saturation, softened/quantized chroma, shadow-weighted animated sensor noise, slight speed persistence, thresholded eight-point diffraction, and restrained edge/highlight RGB misregistration. The prior VHS scanlines, coarse blocks, colored flecks, barrel warp, and HTML grain overlay were removed rather than stacked beneath the new treatment. The HUD stays outside the camera treatment so it remains legible. The player uses a true wide-angle spotlight with a heavily feathered edge plus a stronger camera-space exposure lift that prevents the dark video grade from crushing the road pool; neither layer uses a visible projection polygon. Menus and secondary telemetry use an original PS2-era network/dossier language. Every active traffic car has emissive lamps, additive brake-light halos, and a low-cost projected road beam; the six nearest relevant cars additionally receive true dynamic spotlights. Rapier supplies contact pairs while the custom force model owns player dynamics. Rendering interpolates the 120 Hz physics poses so camera and car motion remain smooth between simulation ticks.

## Physics approach

The 1,360 kg coupe evolves through longitudinal/lateral velocity, yaw rate, and forces—never lane interpolation. The model calculates speed-sensitive steering, front/rear slip angle, axle loads, lateral transfer, saturated cornering force, friction-circle coupling, engine braking, rolling resistance, and aerodynamic drag. Above highway speed, a bounded road-frame stability force helps keyboard reversals settle promptly instead of letting old rear-axle momentum carry the car across an extra lane; the handbrake disables this assistance for real slides. A six-speed automatic derives RPM from wheel speed, gear ratio, and final drive, then applies an interpolated torque curve.

## Browser debug panel

Open `http://127.0.0.1:4175/?debug=1` while the dedicated preview is running. The panel exposes:

- Auto Drive, High Speed, and deterministic Drift Test presentation modes.
- Normal Pass, Near Miss, Distant Pass, Duplicate, Collision, and Thread Needle fixtures.
- A Side Scrape fixture that distinguishes a survivable panel graze from the severe Collision fixture.
- Live speed, RPM, gear, slip, drift angle/radius, steering, score, combo, camera FOV/shake/distance, traffic, FPS, and contact telemetry.
- A Force Crash button for the black-impact-cut and restart flow.

## Known limitations

- Keyboard is the primary input; gamepad and touch are not implemented.
- Vehicle and traffic models use original runtime-built faceted shells rather than authored high-detail or licensed meshes.
- Automotive effects are synthesized at runtime, so they are intentionally more stylized than recorded vehicle audio.
- The world is semi-endless and recycled; it is not an open city map.
- Traffic uses projected light pools plus six nearby dynamic spotlights instead of one costly true spotlight per vehicle.
- The large Three.js/Rapier production bundle triggers Vite's non-fatal size advisory.
