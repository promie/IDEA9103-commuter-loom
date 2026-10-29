// perlin-flow.js  —  MECHANIC: Perlin noise and randomness
// Mechanic owner: Wanghao Jin (wjin0936)
//
// Each train line becomes a stream of small coloured grains that travel
// along its tracks, so the network reads as a woven textile rather than a
// set of solid lines:
//   - a LineStream holds every grain of one train line (all its branches)
//   - a Grain is one particle that lives on one branch (one TrackPath)
//
// Grains are created once and then keep moving: they are never thrown
// away and re-made each frame. Each grain is given its own random
// character when it is created (where it starts, how fast it travels, how
// big it is, and which side of the track it runs on), and keeps it for its
// whole life. That way the stream looks varied, but nothing flickers.
//
// On top of that, Perlin noise makes the grains drift gently from side to
// side across their track, like threads moving in a slow current. The
// drift is smooth (noise changes gradually, unlike random()), and it only
// ever pushes a grain across its own track, never along it or off into
// open canvas. It is capped so a line never drifts into its neighbour.
//
// Random values give each grain its own fixed character; Perlin noise gives
// the whole stream its smooth, ever-changing movement.
//
// Sizes, spacing and speeds are measured in grid units (railNetwork.gridUnit)
// instead of pixels, so the textile looks the same on a phone and on a big
// screen.
//
// AI acknowledgement: this file was written with the help of Claude
// (Anthropic). It moves each grain along a TrackPath with the path's own
// findSegmentIndex() and getPositionAt() methods, uses p5's random() to
// give every grain its individual properties, and p5's noise() for the
// sideways drift.

// Average gap between neighbouring grains along a track, in grid units.
// Smaller numbers make denser (and slower to draw) streams.
const FLOW_GRAIN_SPACING_UNITS = 0.12;

// A safety limit so a very long branch can never create too many grains.
const FLOW_MAX_GRAINS_PER_PATH = 900;

// How far either side of its track centre a grain sits before any drift,
// in grid units. The Perlin noise drift below is added on top of this.
const FLOW_BAND_HALF_WIDTH_UNITS = 0.16;

// How far an average grain travels each frame, in grid units.
const FLOW_BASE_SPEED_UNITS = 0.03;

// The range of each grain's random speed (1 = average speed).
const FLOW_MIN_SPEED_FACTOR = 0.6;
const FLOW_MAX_SPEED_FACTOR = 1.4;

// The range of each grain's random size (its width), in grid units.
const FLOW_MIN_GRAIN_SIZE_UNITS = 0.05;
const FLOW_MAX_GRAIN_SIZE_UNITS = 0.11;

// ---- Perlin noise drift ----

// The smallest gap to keep between the grains of two neighbouring lines.
const FLOW_LANE_CLEARANCE_UNITS = 0.02;

// The furthest the noise may push a grain sideways, in grid units, worked
// out from the real track spacing. Neighbouring lines in a bundle are
// LANE_GAP_UNITS apart (from rail-network.js), so each line may use half
// of that. From that half we take away the band, the grain's own size (its
// half-diagonal, 0.71 x its width, for tracks at 45 degrees) and the
// clearance. With the values above this is about 0.1 grid units.
// (Math.max is plain JavaScript: p5's max() is not ready yet when this
// line runs.)
const FLOW_MAX_DRIFT_UNITS = Math.max(
  0,
  LANE_GAP_UNITS / 2 - FLOW_BAND_HALF_WIDTH_UNITS - FLOW_MAX_GRAIN_SIZE_UNITS * 0.71 - FLOW_LANE_CLEARANCE_UNITS
);

// How quickly the noise changes along the track. Smaller numbers give
// longer, lazier ripples (about one gentle swing every 3 grid units here).
const FLOW_NOISE_ALONG_SCALE = 0.35;

// How quickly the ripples change over time, in noise steps per second.
const FLOW_NOISE_TIME_SPEED = 0.3;

// How different one grain's drift is from its neighbours'. 0 would make
// every grain at the same spot drift together; bigger numbers make them
// drift more independently.
const FLOW_NOISE_GRAIN_SPREAD = 0.6;

// p5's noise() returns values between 0 and 1, but most of them fall
// between about 0.25 and 0.75. We stretch that middle range to the full
// drift, so the movement is visible while still never going past the cap.
const FLOW_NOISE_LOW = 0.25;
const FLOW_NOISE_HIGH = 0.75;

// One particle on one branch of a line.
class Grain {
  constructor(path) {
    // The branch this grain belongs to, for its whole life.
    this.path = path;

    // Random properties, chosen once here and never changed.
    // Where along the track it starts, in pixels from the start of the track.
    this.distance = random(0, path.totalLength);
    // How fast it travels compared with the average grain.
    this.speedFactor = random(FLOW_MIN_SPEED_FACTOR, FLOW_MAX_SPEED_FACTOR);
    // Its width, in grid units.
    this.sizeUnits = random(FLOW_MIN_GRAIN_SIZE_UNITS, FLOW_MAX_GRAIN_SIZE_UNITS);
    // Which side of the track it runs on: -1 is one edge of the band,
    // 0 the centre, 1 the other edge.
    this.laneOffset = random(-1, 1);
    // Its own position in the noise, so its drift is a little different
    // from the grains around it.
    this.noiseOffset = random(0, FLOW_NOISE_GRAIN_SPREAD);

    // Which pair of track points the grain is between. Remembering it means
    // the path only has to search a step or two each frame.
    this.segmentIndex = path.findSegmentIndex(this.distance, 0);
  }

