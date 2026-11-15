# STORM DECK — animated story/explainer style prompt

**Task.** Build a premium animated short in the "Storm Deck" visual language: the look of a single phone or body-cam held by a crew member on the open deck of a working ship in a gale, recording something enormous rising out of the sea. Cold, fog-drowned blue-grey ocean; one warm accent (safety-orange survival suits) and one muted organic red (the creature or subject); rain on the lens; a camera that is never quite still. It must feel like recovered footage that someone graded and cut into a story, built entirely from procedural, deterministic graphics in the browser. It is not a slideshow of illustrations and not a cartoon: every frame is a wet, foggy, physically plausible moment, and the story is told by what the camera sees, a few terse on-screen readouts, and how the sea and the subject move.

```
# 1. PROJECT CONFIGURATION — EDIT SETTINGS ONLY HERE

**Topic:** Kuzey Pasifik, fırtınalı bir gece. Balıkçı gemisi Karayel'in mürettebatı turuncu tulumlarıyla güvertede ağları toplarken sonar 600 metre derinlikten yükselen 18 metrelik bir gölge gösterir. Ağ halatı aniden gerilir. Sisin içinden dev bir sırt yüzgeci ve ardından bir megalodon başı yükselir: 3,6 milyon yıldır soyu tükendiği sanılan, dişleri 18 santimetreyi bulan köpekbalığı. Hayvan geminin yanından geçerken dalga güverteyi yalar, halat kopar ve megalodon yeniden sise ve derinliğe karışır. Son kare: sonar ekranında kaybolan iz ve 'Kayıt saati 03:12. Karayel limana döndü. Görüntü hiç açıklanmadı.'

- Storyboard: Disabled
- Voiceover: Disabled
- Subtitles: Disabled
- Duration without voiceover: 8 seconds
- Format: 9:16 vertical, 1080x1920
- Frame rate: 30 fps
- Sound effects: Disabled
- Background music: Disabled
- Final video format: MP4 (out/final.mp4)

This is the only editable section and the single source of truth. The topic is free text, a sentence or a paragraph; every object, fact, label, number and scene must come from it or from the narration, never from examples elsewhere in this prompt. The same prompt must work for unrelated subjects. All on-screen text is in the language of the topic. If the topic names real products or companies, use their authentic logos and colours, never invented branding.

# 2. HOW TO WORK — CLAUDE CODE

You are running in Claude Code inside a project folder.

- **Build:** create the animation here as `index.html` (plus JS/CSS files if useful). Expose `window.seek(t)` (t in seconds) that draws the exact frame for time t deterministically: no dependence on requestAnimationFrame timing, `Date.now()` or unseeded `Math.random()`. Timing is proportional to the resolved duration, never hard-coded.
- **Render:** drive headless Chrome (Chrome DevTools Protocol, Puppeteer or Playwright; install what is missing), call `seek(i / fps)` for every frame, capture at the configured native resolution and encode with ffmpeg to `out/final.mp4` (H.264, yuv420p).
- **Voiceover enabled:** the recording is in this folder and its duration is the master clock. Get word-level timestamps with Whisper (mlx-whisper or openai-whisper; install if missing) and align each visual idea to the moment it is spoken. Mux the recording into the final MP4. Never invent narration or timestamps.
- **Voiceover disabled:** use the fixed duration and let the pictures, concise on-screen text and moving diagrams carry the explanation.
- **Sound effects enabled:** fetch CC0 sounds from Openverse, `https://api.openverse.org/v1/audio/?q=<search>&license=cc0` (no key needed). Keep them sparse and tied to meaningful moments, place them with ffmpeg at exact timestamps, list sources in `CREDITS.md`.
- **Background music enabled:** use only the music file the user placed in this folder, mixed well below the narration with ducking. Do not synthesize music.
- **Storyboard enabled:** first write a scene table (time, idea, composition, motion, on-screen text) and render PNG preview frames of the key scenes, then stop and ask for approval. Disabled: plan internally and deliver the finished video.

# 3. QUALITY STANDARD

