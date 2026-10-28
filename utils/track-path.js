// track-path.js
// A TrackPath is one branch of one train line (for example "T1 to Emu
// Plains"), stored as a list of screen points that the particles travel
// along. It can answer "where am I if I have travelled this many pixels
// along the track?" and "how crowded is the track here?".
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic). It walks along a list of points and measures distances with
// p5's dist(), lerp() and exp().

// How often (in pixels along the track) we pre-calculate crowding.
const CROWDING_SAMPLE_SPACING = 4;

// How far a busy station's crowding reaches along the track, in grid units.
const CROWDING_REACH_UNITS = 1.1;

class TrackPath {
  constructor(lineName, branchIndex, points, particleShare) {
    this.lineName = lineName;
    this.branchIndex = branchIndex;
    this.points = points;

    // A line with two branches shares its trunk, so each branch only gets a
    // share of the line's particles. The shared trunk ends up busiest.
    this.particleShare = particleShare;

    // distanceToPoint[i] is how far along the track point i is. We use it to
    // turn "distance travelled" into a position on screen.
    this.distanceToPoint = [0];
    for (let i = 1; i < points.length; i++) {
      let stepLength = dist(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      this.distanceToPoint.push(this.distanceToPoint[i - 1] + stepLength);
    }
    this.totalLength = this.distanceToPoint[points.length - 1];

    // For City Circle routes: how far along the track the train is back at
    // Central after going round the loop. Stays 0 for every other route.
    this.loopLength = 0;

    // crowding[k] is how crowded the track is at k * CROWDING_SAMPLE_SPACING
    // pixels along it, from 0 (open track) to 1 (Central).
    this.crowding = [];
  }

  // Finds which pair of points a distance falls between. Particles move a
  // little each frame, so we start from where they were last time
  // (startIndex) and step forwards or backwards, instead of searching the
  // whole list.
  findSegmentIndex(distance, startIndex) {
    let index = constrain(startIndex, 0, this.points.length - 2);
    while (index < this.points.length - 2 && this.distanceToPoint[index + 1] < distance) {
      index++;
    }
    while (index > 0 && this.distanceToPoint[index] > distance) {
      index--;
    }
    return index;
  }

  // Fills in "position" with the x, y and sideways direction (normal) of the
  // track at the given distance. segmentIndex comes from findSegmentIndex().
  getPositionAt(distance, segmentIndex, position) {
    let start = this.points[segmentIndex];
    let end = this.points[segmentIndex + 1];
    let segmentStart = this.distanceToPoint[segmentIndex];
    let segmentLength = this.distanceToPoint[segmentIndex + 1] - segmentStart;
    if (segmentLength <= 0) {
      segmentLength = 1;
    }

    // How far between the two points we are, from 0 to 1.
    let amount = constrain((distance - segmentStart) / segmentLength, 0, 1);
    position.x = lerp(start.x, end.x, amount);
    position.y = lerp(start.y, end.y, amount);

    // The normal points sideways from the track (the direction of travel
    // turned 90 degrees). Particles are spread across the band along it.
    position.normalX = -(end.y - start.y) / segmentLength;
    position.normalY = (end.x - start.x) / segmentLength;
  }

  // Works out the crowding along the whole track once, so the particles can
  // look it up cheaply every frame. Each busy station on this branch makes
  // the track around it more crowded, fading away with distance.
  measureCrowding(busyStations, gridUnit) {
    let reach = CROWDING_REACH_UNITS * gridUnit;
    let position = {};
    this.crowding = [];

    let sampleCount = ceil(this.totalLength / CROWDING_SAMPLE_SPACING) + 1;
    let segmentIndex = 0;
    for (let k = 0; k < sampleCount; k++) {
      let distance = k * CROWDING_SAMPLE_SPACING;
      segmentIndex = this.findSegmentIndex(distance, segmentIndex);
      this.getPositionAt(distance, segmentIndex, position);

      let crowdingHere = 0;
      for (let station of busyStations) {
        let distanceToStation = dist(position.x, position.y, station.x, station.y);
        // A bell-shaped falloff: full strength at the station, fading out
        // over roughly "reach" pixels either side.
        let falloff = exp(-(distanceToStation * distanceToStation) / (2 * reach * reach));
        let strength = station.strength * station.strength * falloff;
        crowdingHere = max(crowdingHere, strength);
      }
      this.crowding.push(crowdingHere);
    }
  }

  getCrowdingAt(distance) {
    let index = round(distance / CROWDING_SAMPLE_SPACING);
    index = constrain(index, 0, this.crowding.length - 1);
    return this.crowding[index];
  }

  // For routes that start by circling the CBD: find how far along the track
  // the route arrives back at Central (the point closest to Central once we
  // are well past the start).
  findLoopLength(centralX, centralY, minimumDistance) {
    let closestDistance = Infinity;
    for (let i = 0; i < this.points.length; i++) {
      if (this.distanceToPoint[i] < minimumDistance) {
        continue;
      }
      let distanceToCentral = dist(this.points[i].x, this.points[i].y, centralX, centralY);
      if (distanceToCentral < closestDistance) {
        closestDistance = distanceToCentral;
        this.loopLength = this.distanceToPoint[i];
      }
    }
  }

  // A faint thin line under the particles, so the route stays readable even
  // in months when its particle stream is thin and broken up. guideColour
  // is an [r, g, b, opacity] list from the colour theme.
  drawGuide(guideColour) {
    noFill();
    stroke(guideColour[0], guideColour[1], guideColour[2], guideColour[3]);
    strokeWeight(1);
    beginShape();
    for (let point of this.points) {
      vertex(point.x, point.y);
    }
    endShape();
  }
}
