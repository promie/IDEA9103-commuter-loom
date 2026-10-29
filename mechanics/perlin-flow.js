// perlin-flow.js  —  MECHANIC: Perlin noise and randomness
// Mechanic owner: Wanghao Jin (wjin0936)
//
// Each train line becomes a rope of small coloured marks that travel along
// its tracks, so the network reads as a woven textile rather than a set of
// solid lines:
//   - a LineStream holds every grain of one train line (all its branches)
//   - a Grain is one particle that lives on one branch (one TrackPath).
//     Most grains are drawn as short "stitches" lying along the track;
//     the rest are small square "knots".
//   - a FabricPress is the soft dent the pointer makes when it presses
//     into the threads (see the bottom of this file)
//
// Grains are created once and then keep moving: they are never thrown
// away and re-made each frame. Each grain is given its own random
// character when it is created (where it starts, how fast it travels, how
// big it is, which side of the track it runs on, whether it is a stitch or
// a knot), and keeps it for its whole life. That way the stream looks
// varied, but nothing flickers.
//
// Perlin noise makes the grains drift gently from side to side across
// their track, like threads moving in a slow current. The drift is smooth
// (noise changes gradually, unlike random()), it only ever pushes a grain
// across its own track, and it is capped so a line never drifts into its
// neighbour.
//
// The real Opal trip data (TripData) decides how many grains each line
// shows, how fast its stream flows and how brightly it glows: busier lines
// and months are denser, quicker and brighter; quiet months thin out into
// broken, slower, dimmer threads.
//
// So each job stays separate: the data sets how much is moving, random()
// sets each grain's character, noise() sets how it sways, and the
// FabricPress adds a temporary dent on top where the pointer presses.
//
// The rest of the artwork reaches the grains through a "frame" object that
// sketch.js passes in every frame: the month's pulse (grains swell as a new
// month is woven in) and the network's breath (the bands widen, surge and
// settle together). In listening mode the selected line widens and speeds
// up while the others narrow, slow and fade back.
//
// The city sound (mechanics/audio-reactive.js) moves the grains too,
// through frame.audio: bass squeezes each band tight onto its track, mids
// shear neighbouring lines sideways against each other, and treble makes
// the grains shiver. The line being listened to reacts most strongly.
//
// The visitor's hand (mechanics/input-controls.js) reaches the grains
// through frame.input: holding the mouse gathers grains into the hand,
// dragging a line pulls it out of the network, and the flow speeds up
// near the hand. A spring then eases each grain back onto its track. The
// spring is the spring force from Daniel Shiffman's "The Nature of Code",
// chapter 3: https://natureofcode.com/oscillation/#spring-forces
//
// Sizes, spacing and speeds are measured in grid units (railNetwork.gridUnit)
// instead of pixels, so the textile looks the same on a phone and on a big
// screen.
//
// AI acknowledgement: this file was written with the help of Claude
// (Anthropic). It moves each grain along a TrackPath with the path's own
// findSegmentIndex() and getPositionAt() methods, uses p5's random() to
// give every grain its individual properties, p5's noise() for the
// sideways drift, TripData's getLineVolume() and getTripRatio() for the
// density, speed and brightness, and a Gaussian falloff for the press.

// ---- Grains ----

// Average gap between neighbouring grains along a track, in grid units,
// for the busiest line in a normal month. Smaller numbers make denser (and
// slower to draw) streams.
const FLOW_GRAIN_SPACING_UNITS = 0.07;

// A safety limit so a very long branch can never create too many grains.
const FLOW_MAX_GRAINS_PER_PATH = 1500;

// How far either side of its track centre a grain sits before any drift,
// in grid units. The Perlin noise drift below is added on top of this.
const FLOW_BAND_HALF_WIDTH_UNITS = 0.17;

// How far an average grain travels each frame, in grid units.
const FLOW_BASE_SPEED_UNITS = 0.03;

// The range of each grain's random speed (1 = average speed).
const FLOW_MIN_SPEED_FACTOR = 0.6;
const FLOW_MAX_SPEED_FACTOR = 1.4;

// The share of grains drawn as square knots; the rest are stitches.
const FLOW_KNOT_SHARE = 0.5;

// The range of a knot's random size (its width), in grid units.
const FLOW_MIN_GRAIN_SIZE_UNITS = 0.06;
const FLOW_MAX_GRAIN_SIZE_UNITS = 0.12;