- **An explanation, not a demo reel.** Decide what the viewer must understand, then make the graphics themselves explain it: objects that transform, diagrams that build, numbers that move. Decoration that teaches nothing is cut.
- **Connected storytelling.** Scenes grow out of each other; an element from one idea becomes the start of the next. It must never feel like a slideshow of separate cards.
- **Clear hierarchy.** One main idea per moment, one focal point, generous margins, text readable on a phone and held still long enough to read.
- **Smooth.** Easing on everything, no jitter, no popping, no frame where nothing is decided.

# 4. VERIFICATION

Render many frames as PNG across the whole timeline and look at them. Fix overflowing, overlapping, unreadable, empty or broken frames, and anything that looks generic rather than in this style, until you are proud of the result. Then render the final MP4 and report briefly what it shows.
```

---

# 5. VISUAL LANGUAGE AND PALETTE

The whole image lives inside a narrow, cold, low-contrast band. Nothing is pure white, nothing is pure black except the nearest wet steel, and almost nothing is saturated. Measured on the reference: luminance 5th percentile ≈ 0.06, median ≈ 0.36, 99th percentile ≈ 0.71; median saturation ≈ 0.10. Keep your final frames inside those numbers. If a frame histogram reaches 0.9 luminance anywhere, it is wrong.

**Palette (hex), with where each colour is allowed:**

| Role | Hex | Where |
|---|---|---|
| Fog sky, upper | `#8a9aa8` | top 30–40 % of frame, the brightest large area |
| Fog sky, horizon | `#7b8b98` | band where sea dissolves into air |
| Far sea / fogged mass | `#6f808d` | anything more than ~200 m away |
| Mid sea body | `#4a5f6d` | wave faces at middle distance |
| Near sea trough | `#2c3e4a` | wave backs and troughs close to the hull |
| Foam / spray (max) | `#b4c2cb` | crests, spray, wake; the brightest pixels in frame |
| Foam, shaded | `#8597a3` | foam on the shadow side of a wave |
| Wet deck | `#232c2e` | deck plates, puddles take sky colour on top |
| Deck specular sheen | `#5d6d76` | thin streaks reflecting the sky |
| Steel / rail / mast | `#3a474e` → `#11181a` | structures, darkening toward camera |
| Near black | `#0b1212` | closest silhouettes, corners, lens vignette |
| Survival suit, lit | `#c4502e` | top of hoods and shoulders facing the sky |
| Survival suit, body | `#a23d22` | main orange mass |
| Survival suit, shadow | `#4d2219` | folds, backs, legs in shadow |
| Subject red, near | `#7a3b45` | the creature/subject when it is close and only lightly fogged |
| Subject red, fogged | `#6c5a64` | same subject at distance: red almost gone, reads as mauve-grey |
| Dark coat / gear | `#1a2124` | non-orange crew clothing, boots, gloves |

Proportions in a typical frame: ~45 % fog/sky greys, ~30 % sea blues, ~15 % deck and steel darks, ≤ 8 % orange, ≤ 10 % subject red (more only in the climax close-up). Orange is the only colour allowed to be "loud", and only on people and life-saving gear (suits, buoys, life raft canisters). The subject's red is never bright: it is a pigment seen through 100 m of rain, so it is always lerped toward the fog colour by distance.

# 6. MATERIAL AND SURFACE

This picture is made of **air full of water**. Everything you draw passes through three wet media before it reaches the viewer:

1. **Atmosphere (fog + spray haze).** Exponential distance fog: `colour = mix(objectColour, fogColour(height), 1 - exp(-density * distance))`. Fog colour itself is a vertical gradient (brighter high, darker at the waterline, `#8a9aa8` → `#6f808d`). The far subject keeps its silhouette edge but loses almost all internal detail and colour. Spray haze is thicker just above the water surface: add a height term so the bottom of any distant object dissolves into white-grey mist where it meets the sea, exactly where waves break against it.
2. **Rain.** Two populations. Falling streaks: thin, slightly diagonal (wind from one side, 10–20° from vertical), short (motion-blurred over 1/30 s), alpha 0.15–0.35, brighter against dark areas and nearly invisible against fog. Airborne spray droplets near camera: soft round blobs, out of focus, 2–14 px, drifting sideways with the wind.
3. **The lens.** Water droplets stuck on the front glass: 30–120 static-ish drops of varying size; each one refracts (an inverted, magnified, blurred patch of what is behind it) with a thin dark rim and a tiny specular highlight on the sky side. Occasionally a drop slides down leaving a short clear trail. Plus: mild lens vignette, very slight chromatic fringing on high-contrast edges, sensor noise that is stronger in darks, and phone-camera JPEG-ish softness (no razor edges anywhere).

