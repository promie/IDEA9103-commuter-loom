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
// Sizes, spacing and speeds are measured in grid units (railNetwork.gridUnit)
// instead of pixels, so the textile looks the same on a phone and on a big
// screen.
//
// AI acknowledgement: this file was written with the help of Claude
// (Anthropic). It moves each grain along a TrackPath with the path's own
// findSegmentIndex() and getPositionAt() methods, and uses p5's random()
// to give every grain its individual properties.

// Average gap between neighbouring grains along a track, in grid units.
// Smaller numbers make denser (and slower to draw) streams.
const FLOW_GRAIN_SPACING_UNITS = 0.12;

// A safety limit so a very long branch can never create too many grains.
const FLOW_MAX_GRAINS_PER_PATH = 900;

// How far either side of its track centre a grain may sit, in grid units.
// Neighbouring lines in a bundle are LANE_GAP_UNITS (0.72) apart, so a band
// of +/- 0.2 leaves a clear gap between lines.
const FLOW_BAND_HALF_WIDTH_UNITS = 0.2;

// How far an average grain travels each frame, in grid units.
const FLOW_BASE_SPEED_UNITS = 0.03;

// The range of each grain's random speed (1 = average speed).
const FLOW_MIN_SPEED_FACTOR = 0.6;
const FLOW_MAX_SPEED_FACTOR = 1.4;

// The range of each grain's random size (its width), in grid units.
const FLOW_MIN_GRAIN_SIZE_UNITS = 0.05;
const FLOW_MAX_GRAIN_SIZE_UNITS = 0.11;

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

  // Draws the grain. position is an object shared by every grain in the
  // stream, filled in by the path, so no new object is made each frame.
  draw(position, gridUnit, bandHalfWidth) {
    this.path.getPositionAt(this.distance, this.segmentIndex, position);

    // Step sideways from the track centre along the normal (the direction
    // pointing across the track).
    let sideways = this.laneOffset * bandHalfWidth;
    let x = position.x + position.normalX * sideways;
    let y = position.y + position.normalY * sideways;

    // Parts of some lines (Emu Plains, Berowra...) run off the screen.
    let size = this.sizeUnits * gridUnit;
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

    // Reused by every grain when it asks its path for a position.
    this.position = {};
  }

  // Creates this line's grains on its tracks. Called from setup(), and
  // again after a window resize, because the rail network then builds
  // brand new TrackPath objects with new lengths.
  fillWithGrains(paths, gridUnit) {
    this.gridUnit = gridUnit;
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

  // Moves every grain one step along its track.
  update() {
    let stepPixels = FLOW_BASE_SPEED_UNITS * this.gridUnit;
    for (let grain of this.grains) {
      grain.move(stepPixels);
    }
  }

  // Draws every grain in the given colour (a p5 color).
  draw(lineColour) {
    let bandHalfWidth = FLOW_BAND_HALF_WIDTH_UNITS * this.gridUnit;
    push();
    noStroke();
    fill(lineColour);
    // Squares are drawn centred on the grain's position.
    rectMode(CENTER);
    for (let grain of this.grains) {
      grain.draw(this.position, this.gridUnit, bandHalfWidth);
    }
    pop();
  }
}
