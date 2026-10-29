# Commuter Loom

*Commuter Loom: Collective Movement Memory* is an original, data-driven p5.js artwork (Option 2 of the IDEA9103 Creative Coding Major Project). Sydney's rail network becomes a living textile: every T1–T9 line is a stream of coloured grains flowing along a schematic map, and ten years of monthly Opal trips decide how dense and fast each stream is. Touch, noise and sound all act on the same grains, and the whole network breathes and tightens with the data.

**Live site:** <https://commuter-loom.pyutasane.com>

Run it locally through a local server, for example `python3 -m http.server` inside this folder, then open the printed address. (Opening `index.html` directly does not work, because browsers block loading the CSV and sound files from disk.)

## Interaction instructions

| Do this | What happens |
|---|---|
| Open the page | Time plays by itself from July 2016, one month every three quarters of a second (about a minute and a half for all ten years), and loops after the latest month. The month and trip count flip over like a departure board, with a soft clack, and the whole fabric breathes. |
| Click, tap or press any key | The sound starts (it is on by default, but browsers keep pages silent until your first click, tap or key press). |
| ⏸ / ▶ button or Space | Pause or resume time. |
| Move the mouse over the map | The threads part around your hand, and the flow speeds up near it. |
| Press and hold | The grains gather into your hand. |
| Drag a line | You pull that thread out of the network. Let go and it springs back. |
| Click a line | **Listening mode**: that line comes forward, the rest fades back. Click it again (or empty space) to leave. |
| Hover over the woven timeline | Preview any month's trips without moving there. |
| Drag along the timeline, click a year, or use the scroll wheel | Travel through time yourself (one month per wheel notch; a year label jumps to its January). Playback pauses while you explore. |
| ← / → | Step one month back or forward (pauses playback). |
| Sun/moon switch or D | Switch between the dark theme (the default) and the light theme. Open the page with `?theme=light` to start in light. |
| Speaker button | Mute or unmute the sound. The fabric keeps moving with the sound even while muted. |
| R | Reset: leave listening mode and play again from July 2016. |

**On a phone or tablet:** tap anywhere to start the sound, drag a finger across the map to part the threads, hold it still to gather them, drag along a line to pull it, tap a line to listen, and drag along the timeline to travel through time.

The sound is the city itself, and it follows the data. Three layers play together: a low **rumble** (trains in tunnels), a warm **hum** (the murmur of a crowd) and bright **taps** (Opal cards tapping on). A busy month plays all three; as the network empties the taps fade first, then the hum, until only a faint rumble is left in the 2020 lockdowns. The same sound moves the fabric: bass squeezes, mids shear, treble shivers, and loudness deepens the breathing.

Click once to turn the sound on, then watch and listen as the network breathes deeply through 2019, goes slack and nearly silent in 2020, and gradually recovers.

## Inspiration