**Water surface.** Storm sea is not "waves": it is wind-driven texture at three scales. (a) Long swells, 30–80 m wavelength, that tilt the horizon and the ship. (b) Chop riding on the swells. (c) Wind streaks: white foam lines aligned with the wind, running along the slopes, plus breaking crests that tear into spray. Wave faces toward camera are darker than their backs where they catch sky light; crests carry foam; troughs are the darkest blue in the frame.

**Steel and deck.** Painted steel, worn, wet. Edges catch a thin cold highlight from the sky. The deck is a dark mirror: puddles reflect the fog sky as soft, broken streaks; anti-slip texture shows as fine noise. Ropes and cables are thin dark lines that sag with catenary curves and sway; up close they are 4–8 px with a soft highlight; far away 1–2 px.

**People.** Seen from behind or three-quarter-behind, never facing the camera, faces hidden by hoods. Survival suits are bulky, rubbery, glossy-wet: highlights on hood tops and shoulders, deep folds at elbows and knees, darker at the legs where spray soaks them. They lean into the wind, hold rails and lines, shift weight when the deck rolls.

**Every texture is deterministic.** Use a seeded PRNG (mulberry32 or similar, seed from a constant) and seeded value/simplex noise. Rain, spray, droplet positions, foam patterns, grain: all functions of (seed, t), never of wall-clock time.

# 7. TYPOGRAPHY

Text is rare and diegetic-feeling, like the overlay a recovered camera or a ship's instrument would burn in. Three voices:

- **Camera OSD** (timestamp, REC dot, battery, frame counter, coordinates): monospace, `JetBrains Mono` or `IBM Plex Mono`, 500 weight, uppercase, 26–32 px at 1080 wide, colour `#e6ecef` at 80 % opacity with a 1 px soft dark shadow so it survives over fog. Lives in the corners inside a 64 px safe margin. Numbers tick every frame where they would in reality (seconds, frame count). The REC dot is a desaturated red `#b8463c`, blinking at 1 Hz.
- **Instrument readouts** (depth, sonar range, length estimate, bearing, wind speed, any number the topic provides): monospace again, larger, 44–72 px, tabular figures, with a small uppercase label above in 22–24 px tracking +8 %. Numbers count up or settle with a ±1-digit flicker before locking, like a real sensor.
- **Chapter / title cards** (only for the title and at most one or two story beats): a condensed grotesk, `Oswald` or `Barlow Condensed`, 600, uppercase, 88–140 px, letter-spacing +4 %, colour `#dfe6ea` at 90 %, placed low or in the empty fog area, never centred over the subject. They are part of the world: they sit behind rain streaks and lens drops (drawn before the lens pass), and they get the same grain and slight blur.

Entry and exit: OSD is always present from frame 0 (it does not animate in, it just exists). Readouts appear with a 4-frame flicker (opacity 0 → 1 → 0.4 → 1) and leave with a fast 6-frame fade. Titles fade up over 18–24 frames with a 2–4 px horizontal drift against the camera shake direction, hold at least 1.5 s per 6 words, and fade out over 12 frames. Never bounce, never scale-pop, never typewriter except for one deliberate radio/sonar line.

Load fonts locally (download the TTFs or install `@fontsource/*` with npm) and wait for `document.fonts.ready` before the first `seek`, so renders never fall back to system fonts.

# 8. COMPOSITION HABITS