// Stitches come in two thread thicknesses (chosen at random per grain),
// and a random length. Faster grains get longer stitches, so the flow
// reads as streaks along the track.
const FLOW_THIN_STITCH_UNITS = 0.05;
const FLOW_THICK_STITCH_UNITS = 0.08;
const FLOW_MIN_STITCH_LENGTH_UNITS = 0.08;
const FLOW_MAX_STITCH_LENGTH_UNITS = 0.16;

// ---- Perlin noise drift ----

// The smallest gap to keep between the grains of two neighbouring lines.
const FLOW_LANE_CLEARANCE_UNITS = 0.015;

// The furthest the noise may push a grain sideways, in grid units, worked
// out from the real track spacing. Neighbouring lines in a bundle are
// LANE_GAP_UNITS apart (from rail-network.js), so each line may use half
// of that. From that half we take away the band, the biggest knot's
// half-diagonal (0.71 x its width, for tracks at 45 degrees) and the
// clearance. With the values above this is about 0.09 grid units.
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

// ---- Trip data: density, speed and brightness ----

// How dense the quietest line (T7) is in a normal month, compared with the
// busiest line (T1). Taken from TripData.getLineVolume(), which compares the
// lines on a log scale, so small lines stay visible next to T1.
const FLOW_QUIETEST_LINE_DENSITY = 0.45;

// Each line keeps enough grains for its busiest month on record. This caps
// that, in case one unusual month is far above the line's average.
const FLOW_MAX_PEAK_TRIP_RATIO = 2;

// Speed follows the line's trip ratio for the month (1 = a normal month):
// a month with no trips would flow at 60% of normal speed, a normal month
// at full speed, and nothing ever flows faster than 120%.
const FLOW_QUIET_SPEED_SCALE = 0.6;
const FLOW_BUSY_SPEED_SCALE = 1.2;

// Brightness follows the trip ratio in the same way: a month with no trips
// would glow at 45% opacity, a normal or busier month at full opacity.
const FLOW_QUIET_INTENSITY = 0.45;

// How quickly density, speed and brightness catch up with a new month (the
// share of the remaining difference covered each frame). Small numbers
// mean grains appear and disappear gradually over about a second.
const FLOW_DATA_EASING = 0.05;

// ---- Listening mode, month pulse and breathing ----

// In listening mode the selected line's band widens and its grains speed
// up; every other line narrows, slows and fades back.
const FLOW_SELECTED_WIDTH = 1.9;
const FLOW_SELECTED_SPEED = 1.5;
const FLOW_FADED_WIDTH = 0.55;
const FLOW_FADED_SPEED = 0.45;
const FLOW_FADED_OPACITY = 0.22;

// How quickly a line eases into and out of listening mode.
const FLOW_FOCUS_EASING = 0.06;

// How much bigger grains get at the peak of a month's pulse (0.6 = 60%).
const FLOW_PULSE_GROWTH = 0.6;

// At the top of a breath, how much faster grains flow (0.5 = 50%) and how
// much bigger they get (0.35 = 35%). The band also widens with the breath.
const FLOW_BREATH_SURGE = 0.5;
const FLOW_BREATH_GROWTH = 0.35;

// ---- Sound ----

// How strongly the sound moves each line: the selected line in listening
// mode reacts most, the faded lines least.
const FLOW_SELECTED_AUDIO = 1.8;
const FLOW_FADED_AUDIO = 0.35;

// How tightly the loudest bass squeezes a band (0.6 = to 40% of its width).
const FLOW_BASS_SQUEEZE = 0.6;

// The shear is a slow sideways wave along each track: how tightly packed
// its ripples are (per pixel along the track) and how fast they travel.
const FLOW_SHEAR_RIPPLE = 0.012;
const FLOW_SHEAR_SPEED = 3;

// ---- The hand ----

// The spring that pulls a grain back onto its track after the hand has
// moved it: how strongly it pulls (stronger while a line is being dragged
// out, so the thread follows the hand closely) and how much of the speed
// is kept each frame (below 1, so it settles instead of bouncing forever).
const FLOW_SPRING_STIFFNESS = 0.045;
const FLOW_PULL_STIFFNESS = 0.12;
const FLOW_SPRING_DAMPING = 0.84;

