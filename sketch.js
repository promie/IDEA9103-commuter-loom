// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data, creates one
// object for each part of the artwork, and calls them every frame. The
// actual work happens in the classes:
//   utils/  TripData

// Monthly Opal trips for each Sydney Trains line, made from the raw
// Transport for NSW data (data/train.csv) by script/clean_data.py.
const DATA_PATH = "data/monthly_line_trips_full.csv";
// The Sydney Trains lines.
const LINE_NAMES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"];

// Loaded in preload().
let tripTable;

// The objects that make up the artwork, created in setup().
let tripData;

// Heavy files are loaded before setup() runs, so they are ready to use.
function preload() {
  tripTable = loadTable(DATA_PATH, "csv", "header");
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  tripData = new TripData(tripTable, LINE_NAMES);

  // A quick check that the data reads correctly.
  console.log("Months of data: " + tripData.getMonthCount());
  console.log("T1 volume (0-1): " + nf(tripData.getLineVolume("T1"), 1, 2));
  console.log("Network in the first month vs normal: " + nf(tripData.getNetworkRatio(0), 1, 2));
}

function draw() {
  background("#0e111a");
}

// Keep the canvas filling the browser window when it is resized.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