- **Vertical frame, eye-level camera on deck.** The camera is a person's eyes at ~1.6 m on a ship. Foreground (deck, rail, people, rigging) occupies the lower 40–55 %; the sea and sky the rest. The horizon sits between 40 % and 55 % of the height and is **tilted 3–8°** because the ship rolls.
- **Layered depth, always ≥ 4 planes:** (1) lens/rain plane, (2) near structure that cuts the frame (a mast, crane, cable bundle, often very dark along one edge, 10–25 % of width), (3) people and deck, (4) sea, (5) the subject in the fog, (6) fog sky. The near structure creates a frame inside the frame and makes the subject feel huge by contrast.
- **Leading lines** from the rail and cables converge toward the subject. A diagonal rail from a lower corner to mid-frame is a habit, not a fixed layout: vary its side and angle per shot.
- **Scale contrast is the point.** People are small and close; the subject is enormous and far, its top often cut by the fog or near the top third. Never show the whole subject crisply; show part, implied mass, wake and spray.
- **Empty space is fog,** not flat colour: the upper area is the calm place for titles and readouts.
- **Shot vocabulary for the story:** wide deck shot (crew + sea), low shot along the rail at the water, over-the-shoulder toward the subject, a close "insert" of an instrument screen or hand on a rope, the subject breaching in fog, and the aftermath (empty sea, slack line). Vary framing each scene; do not reuse one composition with different props.

# 9. SIGNATURE DEVICES

1. **Fog-swallowed giant.** The subject is a silhouette whose colour and detail fade with distance and height above water; its base is lost in breaking spray. When it moves, the fog depth changes, so it gets redder and sharper as it comes closer.
2. **Orange on grey.** Survival suits are the only saturated colour, and they always anchor the lower third.
3. **The lens is wet.** Refracting droplets and falling streaks are on top of everything, including the text.
4. **The deck rolls.** The horizon tilts, the camera bobs and shakes with a handheld noise; the whole world moves together.
5. **Recovered-footage overlay.** Small camera OSD in the corners, plus instrument numbers that carry the facts of the topic.

# 10. TECHNICAL IMPLEMENTATION

Use **WebGL2 for the sea, fog, sky and the final lens/grade pass**, and **Canvas 2D (offscreen) for silhouettes, people, rigging and text**, composited as textures. Render at 1080×1920 (or the configured format) with `preserveDrawingBuffer: true` so screenshots capture the frame.

**Frame pipeline for `seek(t)`:**