  // Moves the grain forwards along its track. stepPixels is the average
  // grain's step this frame; this grain scales it by its own speed.
  move(stepPixels) {
    this.distance += stepPixels * this.speedFactor;

    // At the end of the track, start again from the beginning, so the
    // stream flows on forever without creating new grains.
    if (this.distance > this.path.totalLength) {
      this.distance -= this.path.totalLength;
      this.segmentIndex = 0;
    }
    this.segmentIndex = this.path.findSegmentIndex(this.distance, this.segmentIndex);
  }

  // How far (in pixels) the Perlin noise pushes this grain sideways right
  // now. The noise is sampled at three coordinates:
  //   1. where the grain is along its track, so grains close together
  //      drift together and the stream swings in smooth ripples
  //   2. the time, so the ripples slowly change shape
  //   3. the grain's own noise offset, so each grain moves a little
  //      differently from its neighbours
  getDrift(stream) {
    let alongUnits = this.distance / stream.gridUnit;
    let noiseValue = noise(
      stream.noiseOrigin + alongUnits * FLOW_NOISE_ALONG_SCALE,
      stream.noiseTime,
      this.noiseOffset
    );
    // From 0-1 to -1 (one side) ... 1 (the other side). The final "true"
    // keeps the result inside -1 to 1, so the drift can never pass the cap.
    let side = map(noiseValue, FLOW_NOISE_LOW, FLOW_NOISE_HIGH, -1, 1, true);
    return side * stream.maxDrift;
  }

  // Draws the grain. stream.position is an object shared by every grain in
  // the stream, filled in by the path, so no new object is made each frame.
  draw(stream) {
    let position = stream.position;
    this.path.getPositionAt(this.distance, this.segmentIndex, position);

    // Step sideways from the track centre along the normal (the direction
    // pointing across the track): first to the grain's own fixed place in
    // the band, then by the Perlin noise drift.
    let sideways = this.laneOffset * stream.bandHalfWidth + this.getDrift(stream);
    let x = position.x + position.normalX * sideways;
    let y = position.y + position.normalY * sideways;

    // Parts of some lines (Emu Plains, Berowra...) run off the screen.
    let size = this.sizeUnits * stream.gridUnit;
    if (x < -size || x > width + size || y < -size || y > height + size) {
      return;
    }
    // A tiny square reads as a woven grain, and with thousands of grains
    // it is noticeably faster to draw than circle().
    square(x, y, size);
  }
}

// All the grains of one train line, across all of its branches.
class LineStream {
  constructor(lineName) {
    this.lineName = lineName;
    this.grains = [];

    // Pixels per grid unit, copied from the rail network in fillWithGrains().
    this.gridUnit = 1;
    // The band half-width and the largest drift, in pixels for this
    // window size. Also set in fillWithGrains().
    this.bandHalfWidth = 0;
    this.maxDrift = 0;

    // Where this line's ripples start in the noise, chosen at random once,
    // so every line swings in its own pattern instead of all in step.
    this.noiseOrigin = random(0, 1000);
    // The time coordinate of the noise, moved forward in update().
    this.noiseTime = 0;

    // Reused by every grain when it asks its path for a position.
    this.position = {};
  }

  // Creates this line's grains on its tracks. Called from setup(), and
  // again after a window resize, because the rail network then builds
  // brand new TrackPath objects with new lengths.
  fillWithGrains(paths, gridUnit) {
    this.gridUnit = gridUnit;
    this.bandHalfWidth = FLOW_BAND_HALF_WIDTH_UNITS * gridUnit;
    this.maxDrift = FLOW_MAX_DRIFT_UNITS * gridUnit;
    this.grains = [];
    for (let path of paths) {
      // Longer tracks get more grains. particleShare gives each branch of a
      // two-branch line a share of the grains, so the trunk they share
      // ends up busiest.
      let lengthInUnits = path.totalLength / gridUnit;
      let grainCount = floor((lengthInUnits * path.particleShare) / FLOW_GRAIN_SPACING_UNITS);
      grainCount = min(grainCount, FLOW_MAX_GRAINS_PER_PATH);
      for (let i = 0; i < grainCount; i++) {
        this.grains.push(new Grain(path));
      }
    }
  }

  // Moves every grain one step along its track, and moves the noise on in
  // time. millis() means the ripples change at the same pace however fast
  // the computer draws frames.
  update() {
    this.noiseTime = (millis() / 1000) * FLOW_NOISE_TIME_SPEED;
    let stepPixels = FLOW_BASE_SPEED_UNITS * this.gridUnit;
    for (let grain of this.grains) {
      grain.move(stepPixels);
    }
  }

  // Draws every grain in the given colour (a p5 color).
  draw(lineColour) {
    push();
    noStroke();
    fill(lineColour);
    // Squares are drawn centred on the grain's position.
    rectMode(CENTER);
    for (let grain of this.grains) {
      grain.draw(this);
    }
    pop();
  }
}