// How much faster grains flow right under the hand (1.5 = 150% faster).
const FLOW_HAND_STIR = 1.5;

// ---- Pointer press ----

// The dent's size, in grid units: how far it reaches across the track
// (sideways) and along it. It fades smoothly with a Gaussian (bell-shaped)
// curve, so it is strongest under the pointer and gentle at its edges.
const FLOW_PRESS_WIDTH_UNITS = 1.0;
const FLOW_PRESS_LENGTH_UNITS = 1.5;

// How hard the press pushes, as a multiple of FLOW_PRESS_WIDTH_UNITS.
// Keeping it below 2.2 means threads are squeezed together but never
// pushed past each other, so the bundle keeps its order. (Holding the
// mouse button gathers the threads instead: see InputControls.)
const FLOW_PRESS_DEPTH = 1.3;

// Beyond this many widths the dent is too faint to matter, so grains
// further away skip the maths.
const FLOW_PRESS_REACH = 3.5;

// How quickly the dent follows the pointer and grows or fades (share of
// the remaining difference covered each frame).
const FLOW_PRESS_FOLLOW = 0.35;
const FLOW_PRESS_EASING = 0.08;

// How quickly each grain moves to where the press wants it. Below 1, so the
// threads give way softly and spring back gradually (over about a second)
// when the press lifts.
const FLOW_GRAIN_SPRING = 0.12;

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
    // Which side of the track it runs on: -1 is one edge of the band,
    // 0 the centre, 1 the other edge.
    this.laneOffset = random(-1, 1);
    // Its own position in the noise, so its drift is a little different
    // from the grains around it.
    this.noiseOffset = random(0, FLOW_NOISE_GRAIN_SPREAD);
    // Its place in the queue to be shown, from 0 to 1. A grain is visible
    // while the month's density is above this number, so in a quiet month
    // only the grains with the lowest numbers show. The busier the month,
    // the more grains join in, and the same grains always show first.
    this.showThreshold = random(0, 1);

    // What it looks like: a square knot, or a stitch along the track.
    this.isKnot = random(1) < FLOW_KNOT_SHARE;
    // A knot's width, in grid units.
    this.sizeUnits = random(FLOW_MIN_GRAIN_SIZE_UNITS, FLOW_MAX_GRAIN_SIZE_UNITS);
    // A stitch's thread: thin or thick, and its length (faster = longer).
    this.isThickStitch = random(1) < 0.5;
    this.lengthUnits = random(FLOW_MIN_STITCH_LENGTH_UNITS, FLOW_MAX_STITCH_LENGTH_UNITS) * this.speedFactor;

    // How far the pointer's press currently pushes it sideways, in pixels.
    // It eases towards the press (see locate()), so it springs back softly.
    this.pressOffset = 0;

    // How far the hand has moved it off its track, in pixels, and how fast
    // that is changing. The spring brings both back to 0 (see locate()).
    this.offsetX = 0;
    this.offsetY = 0;
    this.velocityX = 0;
    this.velocityY = 0;

    // Whether it is drawn this frame, and where, filled in by locate().
    this.isShown = false;
    this.x = 0;
    this.y = 0;
    this.tangentX = 1;
    this.tangentY = 0;

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

  // Works out where to draw the grain this frame, and stores it in this.x,
  // this.y and this.tangentX/Y (the direction of the track). Returns false
  // if the grain is off the screen. stream.position is an object shared by
  // every grain in the stream, so no new object is made each frame.
  locate(stream, press, input) {
    let position = stream.position;
    this.path.getPositionAt(this.distance, this.segmentIndex, position);
    let normalX = position.normalX;
    let normalY = position.normalY;

    // Step sideways from the track centre along the normal (the direction
    // pointing across the track): first to the grain's own fixed place in
    // the band, then by the Perlin noise drift.
    let sideways = this.laneOffset * stream.currentBandHalfWidth + this.getDrift(stream);
    let x = position.x + normalX * sideways;
    let y = position.y + normalY * sideways;

    // Then by the sound: the mid-frequency shear (a sideways wave moving
    // along the track) and the treble shiver (a tiny random jitter).
    let shear = sin(this.distance * FLOW_SHEAR_RIPPLE - stream.shearPhase) * stream.shearAmount;
    let shiver = random(-0.5, 0.5) * stream.shiverAmount;
    x += normalX * (shear + shiver);
    y += normalY * (shear + shiver);

    // Then by the pointer's press, eased so the thread gives way and
    // recovers softly instead of snapping.
    let pressTarget = press.getPush(x, y, normalX, normalY, stream);
    this.pressOffset = lerp(this.pressOffset, pressTarget, FLOW_GRAIN_SPRING);
    x += normalX * this.pressOffset;
    y += normalY * this.pressOffset;

    // Then by the hand. The spring pulls the grain towards its target
    // offset: 0 (back onto its track), or the pulled shape while its line
    // is being dragged out. Holding the mouse gathers it into the hand.
    let pullWeight = input.getPullWeight(this);
    let targetX = input.pullOffsetX * pullWeight;
    let targetY = input.pullOffsetY * pullWeight;
    let stiffness = FLOW_SPRING_STIFFNESS;
    if (pullWeight > 0) {
      stiffness = FLOW_PULL_STIFFNESS;
    }
    this.velocityX += (targetX - this.offsetX) * stiffness;
    this.velocityY += (targetY - this.offsetY) * stiffness;
    input.applyGather(this, x, y);
    this.velocityX *= FLOW_SPRING_DAMPING;
    this.velocityY *= FLOW_SPRING_DAMPING;
    this.offsetX += this.velocityX;
    this.offsetY += this.velocityY;
    x += this.offsetX;
    y += this.offsetY;

    // Parts of some lines (Emu Plains, Berowra...) run off the screen.
    let margin = stream.gridUnit * FLOW_MAX_STITCH_LENGTH_UNITS * FLOW_MAX_SPEED_FACTOR;
    if (x < -margin || x > width + margin || y < -margin || y > height + margin) {
      return false;
    }

    this.x = x;
    this.y = y;
    // The track direction is the normal turned back 90 degrees.
    this.tangentX = normalY;
    this.tangentY = -normalX;
    return true;
  }
}