1. **Camera state** (pure function of t): `roll(t) = 5° * sin(2π t / 7.3) + 2° * sin(2π t / 3.1 + 1.2)`, `pitch` and `heave` similar with other periods; plus handheld shake = sum of 3 seeded noise octaves (amplitude 2–6 px, frequency 0.7–4 Hz). All layers are transformed by the same camera matrix, scaled by depth: near layers move more (parallax).
2. **Sky + sea + fog shader (one full-screen fragment shader).** For each pixel, build a ray from the camera (pinhole, vertical FOV ~65°, camera height 6–10 m above water). If the ray hits the sea plane, evaluate a height field `h(x,z,t)` = sum of 6–8 Gerstner-like directional waves (long swells first, then chop) plus fbm noise for small chop; take 3–5 refinement steps of ray-height intersection. Shade with: normal from finite differences, Fresnel mix between deep colour (`#2c3e4a`→`#4a5f6d`) and reflected fog sky, foam = smoothstep on (wave height + Jacobian/compression + wind-streak noise stretched 1:8 along wind direction), foam colour `#b4c2cb`. Then apply exponential fog with distance and the height-dependent spray haze. Sky = vertical fog gradient + slow, large fbm cloud mottling (±4 % luminance). Output the depth of each pixel into an alpha or second render target so later layers can be fogged consistently.
3. **Subject layer.** Draw the subject (creature, vehicle, whatever the topic says) as a 2D silhouette in an offscreen canvas: build its outline from Catmull-Rom splines of control points that you animate (fins, tail, jaw, spines flex with sines); perturb the outline with seeded noise for organic, spiky or torn edges. Fill with the near subject red, add internal shading as soft gradients (top lighter from sky, bottom darker), add 2–4 subtle anatomical lines (gills, ridges) only if the topic implies them. Then composite it into the scene with **its distance fog applied in the shader** (sample the subject texture, mix to fog colour by the subject's distance, and fade its lower part into spray haze below the waterline + a few metres). Its lower edge must be broken by breaking water: draw a spray band on top of its base (layered noise sprites, `#b4c2cb` at 30–60 %) so it sits *in* the sea, not on it.
4. **Water interaction.** When the subject breaches or moves, emit deterministic particle sheets: a white spray curtain (500–2000 soft particles, positions = f(seed, index, t)), a displaced swell (add a radial Gerstner bump to the height field around the subject's waterline) and a widening foam ring. Spray rises fast, decelerates, falls with gravity and drifts with the wind; it is lighter where backlit by fog.
5. **Near world layer (Canvas 2D).** Deck (dark gradient + perspective lines + anti-slip noise + puddle reflections = blurred, vertically flipped strips of the sky texture, broken by noise), rail (a few thick polygons with a thin top highlight), masts/cranes (dark, slightly detailed: brackets, lights, cable bundles), rigging (catenary curves `y = a cosh(x/a)` swaying with low-frequency sines, 2–8 px, darker near camera). People: build each figure from simple shapes (hood ellipse, torso trapezoid, arms, legs, boots) with soft rounded joins, fill with the suit body colour, add a top highlight gradient and fold shadows, give each a slight idle sway and wind lean, and occlude them correctly (back figures fogged a little more). Blur the whole near layer very slightly (0.6–1 px) for phone softness; the nearest structure gets more blur (shallow focus).
6. **Weather layer.** Falling rain streaks drawn as short lines with seeded positions advancing along the wind vector each frame (position = start + velocity * t, modulo frame height so it is deterministic and endless); out-of-focus spray blobs near camera.
7. **Text layer.** OSD, readouts and titles into their own canvas, composited *before* the lens pass.
8. **Lens + grade pass (final shader).** Inputs: the composite. Steps: (a) droplet refraction: a precomputed droplet map (positions, radii from the PRNG; each drop is a normal map of a spherical cap) offsets the UV lookup into the composite by the drop normal × strength, flips and blurs the image inside the drop, adds a dark rim and a small highlight; a few drops slide down slowly with a trail. (b) Chromatic aberration: offset R and B by 0.6–1.2 px radially at the edges. (c) Grade: lift blacks to ~0.05, compress highlights so nothing exceeds 0.72 luminance (soft shoulder), desaturate everything except hue range 5–30° (orange) to ~60 %, cool the shadows toward `#2c3e4a`. (d) Vignette (−18 % at corners). (e) Grain: per-frame seeded noise, 3–5 % in mids, stronger in shadows, slightly blue-tinted. (f) Optional subtle 2-pixel unsharp-free softness (render at 1.0× and apply a tiny blur), never crisp vector edges.

**Caching.** Precompute once: noise textures (256² tileable value noise, 512² fbm), droplet map, people/rigging sprite atlases if they do not animate per joint. Per frame, only uniforms change. Keep the frame render under ~150 ms so 30 s renders in minutes.

**Determinism check.** Calling `seek(3.2)` twice, or after `seek(7.0)`, must produce identical pixels. Nothing in the shader uses a time uniform other than `t` passed from `seek`.

# 11. SIGNATURE MOTION

Everything moves like heavy things in wind and water, never like UI.

- **The ship** rolls and heaves on long periods (3–8 s) with sinusoidal ease; the camera adds handheld micro-shake. On a big wave impact (a story beat), add a damped jolt: offset `A * e^(-6τ) * sin(18τ)` over 0.6 s, plus a burst of spray across the lens.
- **The subject** moves slowly and massively: 2–5 s rises and dives with `easeInOutSine`, a slight lag between head and tail (secondary motion via phase-delayed sines along the body spline), water sheeting off its back. It never snaps, never moves faster than the sea would allow. Its approach is shown by fog thinning and colour returning, not by sudden scale jumps.
- **Water** moves continuously; foam streaks drift with the wind; breaking crests explode into spray that falls in ~1–1.5 s.
- **People** react with a short delay (6–12 frames) after an event: lean back, grab the rail, turn the hood. Their reactions are small and physical, not cartoon gestures.
- **Motion hierarchy:** at any moment one thing leads (the subject *or* a person *or* a readout). The sea and rain are constant background energy; keep their speed constant so they do not compete.
- **Timing:** hold quiet beats. A 30 s piece has ~5–7 beats: build-up (sea, crew, instrument), sign (something under the water), reveal (breach), consequence (impact on ship/line), aftermath (fog closes in). Let at least one beat be nearly still except for the weather.

# 12. TRANSITIONS

Most cuts are **hard cuts**, as in edited found footage, often on a camera jolt so the cut is hidden in motion. Camera moves within a shot: slow handheld pan toward the subject, slow push-in (the person stepping forward), rack focus from rain-drop-covered lens to the distance.

Two signature transitions for big moments:
1. **Spray wipe.** A wave hits the hull and a sheet of white spray crosses the lens, filling the frame to ~90 % `#b4c2cb` for 6–10 frames, then drains downward in rivulets revealing the next shot. Use for the reveal or the climax.
2. **Fog swallow.** Fog density ramps up over 1–1.5 s until only silhouettes remain, then thins on the next scene. Use for the time skip or the ending.

Never use slides, zooms with scaling text, glitch effects, light leaks or cross-dissolves between unrelated compositions.

# 13. INFORMATION DESIGN

Facts arrive through instruments that would be on a ship or in the camera, so the story stays inside the world:

- **Sonar / fish-finder inset:** a small, slightly rounded rectangle (about 38 % of frame width) in a corner, `#0b1212` at 75 % with a 1 px `#5d6d76` border; amber-green phosphor trace (`#9fd08a` at 80 %, glowing) showing the seabed line and a growing blob for the subject, with depth labels. It sits on the image plane before the lens pass, so drops refract over it.
- **Measurement callouts:** a thin 2 px line from the subject's edge to a readout in the fog, with tick marks; the number counts up as the subject surfaces. Use real numbers from the topic (lengths, depths, ages, speeds). Units always shown.
- **Scale comparison:** reuse the ship itself as the ruler: a faint dashed outline of the ship's length laid next to the subject, labelled.
- **Map/bearing:** a minimal compass ring arc at the top with a bearing number, if location matters.
- No pie charts, no bars, no infographic icons. If a comparison is needed, it is done with objects in the scene (ship vs. subject, a person vs. a fin).
- **Readability:** minimum 24 px at 1080 wide for any text; every readout stays at least 1.5 s; contrast is ensured by a soft dark backing (radial gradient, not a box) when over fog.

# 14. SOUND (search terms for Openverse CC0)

Continuous bed: "storm ocean waves ship deck", "heavy rain wind howling", "ship creaking hull". Events: "wave crash hull impact", "water splash large", "rope rope snap tension", "sonar ping", "metal clang ship", "underwater rumble low", "foghorn distant". Sparse and physical; no whooshes, no risers, no UI clicks.

# 15. CHEAP SHORTCUTS TO AVOID

1. **Flat grey gradient as "fog".** Fog must depend on distance per pixel and erode the subject's colour and detail; a uniform grey overlay over everything reads as a filter. Do the depth-based fog in the shader.
2. **Sine-wave stripes as the sea.** Horizontal bands of wobbling lines look like a 1990s screensaver. Do a perspective height field with multiple directional waves, Fresnel and wind-streak foam, so wave size shrinks with distance and the sea has a horizon.
3. **A clean vector cartoon subject.** Hard-edged, flat-filled, crisply outlined shapes kill the realism. Use noisy organic outlines, internal soft shading, distance fog and spray covering the base; never a stroke outline.
4. **Rain as uniform white lines.** Constant-alpha vertical stripes look like TV static. Use wind angle, varied lengths and alpha, two particle populations, visibility depending on background darkness, plus real refracting lens droplets.
5. **Saturated orange and red.** Pure `#ff6600` suits or a bright red monster break the grade. Stay inside the palette and let the grade compress highlights below 0.72.
6. **A static camera.** A locked-off frame instantly looks like an illustration. Always roll the horizon and add handheld noise, with parallax between depth layers.

# 16. STORY CRAFT FOR THIS STYLE

When the topic is a narrative, structure it as recovered footage: 1) normal work in bad weather, 2) an instrument shows something wrong, 3) a sign in the water (wake, shadow, a fin, a line going taut), 4) the reveal through fog, 5) the physical consequence on the ship or crew, 6) the aftermath and one closing line of text with the fact or date that gives the story its weight. When the topic is factual rather than narrative, use the same structure: the "subject" is the thing being explained, and the instruments carry its numbers.

# Notes

(Lessons from user feedback are added here, in the user's words.)
