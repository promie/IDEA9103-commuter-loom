// rail-network.js
// The RailNetwork class turns the grid layout in network-layout.js into
// screen-space tracks (TrackPath objects) for every line, fitted to the
// window. Where several lines share a stretch of track it places them side
// by side as a parallel bundle, the way the official network map does.
// It also draws faint track guides under the particles.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic). The corner rounding uses Chaikin's corner-cutting algorithm
// (see smoothCorners() below for the reference).

// Spacing between neighbouring lines in a bundle, in grid units.
const LANE_GAP_UNITS = 0.72;

// How far before a station a bend or lane change starts, in grid units.
const CORNER_INSET_UNITS = 0.7;

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

    // The area the map is fitted into, from the top of the screen to the
    // bottom (set from sketch.js).
    this.mapTop = 40;
    this.mapBottom = 600;
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
    for (let route of this.lineRoutes) {
      // Lines with two branches give each branch a share of the particles,
      // so the shared trunk carries the most.
      let particleShare = 1 / sqrt(route.branches.length);
      let branchPaths = [];
      for (let branchIndex = 0; branchIndex < route.branches.length; branchIndex++) {
        let stopIds = route.branches[branchIndex];
        let path = this.buildTrackPath(route.lineName, branchIndex, stopIds, particleShare);
        branchPaths.push(path);
      }
      this.paths[route.lineName] = branchPaths;
    }
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

  drawTrackGuides() {
    for (let route of this.lineRoutes) {
      for (let path of this.paths[route.lineName]) {
        path.drawGuide(this.theme.palette.trackGuide);
      }
    }
  }
}