// All the grains of one train line, across all of its branches.
// tripData is the project's TripData object (utils/trip-data.js).
class LineStream {
  constructor(lineName, tripData) {
    this.lineName = lineName;
    this.tripData = tripData;
    this.grains = [];

    // How dense this line is in a normal month compared with the busiest
    // line: from FLOW_QUIETEST_LINE_DENSITY (T7) up to 1 (T1).
    this.lineDensity = map(tripData.getLineVolume(lineName), 0, 1, FLOW_QUIETEST_LINE_DENSITY, 1);

    // This line's busiest month compared with its normal month. The line
    // gets enough grains for that month, and fewer are shown in quieter ones.
    this.peakTripRatio = this.findPeakTripRatio();

    // The share of grains shown (0 to 1), the speed scale and the
    // brightness, for the month shown. "target" values are set by
    // setMonth(); the others ease towards them in update(). Starting at 0
    // means the streams weave themselves in when the page opens.
    this.visibleShare = 0;
    this.targetVisibleShare = 0;
    this.speedScale = 1;
    this.targetSpeedScale = 1;
    this.intensity = FLOW_QUIET_INTENSITY;
    this.targetIntensity = 1;

    // Pixels per grid unit, copied from the rail network in fillWithGrains(),
    // and the sizes below in pixels for this window size.
    this.gridUnit = 1;
    this.bandHalfWidth = 0;
    this.maxDrift = 0;
    this.thinStitchWeight = 1;
    this.thickStitchWeight = 1;

    // Listening mode, eased so a line comes forward or fades back gently:
    // how wide its band is, how fast it flows and how visible it is.
    this.focusWidth = 1;
    this.focusSpeed = 1;
    this.focusOpacity = 1;
    this.focusAudio = 1;
    this.targetFocusWidth = 1;
    this.targetFocusSpeed = 1;
    this.targetFocusOpacity = 1;
    this.targetFocusAudio = 1;

    // Neighbouring lines shear in opposite directions to the mid
    // frequencies: odd-numbered lines (T1, T3...) one way, even the other.
    // int() turns the "1" of "T1" into the number 1.
    if (int(lineName.substring(1)) % 2 === 1) {
      this.shearDirection = 1;
    } else {
      this.shearDirection = -1;
    }

    // Set each frame in update(): the band's half width after listening
    // mode and the breath, and how much the month's pulse and the breath
    // enlarge every grain.
    this.currentBandHalfWidth = 0;
    this.sizeBoost = 1;

    // Set each frame in update() from the sound: how far (in pixels) the
    // mids shear the band and the treble shivers it, and where the shear
    // wave has travelled to.
    this.shearAmount = 0;
    this.shearPhase = 0;
    this.shiverAmount = 0;

    // Where this line's ripples start in the noise, chosen at random once,
    // so every line swings in its own pattern instead of all in step.
    this.noiseOrigin = random(0, 1000);
    // The time coordinate of the noise, moved forward in update().
    this.noiseTime = 0;

    // Reused by every grain when it asks its path for a position.
    this.position = {};
  }

