// rail-network.js
// The RailNetwork class turns the grid layout in network-layout.js into
// screen-space tracks (TrackPath objects) for every line, fitted to the
// window. Where several lines share a stretch of track it places them side
// by side as a parallel bundle, the way the official network map does.
// It also draws the map furniture (track guides, station names, line
// badges) and answers "which line is the mouse near?".
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic). The corner rounding uses Chaikin's corner-cutting algorithm
// (see smoothCorners() below for the reference).

// Spacing between neighbouring lines in a bundle, in grid units.
const LANE_GAP_UNITS = 0.72;

// How far before a station a bend or lane change starts, in grid units.
const CORNER_INSET_UNITS = 0.7;

// How close (in pixels) the mouse must be to a line to touch it.
const LINE_HIT_DISTANCE = 18;

class RailNetwork {
  constructor(stations, lineRoutes, laneOrder, theme) {
    this.stations = stations;
    this.lineRoutes = lineRoutes;
    this.laneOrder = laneOrder;
    this.theme = theme;

    // Set in build(): how many pixels one grid unit is, and where grid
    // position 0, 0 (Central) sits on screen.
    this.gridUnit = 30;
    this.originX = 0;
    this.originY = 0;

    // lanes["CEN|RED"] is the list of lines sharing the track between
    // Central and Redfern, in LANE_ORDER order.
    this.lanes = {};

    // paths["T1"] is the list of TrackPath objects (one per branch) for T1.
    this.paths = {};

    // Points spaced along every line, used to find the line nearest the mouse.
    this.hitPoints = [];

    // Where each line's name badge is drawn.
    this.badges = [];

    // A rectangle labels must stay out of (the DataPanel), or null.
    this.reservedArea = null;

    // The area the map is fitted into: from a little below the top of the
    // screen (leaving room for the title and the data panel) down to the
    // top of the control dock, so no track or station sits under the controls.
    this.mapTop = 40;
    this.mapBottom = 600;
  }

  isInReservedArea(x, y) {
    let area = this.reservedArea;
    if (area === null) {
      return false;
    }
    return x > area.left && x < area.right && y > area.top && y < area.bottom;
  }

  // Rebuilds every track for the current window size. Called from setup()
  // and again whenever the window is resized.
  build() {
    // Use the tall view on portrait screens and the wide one otherwise.
    let viewLeft = MAP_VIEW_LEFT;
    let viewRight = MAP_VIEW_RIGHT;
    let viewTop = MAP_VIEW_TOP;
    let viewBottom = MAP_VIEW_BOTTOM;
    if (this.mapBottom - this.mapTop > width) {
      viewLeft = PORTRAIT_VIEW_LEFT;
      viewRight = PORTRAIT_VIEW_RIGHT;
      viewTop = PORTRAIT_VIEW_TOP;
      viewBottom = PORTRAIT_VIEW_BOTTOM;
    }

    // Scale the grid so the whole view fits, then centre it on screen.
    let viewWidth = viewRight - viewLeft;
    let viewHeight = viewBottom - viewTop;
    let mapHeight = this.mapBottom - this.mapTop;
    this.gridUnit = min(width / viewWidth, mapHeight / viewHeight);
    this.originX = width / 2 - ((viewLeft + viewRight) / 2) * this.gridUnit;
    this.originY = this.mapTop + mapHeight / 2 - ((viewTop + viewBottom) / 2) * this.gridUnit;

    this.collectLanes();

    this.paths = {};
    this.hitPoints = [];
    for (let route of this.lineRoutes) {
      // Lines with two branches give each branch a share of the particles,
      // so the shared trunk carries the most.
      let particleShare = 1 / sqrt(route.branches.length);
      let branchPaths = [];
      for (let branchIndex = 0; branchIndex < route.branches.length; branchIndex++) {
        let stopIds = route.branches[branchIndex];
        let path = this.buildTrackPath(route.lineName, branchIndex, stopIds, particleShare);
        branchPaths.push(path);
        this.addHitPoints(path);
      }
      this.paths[route.lineName] = branchPaths;
    }

    this.findBadgePositions();
  }

  getStation(stationId) {
    for (let station of this.stations) {
      if (station.id === stationId) {
        return station;
      }
    }
    return null;
  }

  // Grid position -> screen pixels.
  toScreenX(station) {
    return this.originX + station.x * this.gridUnit;
  }

  toScreenY(station) {
    return this.originY + station.y * this.gridUnit;
  }

  // The same pair of stations always gives the same key, whichever way
  // round they are passed in ("CEN|RED", never "RED|CEN").
  getEdgeKey(stationIdA, stationIdB) {
    if (stationIdA < stationIdB) {
      return stationIdA + "|" + stationIdB;
    }
    return stationIdB + "|" + stationIdA;
  }

