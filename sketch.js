// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together.

// Monthly Opal trips for each Sydney Trains line, made from the raw
// Transport for NSW data (data/train.csv) by script/clean_data.py.
const DATA_PATH = "data/monthly_line_trips_full.csv";

// Loaded in preload().
let tripTable;

// Heavy files are loaded before setup() runs, so they are ready to use.
function preload() {
  tripTable = loadTable(DATA_PATH, "csv", "header");
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  // A quick check that the data loaded: one row per month and line.
  console.log("Loaded " + tripTable.getRowCount() + " rows of trip data");
}

function draw() {
  background("#0e111a");
}

// Keep the canvas filling the browser window when it is resized.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
