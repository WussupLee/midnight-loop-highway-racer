# MIDNIGHT LOOP

**[Play MIDNIGHT LOOP in your browser](https://wussuplee.github.io/midnight-loop-highway-racer/)**

The hosted version is deployed automatically to GitHub Pages whenever the default branch is updated.

MIDNIGHT LOOP is an original browser-based 3D highway score-attack racer. It combines force-integrated arcade-simulation handling, five lanes of independent traffic, close-pass scoring, a rechargeable boost system, a persistent local record, and a gritty early-2000s American freeway atmosphere. Its two selectable cars are fictional and unbranded; the imported base mesh for the KITSUNE R-SPEC is a CC0 asset credited below. The local build includes the user-supplied background track described below.

## Start the game

Requirements for local development: Node.js 22 or newer and desktop Chrome. The published game also supports modern touch-capable Chrome and Safari browsers in portrait orientation.

```bash
npm install
npm run dev
```

Midnight Loop opens at the local address printed by Vite. The dedicated preview used for this project is `http://127.0.0.1:4175/`, keeping it separate from other local game projects. On the home screen, use the arrow buttons or Left/Right (A/D) to choose a car, and drag or swipe across the car to inspect it while it rotates through a full 360 degrees. Click the full-width **Start Run** button (or press Enter/Space) to enable audio and begin driving. The chosen car is remembered locally.

For a designer-friendly test build, add `?debug=1` to the address. The on-screen panel can start automatic driving, jump to 157 MPH, force a crash, and stage every scoring scenario without developer tools.

Production validation:

```bash
npm run test
npm run build
npm run preview
```

## Tuner Series 02

The local revision fixes wheel hubs, introduces progressive drift recovery and forgiving contacts, banks drift points on clean exits, and replaces the shell and gauges with a consistent tuner instrument theme. See [REVIEW.md](REVIEW.md) for research, scoring rules, implementation evidence, and the remaining browser/phone validation gates. The public play link above tracks successful deployments from the main branch.

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

### Mobile controls

Phones and touch-capable tablets automatically receive a close portrait cockpit layout. In the default Thumb Controls mode, slide one finger continuously across the large left/right steering zone without lifting. The right side groups the outlined BRAKE and GAS pedals with a dedicated handbrake lever directly above GAS. Swipe upward from GAS to trigger a short N2O burst; holding after the swipe sustains boost while charge remains. All controls support simultaneous touches. Small top controls switch the camera, pause, and recover the car.

The Driver Controls menu also offers Tilt Steering. This mode auto-accelerates, maps calibrated phone roll to smoothed steering with a center dead zone, and replaces the pedal layout with three large bottom actions: N2O at left, handbrake at center, and service brake at right. `CAL` recenters the current phone angle. iPhone/iPad may display the standard motion-access prompt when Tilt Steering is selected; denied or unavailable motion access returns the game to Thumb Controls.

Steering is speed-sensitive and smoothed for keyboard play. Combined axle grip limits and progressive tire saturation supply the base response; bounded body-slip and yaw assistance keep fast countersteering manageable. No road-velocity target moves the car between lanes. Grip assistance fades continuously into a deliberate handbrake slide and returns progressively during recovery. Service braking remains distinct from handbraking. Throttle demand can kick down the automatic gearbox for a stronger passing response.

Traffic uses slightly inset oriented collision shells. Side scrapes nudge the player and reduce the combo; moderate impacts slow and deflect the car without ending the run. Hard impacts at 18 m/s normal closing speed (about 40 mph relative to the other car or wall) end the run, including during effect cooldowns. Contact correction continues during cooldowns, and the manual and Rapier contact paths share one response calculation.

## How to score

Pass traffic with genuine side clearance while moving substantially faster. A score is awarded only after approach, overlap, and clean separation; sitting beside a vehicle earns nothing. Score scales with clearance, speed, closing speed, and the active risk-chain multiplier. Each traffic spawn can award only once, preventing repeated farming.

Near misses inside 4.25 seconds build the chain up to ×8. Tight, fast passes receive higher scores. Needle bonuses require two opposite-side passes with overlapping intervals and a genuinely narrow gap. Draft eligibility expires three seconds after losing the drafting position. Chain and speed multipliers are displayed separately; a pass and its associated bonuses use the same pre-award multiplier.

A handbrake initiates a drift, but a qualifying slide can continue under throttle and countersteer after release. Points remain unbanked until 0.35 seconds of clean recovery after at least 0.5 seconds of qualifying drift. The full award is then added exactly once. Contact, a spin, reverse, recovery, or quitting discards the pending drift. The results breakdown reconciles with the total score. Passive high-speed points use chain only; drift/pass rewards also use the displayed speed multiplier.

Series 02 records are separate from old scores, which remain stored and appear as a labeled legacy record. Both selectable cars retain the same gameplay mechanics.

## Architecture

- `src/main.ts` - fixed-step loop, keyboard/multi-touch input, run flow, Rapier synchronization, scoring orchestration, HUD, crash cut, and debug bridge.
- `src/game/carSelection.ts` - typed car catalog, selection wrapping, display metadata, and persistent selection IDs.
- `src/game/mobileControls.ts` - pure multi-touch action state, continuous steering-zone direction selection, and conversion into the shared driver input model.
- `src/game/vehicle.ts` — deterministic 120 Hz custom tire, steering, yaw, drivetrain, brake, handbrake, drag, and load-transfer simulation.
- `src/game/scoring.ts` — pure pass lifecycle, nonlinear scoring, duplicate prevention, and combo logic.
- `src/game/drift.ts` — pure drift qualification, radius/angle validation, point accumulation, and completion awards.
- `src/game/world.ts` - restart-safe recycled curved five-lane freeway, shoulders, Jersey barriers, constructed tunnels with segmented concrete walls, vents and utility conduits, overpasses, original green signage, warm lighting, and skyline.
- `src/game/traffic.ts` — bounded 56-vehicle pool, a low-profile traffic mix (compact, coupe, SUV, and pickup, plus rare large trucks), gap-preserving three-car opening waves, safe lane changes, hybrid traffic headlights, and collisions.
- `src/game/vehicleMeshes.ts` — shared PS2-era faceted loft geometry, low-cost round lamps, and soft additive glow texture generation for underglow and night-visible brake-light halos.
- `src/game/wheelRig.ts` — centered wheel assemblies, authored geometry splitting, and body isolation.
- `src/game/contact.ts` — shared oriented and swept vehicle contact geometry.
- `src/game/scoreLedger.ts` — deduplicated awards and reconciled category totals.
- `src/game/instruments.ts` — shared SVG dial calibration and refresh-independent needle damping.
- `src/game/visuals.ts` — the original silver Asterion tuner coupe plus the imported-and-restyled gunmetal Kitsune sports car, independently animated wheels, model-aligned head/brake lights, underglow, chase/hood cameras, and speed effects.
- `src/game/audio.ts` — procedural engine, throttle, overrun, road, braking, tires, boost, wind, stereo traffic passes, impacts, crash layers, UI, and background-track playback.

## Music asset

The game includes the user-supplied recording `FREE PLAYBOI CARTI x PIERRE BOURNE x TLOP5 TYPE BEAT YUGIOH w. NEONN.mp3`, stored locally as `public/audio/midnight-loop-background.mp3`. It starts after **Start Run** (to satisfy browser autoplay rules), pauses with the game, obeys the **M** master mute control, and rewinds when returning to the title screen. No license file accompanied the recording; anyone distributing or publishing this build must independently confirm they have the necessary rights to use it.

Three.js renders with ACES tone mapping, fog, dark wet materials, darkness-led exposure, warm practical lamps, reflective markings, muddy optical bloom, dense rectangular facade lights, and restrained ivory instruments with amber needles and acid-green interface accents. A procedural moon sits above the skyline with layered wispy clouds, cool bloom, and restrained directional moonlight. The camera shader uses clipped MiniDV night response, softened and quantized chroma, animated sensor noise, speed persistence, diffraction, RGB misregistration, and heavy ordered dithering. Fisheye/barrel distortion, VHS scanlines, rolling tracking bands, and the VHS color filter are not applied. A static pointer-transparent ordered-dither layer remains above the complete application, including HUD, menus, loading, crash presentation, and touch controls. The player uses only a true wide-angle spotlight; the former additive projection plane was removed so no headlight polygon can appear during the intro or a drift. The hood camera looks across an actual crowned hood surface and receives the same high-speed vibration language as chase view. Every active traffic car has emissive lamps, additive brake-light halos, and a low-cost projected road beam; the six nearest relevant cars additionally receive true dynamic spotlights. Rapier supplies contact pairs while the custom force model owns player dynamics. Rendering interpolates the 120 Hz physics poses so camera and car motion remain smooth between simulation ticks.

Procedural audio includes drivetrain, tire, road, boost, collision, and speed-dependent atmosphere. Every completed traffic pass produces a spatial Doppler-style body-and-air whoosh, with close fast passes becoming substantially stronger and the near-miss/perfect-pass sting layering over the same moment. Traffic can occasionally answer with a spatially positioned recorded horn. Music is intentionally bass-reduced below 95 mph; crossing 95 mph smoothly restores its low end while the speed-dependent wind continues to rise.

The traffic horn is adapted in playback only (level, stereo position, filtering, and speed-dependent pitch) from **Car Horn.wav** by 15HPanska_Ruttner_Jan, obtained through Wikimedia Commons and released under the [CC0 1.0 public-domain dedication](https://commons.wikimedia.org/wiki/File:Car_Horn.wav). The bundled browser asset is `public/audio/traffic-car-horn.ogg`.

## Vehicle asset

The KITSUNE R-SPEC uses Quaternius's complete [Sports Car model](https://poly.pizza/m/OyqKvX9xNh) from the creator's [Cars Pack](https://quaternius.com/packs/cars.html), released under the [CC0 1.0 public-domain dedication](https://creativecommons.org/publicdomain/zero/1.0/). The intact authored body, windows, lamps, bumpers, and wheel geometry are retained; the game restyles its materials, rigs its wheel objects, and adds lighting effects. See `public/models/ATTRIBUTIONS.md` for the bundled-asset record.

## Physics approach

The 1,360 kg coupe evolves through longitudinal/lateral velocity, yaw rate, and forces—never lane interpolation. The model calculates speed-sensitive steering, front/rear slip angle, axle loads, lateral transfer, saturated cornering force, friction-circle coupling, engine braking, rolling resistance, and aerodynamic drag. At highway speed, bounded body-slip damping and yaw assistance help reversals settle without prescribing road-frame velocity. Assistance blends out as the car enters a slide. A six-speed automatic derives RPM from wheel speed, gear ratio, and final drive, then applies an interpolated torque curve.

## Browser debug panel

Open `http://127.0.0.1:4175/?debug=1` while the dedicated preview is running. The panel exposes:

- Auto Drive, High Speed, and deterministic Drift Test presentation modes.
- Normal Pass, Near Miss, Distant Pass, Duplicate, Collision, and Thread Needle fixtures.
- A Side Scrape fixture that distinguishes a survivable panel graze from the severe Collision fixture.
- Live speed, RPM, gear, slip, drift angle/radius, steering, score, combo, camera FOV/shake/distance, traffic, FPS, and contact telemetry.
- A Force Crash button for the black-impact-cut and restart flow.

## Known limitations

- Mobile touch controls are tuned for portrait phones; landscape phone and tablet layouts remain usable but do not receive the same bespoke camera framing.
- Tilt sensitivity is calibrated for portrait phone play and depends on the quality/rate of the device orientation sensors.
- Gamepad input is not implemented.
- Vehicle and traffic art deliberately uses lightweight PS2-era geometry: one player car is runtime-built and the other starts from a low-poly CC0 mesh, rather than a modern high-detail licensed vehicle.
- Most automotive effects are synthesized at runtime, while traffic horns use a CC0 recording; the procedural engine and impacts remain intentionally more stylized than fully recorded vehicle audio.
- The world is semi-endless and recycled; it is not an open city map.
- Traffic uses projected light pools plus six nearby dynamic spotlights instead of one costly true spotlight per vehicle.
- The large Three.js/Rapier production bundle triggers Vite's non-fatal size advisory.