- **Sonic Cloth** (NYU Shanghai IMA): a textile where touch, sound and fabric work as one connected system. We took that idea of a single shared material reacting to several inputs, not its visual style.
- **The official Sydney Trains network map**: the composition of horizontal, vertical and 45° coloured lines running side by side.
- **Jon Reades, *A Week in the Life of London Underground*** (UCL Centre for Advanced Spatial Analysis, 2012): a visualisation of more than 27 million Oyster card taps over one week, in which the city visibly beats with its morning and evening peaks. Reades describes it as showing "the pulse of the city" ([UCL News, 2012](https://www.ucl.ac.uk/news/headlines/2012/jul/underground-movement)). Our tutor suggested it as a reference: <https://www.informationisbeautifulawards.com/showcase/89-a-week-in-the-life-of-london-underground> Our data is monthly rather than per tap, so instead of a daily heartbeat we show ten years of rhythm in our own textile language: the network's breathing and how dense its threads are.
- **Connected-particle artworks**: dense fields of fine grains where density and flow speed can be read at a glance.

## Mechanic ownership

| Member | Mechanic | File |
|---|---|---|
| Guangshun Wen (gwen0553) | Audio | `mechanics/audio-reactive.js` |
| Wanghao Jin (wjin0936) | Perlin noise and randomness | `mechanics/perlin-flow.js` |
| Promie Yutasane (pyut8988) | User input | `mechanics/input-controls.js` |

**Perlin noise and randomness (Wanghao).** Each line is a band of thousands of persistent grains, short stitches and small knots, that travel along its track and wrap around at the end. Each grain gets its own random speed, lane, size and shape once, when it is created, so the cloth keeps a stable weave. Perlin noise makes each grain wander sideways from its lane, but only within half the gap to the neighbouring line, so lines never cross into each other. The monthly trip data sets how many grains show, how bright they are and how fast they move, so busy months look like dense, bright rope and quiet months like thin, dim thread. Hovering presses a soft dent into the fabric (`FabricPress`), so the threads part around the pointer.

**User input (Promie).** The visitor's hand on the fabric and their control of time. Holding the mouse (or a finger) gathers grains into the hand, dragging a line pulls that thread out of the network, and the flow speeds up near the hand; each grain then springs back onto its track. Clicking a line enters listening mode. Dragging the woven timeline, clicking a year, the scroll wheel and the arrow keys travel through time and pause playback; Space plays or pauses and R resets. Touch screens get the same controls through the touch events. The grains ask `InputControls` how the hand moves them (`getTouchAmount()`, `applyGather()`, `getPullWeight()`), so all the hand's rules live in one file.

**Audio (Guangshun).** Three layered city sounds (rumble, hum and taps) whose volumes and pitch follow each month's network trips, so a busy month sounds full and the lockdowns sound nearly silent. `p5.FFT` analyses the mix every frame: bass squeezes each band tight onto its track, mids shear neighbouring lines against each other, treble makes the grains shiver, and the overall level deepens the breathing. A departure-board clack plays as each month flips over, and the speaker button mutes the sound without stopping the analysis.

The timed playback (`utils/timeline.js`) and the network's breathing (`utils/fabric-breath.js`) are shared utilities that every mechanic reads from.

## Techniques

### Code structure

Each part of the artwork is a class in its own file, and each mechanic lives in its own script. `sketch.js` creates the objects and calls them in order every frame. Files are loaded with `<script>` tags in `index.html`: shared utilities first, then the mechanics, then `sketch.js`.

```text
commuter-loom/
├── index.html
├── style.css
├── sketch.js                    preload/setup/draw; creates the objects; p5 events
├── utils/
│   ├── colour-theme.js          class ColourTheme (dark and light palettes)
│   ├── logo-mark.js             class LogoMark (the woven-swatch logo)
│   ├── network-layout.js        STATIONS, LINE_ROUTES, LANE_ORDER (data only)
│   ├── track-path.js            class TrackPath
│   ├── rail-network.js          class RailNetwork
│   ├── trip-data.js             class TripData
│   ├── timeline.js              class Timeline
│   ├── fabric-breath.js         class FabricBreath
│   ├── data-panel.js            class DataPanel
│   └── interface-overlay.js     class InterfaceOverlay
├── mechanics/
│   ├── perlin-flow.js           class Grain, class LineStream, class FabricPress  (Wanghao)
│   ├── input-controls.js        class InputControls                               (Promie)
│   └── audio-reactive.js        class AudioReactive                               (Guangshun)
├── data/                        processed CSV and the raw Transport for NSW sources
├── assets/                      the city-sound layers, Raleway font, logo.svg
├── script/                      Python data cleaning and sound generation
└── libraries/                   p5.js 1.10.0 and p5.sound
```

| Class | Responsibility |
|---|---|
| `ColourTheme` | Every colour in one place, in a dark (night network, the default) and a light (warm paper) palette, plus the sun/moon switch. Switching theme recolours everything. |
| `LogoMark` | Draws the woven-swatch logo at any size with `translate()` and `scale()`. |
| `TripData` | Reads the CSV and answers data questions: trips per line and month, each line's normal month, the quiet COVID period. |
| `RailNetwork` | Builds every line's tracks from the station grid, places shared lines side by side, draws station names and line badges, and finds the line under the mouse. |
| `TrackPath` | One branch of one line as a smooth list of points: positions along it and its sideways direction. |
| `LineStream` | All the grains of one line, plus the line's eased look for the month (visible share, speed, width, brightness) and its reaction to listening mode, the pulse, the breath and the sound. |
| `Grain` | One stitch or knot: moves along its track, drifts with Perlin noise, is moved by the hand and springs back. |
| `FabricPress` | The soft dent the hovering pointer makes in the threads. |
| `InputControls` | Mouse, touch and keyboard behaviour, and the gather, pull and stir forces the grains ask for. |
| `AudioReactive` | The three sound layers, the data-driven mix, the FFT analysis, the mute button and the band values the grains read. |
| `Timeline` | The woven timeline: one thread per month, its height set by network trips and split into line colours. Also the playhead, hover preview, year jumps, scrubbing, and timed playback that starts on load and loops. |
| `DataPanel` | The month and trip count with a split-flap effect, a ten-year trace and a breath monitor. Shows the selected line in listening mode. |
| `FabricBreath` | The network's breathing: a timer-driven swell and release whose depth and speed come from that month's network trips, deepened by the sound's loudness. |
| `InterfaceOverlay` | Title, status messages, fades and the control dock along the bottom that holds the buttons and the timeline. |

### Every frame

`draw()` updates the timeline, sound, breathing and input first, because every grain reads from them. It then builds one `frame` object (the press, the hand, the month's pulse, the breath, the sound and the time) and passes it to each `LineStream`, so the mechanics meet on the same grains without reaching into each other's files. Each grain:

1. moves along its track at its own random speed, scaled by the month's data, listening mode, the breath and the hand's stir;
2. takes its sideways position from its lane and the Perlin drift, then the bass squeeze, mid shear and treble shiver;
3. is parted by the `FabricPress`, then pulled towards the hand or the pulled shape and eased back onto its track by a damped spring;
4. shows or hides depending on the month's share of trips.

Everything on the map is clipped above the control dock with `beginClip()`, so the lines end exactly at the dock.

### Data mapping

```text
Line (T1–T9)            -> one coloured stream (official Transport for NSW colours)
Route stopping pattern  -> the stream's track (from sydneytrains.geojson route descriptions)
Line's normal volume    -> how many grains and how wide the band (T1 densest, T7 sparsest)
This month vs normal    -> share of grains visible, flow speed and brightness
Network this month      -> depth and speed of the breathing, and the sound mix:
                           rumble always, hum when fairly busy, taps only when busy
```

### Key techniques

- **Persistent grains and controlled randomness** (`mechanics/perlin-flow.js`): grains are created once per resize with `random()` and never re-rolled. Each grain has a random `showThreshold`; a month shows the grains whose threshold falls under its trip share, so changing month fades grains in and out instead of rebuilding the stream.
- **Perlin noise drift**: `noise(position along track, time, grain offset)` pushes each grain along the track's normal. The drift limit is worked out from `LANE_GAP_UNITS`, so it scales with the map on resize.
- **Data-driven density**: `TripData.getTripRatio()` (each line's month compared with its own average) sets the visible share, speed and brightness. `getLineVolume()` sets how thick each line's band is overall. Changes ease in with `lerp()`.
- **Fabric press**: the push is the derivative of a Gaussian across the track (zero at the pointer, strongest about one grid unit away, fading to nothing), times a Gaussian along the track. It only moves where grains are drawn, never the route data.
- **The hand**: gathering pulls each grain towards the pointer with a strength that fades with distance. A pull finds where the line was grabbed on each branch (`RailNetwork.findGrabbedDistances()`) and moves grains by a Gaussian weight of their distance from that point, so the line bends like a pulled thread. A damped spring (The Nature of Code) brings everything back.
- **Sound analysis**: `p5.FFT` with `getEnergy()` for bass, mid and treble, and `outputVolume()` for loudness. The analysis keeps running while muted, so the fabric still moves.
- **Breathing**: a `deltaTime` timer and `sin()` give a swell and release whose depth and speed follow the month's trips.
- **Rounded tracks**: Chaikin's corner cutting smooths the schematic corners.
- **Fast drawing**: knots and stitches are added to a single canvas path and filled once per line through `drawingContext`, which keeps thousands of marks at about 60 fps. If the frame rate drops below 40 about 3 seconds in, the sketch switches to `pixelDensity(1)`.
- **Phones and tablets**: `touchStarted()`, `touchMoved()` and `touchEnded()` send touches to the same `InputControls` methods as the mouse, and return `false` so taps are not counted twice. Smaller screens get a compact layout and a data card above the dock, and `windowResized()` rebuilds the map and refills the grains.

## Data

Both datasets are from Transport for NSW Open Data:

1. **Opal Trips – Train** (monthly trips by line and card type), saved as `data/train.csv`: <https://opendata.transport.nsw.gov.au/data/dataset/opal-trips-train>
2. **Sydney Train Routes**, saved as `data/sydneytrains.geojson`: <https://opendata.transport.nsw.gov.au/data/dataset/sydney-train-routes>

`script/clean_data.py` turns the raw CSV into `data/monthly_line_trips_full.csv`. It standardises dates to `YYYY-MM`, adds up all card types, and groups historical service names into T1–T9. Run it with `python3 script/clean_data.py`.

## AI acknowledgement

All three of us used Claude (Anthropic) while building this project. Every file Claude helped with also says so in a comment at the top, and each of us has read, tested and can explain the code in our own mechanic.

- **Promie**: Claude helped plan the object-oriented structure and the station grid, and helped write the shared classes in `utils/`, `mechanics/input-controls.js`, the data-cleaning script, and the code that connects the three mechanics in `sketch.js`.
- **Wanghao**: Claude (an AI assistant in Cursor) helped plan and write `mechanics/perlin-flow.js` and its hook-up in `sketch.js` and `index.html`. That covers the grain classes, the noise-drift limit, the data mapping and the Gaussian press. Each step was reviewed and tested in the browser, and how the code works is explained in comments in the file.
- **Guangshun**: Claude helped write `mechanics/audio-reactive.js` (the layered mix, the FFT analysis and the mute button) and `script/generate_city_sound.py`, which generates the three city-sound layers and the clack (run it with `python3 script/generate_city_sound.py`).

## External references

- **Raleway** typeface by Matt McInerney, Pablo Impallari and Rodrigo Fuenzalida, bundled in `assets/fonts` under the SIL Open Font License (`assets/fonts/OFL.txt`): <https://fonts.google.com/specimen/Raleway>
- **Chaikin's corner-cutting algorithm**, used to round the corners of the tracks (`RailNetwork`): <https://www.cs.unc.edu/~dm/UNC/COMP258/LECTURES/Chaikins-Algorithm.pdf>
- **Spring forces**, Daniel Shiffman, *The Nature of Code*, chapter 3, used for grains springing back to their track (`Grain.locate()`): <https://natureofcode.com/oscillation/#spring-forces>
- **Gaussian falloff** for the press and the pull: [Wikipedia — Gaussian function](https://en.wikipedia.org/wiki/Gaussian_function)
- Canvas 2D path drawing via `drawingContext`: [MDN CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
- p5.js [`noise()`](https://p5js.org/reference/p5/noise/), [`random()`](https://p5js.org/reference/p5/random/) and [`p5.FFT`](https://p5js.org/reference/p5.sound/p5.FFT/)

## Known limitations

- **Station busyness is a placeholder.** The station `tier` values in `utils/network-layout.js` are a rough ranking. They should be replaced with the Transport for NSW *Train Station Entries and Exits* dataset.
- **Positions are schematic.** Stopping patterns follow the current routes, but stations are hand-placed. T2 Leppington runs via Harris Park and T3 Bankstown via Regents Park for simplicity.
- The trip data uses historical line families, while the map shows today's routes (for example, T9 has no trips before it was introduced).

## Development

```bash
npm run check    # syntax-check every JavaScript file with node --check
```
