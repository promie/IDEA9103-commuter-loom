# Commuter Loom

*Commuter Loom: Collective Movement Memory* is an original, data-driven p5.js artwork (Option 2 of the IDEA9103 Creative Coding Major Project). Sydney's rail network becomes a living textile: every T1–T9 line is a stream of coloured grains flowing along a schematic map, and ten years of monthly Opal trips decide how dense and fast each stream is.

> Work in progress. Each section below is filled in as the project is built.

Run it locally through a local server, for example `python3 -m http.server` inside this folder, then open the printed address.

## Interaction instructions

*To be added as the interactions are built.*

- **Press the fabric** (Wanghao): move the mouse over the map and the threads under it part around the pointer, like a fingertip pressing woven cloth. Hold the mouse button to press deeper. Move away and the threads spring back to their routes.

## Inspiration

*To be added.*

## Mechanic ownership

| Member | Mechanic | File |
|---|---|---|
| Guangshun Wen (gwen0553) | Audio | `mechanics/audio-reactive.js` |
| Wanghao Jin (wjin0936) | Perlin noise and randomness | `mechanics/perlin-flow.js` |
| Promie Yutasane (pyut8988) | User input | `mechanics/input-controls.js` |

*Each member adds a description of what their mechanic does as they build it.*

**Perlin noise and randomness (Wanghao).** Each line is a band of thousands of persistent grains, short stitches and small knots, that travel along its track and wrap around at the end. Each grain gets its own random speed, lane, size and shape once, when it is created, so the cloth keeps a stable weave. Perlin noise makes each grain wander sideways from its lane, but only within half the gap to the neighbouring line, so lines never cross into each other. The monthly trip data sets how many grains show, how bright they are and how fast they move, so busy months look like dense, bright rope and quiet months like thin, dim thread. The mouse presses a soft dent into the fabric (see Interaction instructions).

## Techniques

*To be added: the p5.js techniques used and why, how the code fits together, and key decisions.*

- **Persistent grains and controlled randomness** (`mechanics/perlin-flow.js`): grains are created once per resize with `random()` and never re-rolled. Each grain has a random `showThreshold`; a month shows the grains whose threshold falls under its trip share, so changing month fades grains in and out instead of rebuilding the stream.
- **Perlin noise drift**: `noise(position along track, time, grain offset)` pushes each grain along the track's normal. The drift limit is worked out from `LANE_GAP_UNITS`, so it scales with the map on resize.
- **Data-driven density**: `TripData.getTripRatio()` (each line's month compared with its own average) sets the visible share, speed and brightness. `getLineVolume()` sets how thick each line's band is overall. Changes ease in with `lerp()`.
- **Fabric press**: the push is the derivative of a Gaussian across the track (zero at the pointer, strongest about one grid unit away, fading to nothing), times a Gaussian along the track. It only moves where grains are drawn, never the route data. Each grain eases towards its push, so the cloth gives way softly and springs back.
- **Fast drawing**: knots are added to a single canvas path and filled once per line through `drawingContext`, which keeps around 6,000–9,000 marks at about 60 fps.

## AI acknowledgement

*To be added: any use of AI tools, what they were used for and how the resulting code works. The same acknowledgement is also commented in the code.*

- **Wanghao**: Claude (an AI assistant in Cursor) helped plan and write `mechanics/perlin-flow.js` and its hook-up in `sketch.js` and `index.html`. That covers the grain classes, the noise-drift limit, the data mapping and the Gaussian press. Each step was reviewed and tested in the browser, and how the code works is explained in comments in the file.

## External references

*To be added: any code borrowed from or influenced by outside sources, with links. These are also commented in the code.*

- Canvas 2D path drawing via `drawingContext`: [MDN CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
- Gaussian falloff for the press: [Wikipedia — Gaussian function](https://en.wikipedia.org/wiki/Gaussian_function)
- p5.js [`noise()`](https://p5js.org/reference/p5/noise/) and [`random()`](https://p5js.org/reference/p5/random/)