  // The largest getTripRatio() of any month in the data, i.e. how much
  // busier than normal this line's busiest month was. Worked out once.
  findPeakTripRatio() {
    let peak = 1;
    for (let monthIndex = 0; monthIndex < this.tripData.getMonthCount(); monthIndex++) {
      peak = max(peak, this.tripData.getTripRatio(this.lineName, monthIndex));
    }
    return min(peak, FLOW_MAX_PEAK_TRIP_RATIO);
  }

  // Creates this line's grains on its tracks. Called from setup(), and
  // again after a window resize, because the rail network then builds
  // brand new TrackPath objects with new lengths.
  fillWithGrains(paths, gridUnit) {
    this.gridUnit = gridUnit;
    this.bandHalfWidth = FLOW_BAND_HALF_WIDTH_UNITS * gridUnit;
    this.maxDrift = FLOW_MAX_DRIFT_UNITS * gridUnit;
    this.thinStitchWeight = FLOW_THIN_STITCH_UNITS * gridUnit;
    this.thickStitchWeight = FLOW_THICK_STITCH_UNITS * gridUnit;
    this.grains = [];
    for (let path of paths) {
      // Longer tracks get more grains. particleShare gives each branch of a
      // two-branch line a share of the grains, so the trunk they share
      // ends up busiest. Busier lines get more grains per unit of track,
      // and every line gets enough for its busiest month.
      let lengthInUnits = path.totalLength / gridUnit;
      let normalMonthCount = (lengthInUnits * path.particleShare * this.lineDensity) / FLOW_GRAIN_SPACING_UNITS;
      let grainCount = floor(normalMonthCount * this.peakTripRatio);
      grainCount = min(grainCount, FLOW_MAX_GRAINS_PER_PATH);
      for (let i = 0; i < grainCount; i++) {
        this.grains.push(new Grain(path));
      }
    }
  }

  // Reads the month's trips for this line and sets the density, speed and
  // brightness to move towards. tripRatio is this month compared with the
  // line's own normal month, so a quiet month thins every line by the same
  // proportion.
  setMonth(monthIndex) {
    let tripRatio = this.tripData.getTripRatio(this.lineName, monthIndex);

    // Shown grains are in proportion to trips: half the trips of the
    // busiest month shows half of the grains.
    this.targetVisibleShare = constrain(tripRatio / this.peakTripRatio, 0, 1);

    // Busier months flow a little faster, quieter months more slowly.
    // This scales every grain's own random speed by the same amount, so
    // fast grains stay faster than slow ones.
    this.targetSpeedScale = constrain(
      map(tripRatio, 0, 1, FLOW_QUIET_SPEED_SCALE, 1),
      FLOW_QUIET_SPEED_SCALE,
      FLOW_BUSY_SPEED_SCALE
    );

    // Quieter months glow more faintly.
    this.targetIntensity = constrain(map(tripRatio, 0, 1, FLOW_QUIET_INTENSITY, 1), FLOW_QUIET_INTENSITY, 1);
  }

  // Listening mode: selectedLineName is the line being listened to, or null.
  setListening(selectedLineName) {
    this.targetFocusWidth = 1;
    this.targetFocusSpeed = 1;
    this.targetFocusOpacity = 1;
    this.targetFocusAudio = 1;
    if (selectedLineName === this.lineName) {
      this.targetFocusWidth = FLOW_SELECTED_WIDTH;
      this.targetFocusSpeed = FLOW_SELECTED_SPEED;
      this.targetFocusAudio = FLOW_SELECTED_AUDIO;
    } else if (selectedLineName !== null) {
      this.targetFocusWidth = FLOW_FADED_WIDTH;
      this.targetFocusSpeed = FLOW_FADED_SPEED;
      this.targetFocusOpacity = FLOW_FADED_OPACITY;
      this.targetFocusAudio = FLOW_FADED_AUDIO;
    }
  }

