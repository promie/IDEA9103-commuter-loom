// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data, creates one
// object for each part of the artwork, and calls them every frame. The
// actual work happens in the classes:
//   utils/  ColourTheme, TripData

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
  drawLineColours();
}

// Temporary: one stripe per line, thicker for busier lines, to check the
// colours and the data together. Replaced by the rail map later.
function drawLineColours() {
  let gap = height / (LINE_NAMES.length + 1);
  for (let i = 0; i < LINE_NAMES.length; i++) {
    let lineName = LINE_NAMES[i];
    let y = gap * (i + 1);
    stroke(theme.getLineColour(lineName));
    strokeWeight(map(tripData.getLineVolume(lineName), 0, 1, 2, 16));
    line(width * 0.2, y, width * 0.8, y);

    noStroke();
    fill(theme.palette.text);
    textAlign(RIGHT, CENTER);
    text(lineName, width * 0.2 - 16, y);
  }
}

// Keep the canvas filling the browser window when it is resized.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