  getPathsFor(lineName) {
    return this.paths[lineName] ?? [];
  }

  // Records which lines use each stretch of track between two stations.
  // Going through the lines in LANE_ORDER means each list is already in
  // side-by-side order.
  collectLanes() {
    this.lanes = {};
    for (let lineName of this.laneOrder) {
      let route = this.getRoute(lineName);
      for (let stopIds of route.branches) {
        for (let i = 0; i < stopIds.length - 1; i++) {
          let key = this.getEdgeKey(stopIds[i], stopIds[i + 1]);
          if (this.lanes[key] === undefined) {
            this.lanes[key] = [];
          }
          // includes() checks whether the line is already in the list
          // (it is when two branches share this stretch).
          if (!this.lanes[key].includes(lineName)) {
            this.lanes[key].push(lineName);
          }
        }
      }
    }
  }

  getRoute(lineName) {
    for (let route of this.lineRoutes) {
      if (route.lineName === lineName) {
        return route;
      }
    }
    return null;
  }

  // Turns a list of stop ids into a smooth TrackPath on screen.
  buildTrackPath(lineName, branchIndex, stopIds, particleShare) {
    let central = this.getStation("CEN");
    let centralX = this.toScreenX(central);
    let centralY = this.toScreenY(central);
    let laneGap = LANE_GAP_UNITS * this.gridUnit;
    let cornerInset = CORNER_INSET_UNITS * this.gridUnit;
    let points = [];

    for (let i = 0; i < stopIds.length - 1; i++) {
      let stationA = this.getStation(stopIds[i]);
      let stationB = this.getStation(stopIds[i + 1]);
      let ax = this.toScreenX(stationA);
      let ay = this.toScreenY(stationA);
      let bx = this.toScreenX(stationB);
      let by = this.toScreenY(stationB);
      let stretchLength = dist(ax, ay, bx, by);

      // Direction of travel along this stretch, as a length-1 step.
      let directionX = (bx - ax) / stretchLength;
      let directionY = (by - ay) / stretchLength;

      // The lane order in a bundle is always measured "travelling away from
      // Central", so a bundle keeps the same order as it turns corners.
      // If we are travelling towards Central, the sides flip.
      let side = 1;
      let aDistanceFromCentral = dist(ax, ay, centralX, centralY);
      let bDistanceFromCentral = dist(bx, by, centralX, centralY);
      if (aDistanceFromCentral > bDistanceFromCentral) {
        side = -1;
      } else if (aDistanceFromCentral === bDistanceFromCentral && stationA.id > stationB.id) {
        side = -1;
      }

      // Which lane this line takes in the bundle: lanes are centred on the
      // track, e.g. with 3 lines the offsets are -1, 0 and +1 lane gaps.
      let linesHere = this.lanes[this.getEdgeKey(stationA.id, stationB.id)];
      let laneNumber = linesHere.indexOf(lineName) - (linesHere.length - 1) / 2;
      let offsetX = -directionY * side * laneNumber * laneGap;
      let offsetY = directionX * side * laneNumber * laneGap;

      // Start each stretch a little after station A and end it a little
      // before station B. The gaps become short diagonal "chamfers" at
      // corners and lane changes, which smoothCorners() then rounds off.
      let inset = min(cornerInset, stretchLength * 0.35);
      let startInset = inset;
      let endInset = inset;
      if (i === 0) {
        startInset = 0;
      }
      if (i === stopIds.length - 2) {
        endInset = 0;
      }
      points.push({ x: ax + offsetX + directionX * startInset, y: ay + offsetY + directionY * startInset });
      points.push({ x: bx + offsetX - directionX * endInset, y: by + offsetY - directionY * endInset });
    }

    let smoothPoints = this.smoothCorners(this.smoothCorners(points));
    let path = new TrackPath(lineName, branchIndex, smoothPoints, particleShare);

    // City Circle routes start at Central, go round the loop and come back
    // to Central before heading out.
    let isCityCircleRoute = stopIds[0] === "CEN" && stopIds.indexOf("CEN", 1) !== -1;
    if (isCityCircleRoute) {
      path.findLoopLength(centralX, centralY, 6 * this.gridUnit);
    }

    path.measureCrowding(this.getBusyStations(stopIds), this.gridUnit);
    return path;
  }