  // Moves every grain one step along its track, and moves the noise on in
  // time. millis() means the ripples change at the same pace however fast
  // the computer draws frames. frame comes from sketch.js: frame.pulse
  // (0-1) is the month change, frame.breathSwell the network's breath
  // (about -0.6 to 0.6), frame.audio the AudioReactive object,
  // frame.input the InputControls object and frame.time a clock that moves
  // on 0.01 each frame.
  update(frame) {
    // Ease towards the month's density, speed and brightness, so a change
    // of month fades in and out instead of jumping.
    this.visibleShare = lerp(this.visibleShare, this.targetVisibleShare, FLOW_DATA_EASING);
    this.speedScale = lerp(this.speedScale, this.targetSpeedScale, FLOW_DATA_EASING);
    this.intensity = lerp(this.intensity, this.targetIntensity, FLOW_DATA_EASING);
    this.focusWidth = lerp(this.focusWidth, this.targetFocusWidth, FLOW_FOCUS_EASING);
    this.focusSpeed = lerp(this.focusSpeed, this.targetFocusSpeed, FLOW_FOCUS_EASING);
    this.focusOpacity = lerp(this.focusOpacity, this.targetFocusOpacity, FLOW_FOCUS_EASING);
    this.focusAudio = lerp(this.focusAudio, this.targetFocusAudio, FLOW_FOCUS_EASING);

    // The breath widens the band and surges the flow; the pulse and the
    // breath both enlarge the grains.
    this.currentBandHalfWidth = this.bandHalfWidth * this.focusWidth * (1 + frame.breathSwell);

    // The sound: bass squeezes the band, mids shear it, treble shivers it.
    let audio = frame.audio;
    this.currentBandHalfWidth *= 1 - audio.getBassSqueeze() * FLOW_BASS_SQUEEZE * this.focusAudio;
    this.shearAmount = audio.getMidShear() * this.shearDirection * this.focusAudio;
    this.shearPhase = frame.time * FLOW_SHEAR_SPEED;
    this.shiverAmount = audio.getTrebleShiver() * this.focusAudio;
    this.sizeBoost = (1 + frame.pulse * FLOW_PULSE_GROWTH) * (1 + frame.breathSwell * FLOW_BREATH_GROWTH);

    this.noiseTime = (millis() / 1000) * FLOW_NOISE_TIME_SPEED;
    let stepPixels = FLOW_BASE_SPEED_UNITS * this.gridUnit * this.speedScale * this.focusSpeed;
    stepPixels = stepPixels * (1 + frame.breathSwell * FLOW_BREATH_SURGE);
    // Hidden grains keep moving too, so when a busier month brings them
    // back they are already spread along the track.
    for (let grain of this.grains) {
      // The flow speeds up near the hand, like stirring a current.
      let stir = frame.input.getTouchAmount(grain.x, grain.y) * FLOW_HAND_STIR;
      grain.move(stepPixels * (1 + stir));
    }
  }

  // Draws the month's share of grains in the given colour (a p5 color),
  // pushed by the pointer's press (frame.press) and moved by the hand
  // (frame.input).
  //
  // Thousands of marks are drawn every frame, so instead of p5's square()
  // and line() (which do extra work on every call) we draw straight onto
  // the canvas. drawingContext is p5's handle on the browser's canvas 2D
  // API; beginPath(), rect(), moveTo(), lineTo(), fill() and stroke() are
  // that API's own drawing commands. All the knots are collected into one
  // path and filled at once:
  // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
  draw(lineColour, frame) {
    let press = frame.press;
    // Locate every shown grain first (this also eases its press offset).
    let shownCount = 0;
    for (let grain of this.grains) {
      grain.isShown = grain.showThreshold < this.visibleShare && grain.locate(this, press, frame.input);
      if (grain.isShown) {
        shownCount++;
      }
    }
    if (shownCount === 0) {
      return;
    }

    // The month's brightness fades the colour, and listening mode fades
    // every line except the selected one.
    lineColour.setAlpha(alpha(lineColour) * this.intensity * this.focusOpacity);

    push();
    let context = drawingContext;

    // Knots: small squares centred on each grain.
    noStroke();
    fill(lineColour);
    context.beginPath();
    for (let grain of this.grains) {
      if (grain.isShown && grain.isKnot) {
        let size = grain.sizeUnits * this.gridUnit * this.sizeBoost;
        context.rect(grain.x - size / 2, grain.y - size / 2, size, size);
      }
    }
    context.fill();

    // Stitches: short dashes lying along the track, in two thicknesses.
    // Square ends make them read as woven threads rather than dots.
    noFill();
    stroke(lineColour);
    strokeCap(SQUARE);
    this.drawStitches(false, this.thinStitchWeight * this.sizeBoost);
    this.drawStitches(true, this.thickStitchWeight * this.sizeBoost);
    pop();
  }

