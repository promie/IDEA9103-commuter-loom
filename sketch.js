// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data, creates one
// object for each part of the artwork, and calls them every frame. The
// actual work happens in the classes:
//   utils/      ColourTheme, TripData, RailNetwork + TrackPath
//   mechanics/  LineStream + Grain (Perlin noise and randomness),
//               InputControls (user input)

// Monthly Opal trips for each Sydney Trains line, made from the raw
// Transport for NSW data (data/train.csv) by script/clean_data.py.
const DATA_PATH = "data/monthly_line_trips_full.csv";
// The Sydney Trains lines. Their colours live in utils/colour-theme.js.
const LINE_NAMES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"];

// Loaded in preload().
let tripTable;

// The objects that make up the artwork, created in setup().
let theme;
let tripData;
let railNetwork;
let inputControls;
// One stream of grains per line (mechanics/perlin-flow.js).
let lineStreams = [];

// Fallback: set to true to draw the old solid tracks instead of the grains.
const SHOW_SOLID_TRACKS = false;

// Heavy files are loaded before setup() runs, so they are ready to use.
function preload() {
  tripTable = loadTable(DATA_PATH, "csv", "header");
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // The dark theme is the default. getURLParams() reads the page address,
  // so ...index.html?theme=light starts in the light theme.
  theme = new ColourTheme(getURLParams().theme);

  tripData = new TripData(tripTable, LINE_NAMES);
  railNetwork = new RailNetwork(STATIONS, LINE_ROUTES, LANE_ORDER, theme);
  fitMap();

  for (let lineName of LINE_NAMES) {
    lineStreams.push(new LineStream(lineName));
  }
  fillStreams();

  inputControls = new InputControls(railNetwork);

  // Buttons respond to a mouse press, or to a finger lifting on a touch
  // screen.
  theme.button.mousePressed(toggleTheme);
  theme.button.touchEnded(toggleTheme);
  positionControls();
}

function draw() {
  background(theme.getBackground(255));
  railNetwork.drawTrackGuides();
  if (SHOW_SOLID_TRACKS) {
    drawTracks(inputControls.selectedLineName);
  } else {
    drawStreams(inputControls.selectedLineName);
  }

  // Labels on top. In listening mode, the other lines' badges fade back.
  railNetwork.drawStationLabels();
  railNetwork.drawLineBadges(inputControls.selectedLineName);
}

// Space along the bottom of the window for the controls.
const CONTROLS_HEIGHT = 76;

// Builds the map's tracks to fill the window, above the controls.
function fitMap() {
  railNetwork.mapBottom = height - CONTROLS_HEIGHT;
  railNetwork.build();
}

// Temporary: puts the theme switch at the bottom left, under the map.
// The interface overlay will lay out all the controls later.
function positionControls() {
  theme.button.position(28, height - CONTROLS_HEIGHT + 16);
}

// Button callback. p5's mousePressed() on a button needs a plain
// function, so this passes the click on to the theme.
function toggleTheme() {
  theme.toggle();
}

// Gives every line's stream its grains, on the tracks just built.
function fillStreams() {
  for (let stream of lineStreams) {
    stream.fillWithGrains(railNetwork.getPathsFor(stream.lineName), railNetwork.gridUnit);
  }
}

// Moves and draws every line's grains. In listening mode the selected
// line is drawn last (on top) and the others fade back, as the solid
// tracks below did.
function drawStreams(selectedLineName) {
  let selectedStream = null;
  for (let stream of lineStreams) {
    stream.update();
    if (stream.lineName === selectedLineName) {
      selectedStream = stream;
    } else {
      let lineColour = color(theme.getLineColour(stream.lineName));
      if (selectedLineName !== null) {
        lineColour.setAlpha(60);
      }
      stream.draw(lineColour);
    }
  }
  if (selectedStream !== null) {
    selectedStream.draw(color(theme.getLineColour(selectedStream.lineName)));
  }
}

// Fallback (see SHOW_SOLID_TRACKS): each track drawn as a solid line in
// its line's colour, thicker for busier lines. The grain streams in
// drawStreams() replace it.
// In listening mode the selected line is drawn last (on top) and the
// others fade back.
function drawTracks(selectedLineName) {
  noFill();
  for (let lineName of LINE_NAMES) {
    if (lineName !== selectedLineName) {
      let lineColour = color(theme.getLineColour(lineName));
      if (selectedLineName !== null) {
        lineColour.setAlpha(60);
      }
      drawLineTracks(lineName, lineColour);
    }
  }
  if (selectedLineName !== null) {
    drawLineTracks(selectedLineName, color(theme.getLineColour(selectedLineName)));
  }
}

function drawLineTracks(lineName, lineColour) {
  stroke(lineColour);
  strokeWeight(map(tripData.getLineVolume(lineName), 0, 1, 1.5, 4));
  for (let path of railNetwork.getPathsFor(lineName)) {
    beginShape();
    for (let point of path.points) {
      vertex(point.x, point.y);
    }
    endShape();
  }
}

// p5 event functions: each one hands the event to the input mechanic.
function mouseMoved() {
  inputControls.handleMouseMoved();
}

function mousePressed() {
  inputControls.handleMousePressed();
}

function mouseReleased() {
  inputControls.handleMouseReleased();
}

// Touch screens. Returning false stops the browser from also sending
// pretend mouse events afterwards (which would count every tap twice) and
// from scrolling or zooming the page while you touch the artwork.
function touchStarted() {
  inputControls.handleMousePressed();
  return false;
}

function touchEnded() {
  inputControls.handleMouseReleased();
  return false;
}

function keyPressed() {
  // D switches between the light and dark themes.
  if (key === "d" || key === "D") {
    theme.toggle();
  }
  inputControls.handleKeyPressed();
}

// Keep the artwork filling the window: rebuild the tracks for the new size,
// refill each line with grains on the new tracks, and move the controls to
// the new bottom edge.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitMap();
  fillStreams();
  positionControls();
}