  // Rounds off sharp corners by cutting each one into two points, a quarter
  // and three quarters of the way along every segment. Running it twice
  // gives a soft curve. The first and last points stay where they are.
  // This technique is Chaikin's corner-cutting algorithm:
  // https://www.cs.unc.edu/~dm/UNC/COMP258/LECTURES/Chaikins-Algorithm.pdf
  smoothCorners(points) {
    let smoothed = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      let current = points[i];
      let next = points[i + 1];
      smoothed.push({ x: lerp(current.x, next.x, 0.25), y: lerp(current.y, next.y, 0.25) });
      smoothed.push({ x: lerp(current.x, next.x, 0.75), y: lerp(current.y, next.y, 0.75) });
    }
    smoothed.push(points[points.length - 1]);
    return smoothed;
  }

  // The named stations on one branch, with their screen position and how
  // busy they are (tier 3 = 1, tier 1 = 0.33).
  getBusyStations(stopIds) {
    let busyStations = [];
    for (let stopId of stopIds) {
      let station = this.getStation(stopId);
      if (station.tier > 0) {
        busyStations.push({ x: this.toScreenX(station), y: this.toScreenY(station), strength: station.tier / 3 });
      }
    }
    return busyStations;
  }

  // Remembers a point every 10 pixels along the path, for mouse hit tests.
  addHitPoints(path) {
    let position = {};
    let segmentIndex = 0;
    for (let distance = 0; distance <= path.totalLength; distance += 10) {
      segmentIndex = path.findSegmentIndex(distance, segmentIndex);
      path.getPositionAt(distance, segmentIndex, position);
      this.hitPoints.push({ x: position.x, y: position.y, path: path, distance: distance });
    }
  }

  // The hit point closest to (x, y), or null if no line is close enough.
  findNearestHitPoint(x, y) {
    let nearest = null;
    let nearestDistance = LINE_HIT_DISTANCE;
    for (let hitPoint of this.hitPoints) {
      let distanceToMouse = dist(x, y, hitPoint.x, hitPoint.y);
      if (distanceToMouse < nearestDistance) {
        nearestDistance = distanceToMouse;
        nearest = hitPoint;
      }
    }
    return nearest;
  }

  // Is (x, y) in the part of the screen clear of the header and timeline?
  isInLabelArea(x, y) {
    let onScreen = x > 26 && x < width - 26 && y > 150 && y < this.mapBottom - 24;
    return onScreen && !this.isInReservedArea(x, y);
  }

  // A station is a "through" stop if some line passes through it rather
  // than starting or ending there.
  isThroughStop(stationId) {
    for (let route of this.lineRoutes) {
      for (let stopIds of route.branches) {
        for (let i = 1; i < stopIds.length - 1; i++) {
          if (stopIds[i] === stationId) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // One badge per line end: where the line leaves the screen, or at its
  // terminus if that is on screen.
  findBadgePositions() {
    this.badges = [];
    let position = {};
    for (let route of this.lineRoutes) {
      let branchPaths = this.paths[route.lineName];
      for (let branchIndex = 0; branchIndex < route.branches.length; branchIndex++) {
        let stopIds = route.branches[branchIndex];
        let path = branchPaths[branchIndex];

        // Check both ends of the branch. City Circle routes start in the
        // CBD, so only their far end gets a badge.
        let ends = [
          { stationId: stopIds[0], startDistance: 0, step: 4 },
          { stationId: stopIds[stopIds.length - 1], startDistance: path.totalLength, step: -4 },
        ];
        if (path.loopLength > 0) {
          ends.splice(0, 1);
        }

        for (let end of ends) {
          // Skip lines that end on screen on another line's trunk (T6 and
          // T7 at Lidcombe, T9 at Gordon); a badge would cover the bundle.
          let endStation = this.getStation(end.stationId);
          let endIsVisible = this.isInLabelArea(this.toScreenX(endStation), this.toScreenY(endStation));
          if (endIsVisible && this.isThroughStop(end.stationId)) {
            continue;
          }

          // Walk in from the end of the track until we reach the visible area.
          let segmentIndex = path.findSegmentIndex(end.startDistance, 0);
          for (let distance = end.startDistance; distance >= 0 && distance <= path.totalLength; distance += end.step) {
            segmentIndex = path.findSegmentIndex(distance, segmentIndex);
            path.getPositionAt(distance, segmentIndex, position);
            if (this.isInLabelArea(position.x, position.y)) {
              this.addBadge(route.lineName, position.x, position.y);
              break;
            }
          }
        }
      }
    }
  }

  // Adds a badge unless this line already has one here. If it would cover
  // another line's badge, it is nudged upwards until it doesn't.
  addBadge(lineName, x, y) {
    for (let badge of this.badges) {
      if (badge.lineName === lineName && dist(badge.anchorX, badge.anchorY, x, y) < 30) {
        return;
      }
    }

    // Try the line's own spot first, then the nearest spots above and
    // below it in turn (22 pixels up, 22 down, 44 up, 44 down...), so a
    // badge that has to move stays as close to its line as possible.
    // Only spots inside the map area count, so a badge never ends up in the
    // header or the control dock. If no spot is free, it stays on its line.
    let badgeY = y;
    for (let attempt = 0; attempt < 9; attempt++) {
      let tryY = y;
      let distance = ceil(attempt / 2) * 22;
      if (attempt % 2 === 1) {
        tryY = y - distance;
      } else if (attempt > 0) {
        tryY = y + distance;
      }
      if (this.isInLabelArea(x, tryY) && !this.badgeWouldOverlap(x, tryY)) {
        badgeY = tryY;
        break;
      }
    }
    this.badges.push({ lineName: lineName, x: x, y: badgeY, anchorX: x, anchorY: y });
  }

  // Would a badge centred at (x, y) cover another badge or a station name?
  // Badges are 26 x 18; names sit just right of and above their station.
  badgeWouldOverlap(x, y) {
    for (let badge of this.badges) {
      if (abs(badge.x - x) < 30 && abs(badge.y - y) < 20) {
        return true;
      }
    }

    push();
    textSize(11);
    for (let station of this.stations) {
      if (station.tier < 2) {
        continue;
      }
      let labelLeft = this.toScreenX(station) - 6;
      let labelTop = this.toScreenY(station) - 18;
      let labelRight = this.toScreenX(station) + 13 + textWidth(station.name);
      let labelBottom = this.toScreenY(station) + 6;
      let overlapsSideways = x + 13 > labelLeft && x - 13 < labelRight;
      let overlapsUpDown = y + 9 > labelTop && y - 9 < labelBottom;
      if (overlapsSideways && overlapsUpDown) {
        pop();
        return true;
      }
    }
    pop();
    return false;
  }

  drawTrackGuides() {
    for (let route of this.lineRoutes) {
      for (let path of this.paths[route.lineName]) {
        path.drawGuide(this.theme.palette.trackGuide);
      }
    }
  }

  // Names of the big stations, on a small paper-coloured background so
  // they stay readable over the moving particles. The CBD hubs (tier 3)
  // are labelled first, then the interchanges (tier 2). A name is skipped
  // if it would overlap one already drawn, which matters on small screens
  // where the CBD stations sit very close together.
  drawStationLabels() {
    push();
    textSize(11);
    textAlign(LEFT, CENTER);
    let drawnLabels = [];
    for (let tier = 3; tier >= 2; tier--) {
      for (let station of this.stations) {
        if (station.tier === tier) {
          this.drawStationLabel(station, drawnLabels);
        }
      }
    }
    pop();
  }

  // Draws one station's dot and name, unless the name would overlap a
  // label in drawnLabels. Each drawn label is added to that list.
  drawStationLabel(station, drawnLabels) {
    let x = this.toScreenX(station);
    let y = this.toScreenY(station);
    if (x < 0 || x > width || y < 90 || y > this.mapBottom - 24 || this.isInReservedArea(x, y)) {
      return;
    }

    // The label's box: just right of the dot and slightly above it.
    if (station.tier === 3) {
      textStyle(BOLD);
    } else {
      textStyle(NORMAL);
    }
    let labelLeft = x + 7;
    let labelTop = y - 16;
    let labelWidth = textWidth(station.name) + 4;
    let labelHeight = 14;
    for (let other of drawnLabels) {
      let overlapsSideways = labelLeft < other.left + other.width && other.left < labelLeft + labelWidth;
      let overlapsUpDown = labelTop < other.top + other.height && other.top < labelTop + labelHeight;
      if (overlapsSideways && overlapsUpDown) {
        return;
      }
    }
    drawnLabels.push({ left: labelLeft, top: labelTop, width: labelWidth, height: labelHeight });

    // Station dot: bigger for the CBD hubs.
    fill(this.theme.palette.stationDot);
    stroke(this.theme.palette.stationOutline);
    strokeWeight(1.5);
    if (station.tier === 3) {
      circle(x, y, 10);
    } else {
      circle(x, y, 7);
    }

    // The name on its paper-coloured background.
    noStroke();
    let labelBackground = this.theme.palette.labelBackground;
    fill(labelBackground[0], labelBackground[1], labelBackground[2], labelBackground[3]);
    rect(labelLeft, labelTop, labelWidth, labelHeight, 3);
    fill(this.theme.palette.labelText);
    text(station.name, x + 9, y - 9);
  }

  // A small coloured "T1" style badge at each line end. In listening mode,
  // every badge except the selected line's fades back.
  drawLineBadges(selectedLineName) {
    push();
    rectMode(CENTER);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(11);
    noStroke();
    for (let badge of this.badges) {
      let badgeColour = color(this.theme.getLineColour(badge.lineName));
      let textColour = color(this.theme.palette.badgeText);
      if (selectedLineName !== null && selectedLineName !== badge.lineName) {
        badgeColour.setAlpha(75);
        textColour.setAlpha(75);
      }
      fill(badgeColour);
      rect(badge.x, badge.y, 26, 18, 4);
      fill(textColour);
      text(badge.lineName, badge.x, badge.y + 1);
    }
    pop();
  }
}