  // Strokes every shown stitch of one thickness. Unlike the knots, each
  // stitch is stroked on its own: in testing, one huge path of thousands of
  // short strokes was slower for the browser to draw than many tiny ones.
  drawStitches(isThick, weight) {
    let context = drawingContext;
    strokeWeight(weight);
    for (let grain of this.grains) {
      if (grain.isShown && !grain.isKnot && grain.isThickStitch === isThick) {
        let halfLength = (grain.lengthUnits * this.gridUnit * this.sizeBoost) / 2;
        context.beginPath();
        context.moveTo(grain.x - grain.tangentX * halfLength, grain.y - grain.tangentY * halfLength);
        context.lineTo(grain.x + grain.tangentX * halfLength, grain.y + grain.tangentY * halfLength);
        context.stroke();
      }
    }
  }
}

// The dent the pointer makes when it presses into the threads, like a
// finger pressing into fabric. Threads near the pointer are pushed out to
// either side of it, across their own track, so the woven bundle parts and
// bunches up around the pointer, then springs back when it leaves.
//
// The push uses the shape of the slope of a Gaussian (bell) curve:
//   push = depth * a * exp(-(a*a + b*b) / 2)
// where a is how far the grain is across the track from the pointer and b
// how far along it (both measured in press widths). It is 0 right under
// the pointer and far away, and strongest one width either side, so the
// threads are moved aside smoothly without any sudden flip in direction.
// The Gaussian falloff is a standard smoothing curve:
// https://en.wikipedia.org/wiki/Gaussian_function
//
// The press only changes where grains are drawn. The tracks themselves
// (TrackPath points) are never changed.
class FabricPress {
  constructor() {
    // The dent's centre, which glides after the pointer.
    this.x = 0;
    this.y = 0;
    // How deep the dent is now (0 = no dent), and how deep it is heading.
    this.strength = 0;
    this.targetStrength = 0;
  }

  // Called once a frame with the pointer's position and whether it is
  // parting the threads (over the map, and not gathering or pulling).
  update(pointerX, pointerY, isParting) {
    if (isParting) {
      this.targetStrength = FLOW_PRESS_DEPTH;
    } else {
      this.targetStrength = 0;
    }

    // A new press starts right under the pointer; an existing one glides
    // after it, so a fast flick of the mouse drags a soft wake.
    if (this.strength < 0.02) {
      this.x = pointerX;
      this.y = pointerY;
    } else {
      this.x = lerp(this.x, pointerX, FLOW_PRESS_FOLLOW);
      this.y = lerp(this.y, pointerY, FLOW_PRESS_FOLLOW);
    }
    this.strength = lerp(this.strength, this.targetStrength, FLOW_PRESS_EASING);
  }

  // How far (in pixels, along the track's normal) the press pushes a grain
  // drawn at (x, y). Positive pushes towards the normal's side.
  getPush(x, y, normalX, normalY, stream) {
    if (this.strength < 0.001) {
      return 0;
    }
    let pressWidth = FLOW_PRESS_WIDTH_UNITS * stream.gridUnit;
    let offsetX = x - this.x;
    let offsetY = y - this.y;
    let reach = FLOW_PRESS_REACH * pressWidth;
    if (abs(offsetX) > reach || abs(offsetY) > reach) {
      return 0;
    }

    // Across the track (along the normal) and along it (along the
    // tangent), in press widths.
    let across = (offsetX * normalX + offsetY * normalY) / pressWidth;
    let along = (offsetX * normalY - offsetY * normalX) / (FLOW_PRESS_LENGTH_UNITS * stream.gridUnit);
    return this.strength * pressWidth * across * exp(-(across * across + along * along) / 2);
  }
}
