// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data, creates one
// object for each part of the artwork, and calls them every frame. The
// actual work happens in the classes:
//   utils/      ColourTheme, TripData, RailNetwork + TrackPath
//   mechanics/  InputControls (user input)

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

  inputControls = new InputControls(railNetwork);
}

function draw() {
  background(theme.getBackground(255));
  railNetwork.drawTrackGuides();
  drawTracks(inputControls.selectedLineName);

  // Labels on top. In listening mode, the other lines' badges fade back.
  railNetwork.drawStationLabels();
  railNetwork.drawLineBadges(inputControls.selectedLineName);
}

// Builds the map's tracks to fill the window.
function fitMap() {
  railNetwork.mapBottom = height - 40;
  railNetwork.build();
}

// Temporary: each track drawn as a solid line in its line's colour,
// thicker for busier lines, to check the side-by-side bundles and the
// rounded corners. Replaced by the particle streams later.
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

function keyPressed() {
  inputControls.handleKeyPressed();
}

// Keep the artwork filling the window: rebuild the tracks for the new size.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitMap();
}
