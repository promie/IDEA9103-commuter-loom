// fabric-breath.js
// The FabricBreath class makes the whole network breathe: a slow, steady
// swell and release that every line follows. How deep and how quick each
// breath is depends on how busy the network was that month. Busy months
// breathe deeply; quiet months (like April 2020) barely breathe at all.
// When the audio is playing, its loudness deepens the breath further, so
// sound and data move the fabric together.
//
// This idea was suggested by our tutor, inspired by Jon Reades' "Pulse of
// the City", which shows London's daily rhythm in Oyster card data. We
// reinterpreted it as a textile breathing over ten years, rather than a
// city's heartbeat over one week.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// Breaths per second in the quietest and busiest months.
const SLOWEST_BREATH_RATE = 0.22;
const FASTEST_BREATH_RATE = 0.4;

// How far the fabric swells at the top of a breath (0.5 = 50% wider), in
// the quietest and busiest months.
const SHALLOWEST_BREATH = 0.06;
const DEEPEST_BREATH = 0.42;

class FabricBreath {
  constructor() {
    // The network's trips this month compared with its normal month,
    // eased so changing month changes the breathing gradually.
    this.networkActivity = 1;

    // Where we are in the current breath, as an angle for sin().
    this.breathAngle = 0;

    // How far the fabric is swollen right now, from about -1 to 1 times
    // the breath depth. Read by every grain.
    this.swell = 0;
  }

  // Called once per frame. networkRatio comes from TripData; audioLevel is
  // the loudness of the audio track from 0 to 1 (0 when it is not playing).
  update(networkRatio, audioLevel) {
    this.networkActivity = lerp(this.networkActivity, networkRatio, 0.05);
    let busyness = this.getBusyness();

    // Time-based: advance the breath by a small step every frame. deltaTime
    // is p5's time since the last frame in milliseconds, so the breathing
    // keeps the same speed even if the frame rate drops.
    let breathsPerSecond = lerp(SLOWEST_BREATH_RATE, FASTEST_BREATH_RATE, busyness);
    this.breathAngle += TWO_PI * breathsPerSecond * (deltaTime / 1000);

    let depth = lerp(SHALLOWEST_BREATH, DEEPEST_BREATH, busyness);
    depth = depth * (1 + audioLevel * 0.5);

    // sin() goes smoothly from -1 to 1 and back: one full breath.
    this.swell = sin(this.breathAngle) * depth;
  }

  // 0 for a very quiet month (30% of an average month or less, like the
  // lockdowns), 1 for the busiest months (130% or more). School-holiday
  // months, at about 100%, land in between, so they breathe a little less.
  getBusyness() {
    return map(this.networkActivity, 0.3, 1.3, 0, 1, true);
  }

  getSwell() {
    return this.swell;
  }

  // A short description shown in the header.
  describe() {
    let busyness = this.getBusyness();
    if (busyness > 0.75) {
      return "breathing deeply";
    } else if (busyness > 0.35) {
      return "breathing shallowly";
    }
    return "barely breathing";
  }
}
