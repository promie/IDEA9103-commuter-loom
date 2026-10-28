// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data, creates one
// object for each part of the artwork, and calls them every frame. The
// actual work happens in the classes:
//   utils/  ColourTheme, TripData, network-layout (map data)

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
}

function draw() {
  background(theme.getBackground(255));
  drawSimpleMap();
}

// Temporary: a first look at the network layout. Each branch is drawn as a
// plain line through its stations (lines that share track overlap for
// now), thicker for busier lines. Replaced by RailNetwork later.
function drawSimpleMap() {
  // One grid unit in pixels, as big as possible while the map view still
  // fits the window. The view is centred on the screen.
  let gridUnit = min(width / (MAP_VIEW_RIGHT - MAP_VIEW_LEFT), height / (MAP_VIEW_BOTTOM - MAP_VIEW_TOP));
  let originX = width / 2 - ((MAP_VIEW_LEFT + MAP_VIEW_RIGHT) / 2) * gridUnit;
  let originY = height / 2 - ((MAP_VIEW_TOP + MAP_VIEW_BOTTOM) / 2) * gridUnit;

  // Look up stations by id, e.g. stationsById["CEN"] is Central.
  let stationsById = {};
  for (let station of STATIONS) {
    stationsById[station.id] = station;
  }

  noFill();
  for (let route of LINE_ROUTES) {
    stroke(theme.getLineColour(route.lineName));
    strokeWeight(map(tripData.getLineVolume(route.lineName), 0, 1, 2, 6));
    for (let branch of route.branches) {
      beginShape();
      for (let stationId of branch) {
        let station = stationsById[stationId];
        vertex(originX + station.x * gridUnit, originY + station.y * gridUnit);
      }
      endShape();
    }
  }

  // Named stations as dots, bigger for busier tiers.
  stroke(theme.palette.stationOutline);
  strokeWeight(1.5);
  fill(theme.palette.stationDot);
  for (let station of STATIONS) {
    if (station.name !== "") {
      circle(originX + station.x * gridUnit, originY + station.y * gridUnit, 4 + station.tier * 2);
    }
  }
}

// Keep the canvas filling the browser window when it is resized.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
