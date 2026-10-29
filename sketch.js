// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data and sound,
// creates one object for each part of the artwork, and calls them in order
// every frame. The actual work happens in the classes:
//   utils/      TripData, RailNetwork + TrackPath, Timeline, FabricBreath,
//               DataPanel, InterfaceOverlay
//   mechanics/  LineStream + Grain + FabricPress (Perlin noise and
//               randomness), InputControls (user input), AudioReactive
//               (audio)
//
// AI acknowledgement: the structure of this project was planned with the
// help of Claude (Anthropic). See README.md for details.

const DATA_PATH = "data/monthly_line_trips_full.csv";
// The three layers of the city sound (see mechanics/audio-reactive.js).
const RUMBLE_PATH = "assets/city-rumble.wav";
const HUM_PATH = "assets/city-hum.wav";
const TAPS_PATH = "assets/city-taps.wav";
// The "clack" played each time a new month flips over.
const FLIP_PATH = "assets/city-flip.wav";
// The Sydney Trains lines. Their colours live in utils/colour-theme.js.
const LINE_NAMES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"];

// Loaded in preload().
let tripTable;
let rumbleSound;
let humSound;
let tapsSound;
let flipSound;

// The objects that make up the artwork, created in setup().
let theme;
let tripData;
let railNetwork;
let timeline;
let fabricBreath;
let dataPanel;
let overlay;
let inputControls;
let audioReactive;
let lineStreams = [];
// The dent the pointer presses into the grains (mechanics/perlin-flow.js).
let fabricPress;

// The month shown last frame, to notice when a new month flips over.
let lastMonthShown = -1;

// Heavy files are loaded before setup() runs, so they are ready to use.
function preload() {
  tripTable = loadTable(DATA_PATH, "csv", "header");
  rumbleSound = loadSound(RUMBLE_PATH);
  humSound = loadSound(HUM_PATH);
  tapsSound = loadSound(TAPS_PATH);
  flipSound = loadSound(FLIP_PATH);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  // Raleway is loaded by style.css from assets/fonts.
  textFont("Raleway");

  // The dark theme is the default. getURLParams() reads the page address,
  // so ...index.html?theme=light starts in the light theme.
  theme = new ColourTheme(getURLParams().theme);

  tripData = new TripData(tripTable, LINE_NAMES);
  overlay = new InterfaceOverlay(theme);
  timeline = new Timeline(tripData, theme);
  fabricBreath = new FabricBreath();
  dataPanel = new DataPanel(tripData, theme);
  railNetwork = new RailNetwork(STATIONS, LINE_ROUTES, LANE_ORDER, theme);
  // Keep line badges and station names out from under the data panel.
  fitMapAndPanel();

  for (let lineName of LINE_NAMES) {
    lineStreams.push(new LineStream(lineName, tripData));
  }
  fillStreams();
  fabricPress = new FabricPress();

  audioReactive = new AudioReactive(rumbleSound, humSound, tapsSound, flipSound);
  // Sound is on by default: start the layers now. The browser lets them be
  // heard from the visitor's first click, tap or key press.
  audioReactive.start(overlay);
  inputControls = new InputControls(railNetwork, timeline, overlay);

  // Buttons respond to a mouse press, or to a finger lifting on a touch
  // screen (browsers only allow sound to start when the finger lifts).
  audioReactive.button.mousePressed(toggleAudio);
  audioReactive.button.touchEnded(toggleAudio);
  timeline.playButton.mousePressed(toggleTimePlayback);
  timeline.playButton.touchEnded(toggleTimePlayback);
  theme.button.mousePressed(toggleTheme);
  theme.button.touchEnded(toggleTheme);
  layoutInterface();

  overlay.setStatus("Tap or click anywhere to hear the network · touch the threads · drag a line to pull it · tap a line to listen");
}

function draw() {
  background(theme.getBackground(255));

  // 1. Update the mechanics that every grain reads from. The month's data
  // sets the sound and the breathing; the sound's loudness deepens the
  // breathing too.
  timeline.update();
  // A new month: play the departure-board "clack".
  if (timeline.monthIndex !== lastMonthShown) {
    if (lastMonthShown !== -1) {
      audioReactive.playFlip();
    }
    lastMonthShown = timeline.monthIndex;
  }
  audioReactive.update();
  fabricBreath.update(tripData.getNetworkRatio(timeline.monthIndex), audioReactive.getLevel());
  audioReactive.followData(fabricBreath.getBusyness());
  dataPanel.update(timeline.monthIndex, inputControls.selectedLineName, fabricBreath);
  inputControls.update();
  fabricPress.update(mouseX, mouseY, inputControls.handIsActive, inputControls.handIsGathering);

  // 2. Move and draw the grains, line by line.
  // Everything on the map is clipped to the map's area (above the control
  // dock, and above the data card on phones), so the train lines end
  // exactly there and nothing shows behind the controls. beginClip() and
  // endClip() (p5.js 1.8) make a window: only drawing inside the rectangle
  // appears, until pop().
  push();
  beginClip();
  rect(0, 0, width, railNetwork.mapBottom);
  endClip();

  railNetwork.drawTrackGuides();
  drawStreams(inputControls.selectedLineName);
  pop();

  // 3. Labels and interface on top.
  overlay.drawFades();
  railNetwork.drawStationLabels();
  railNetwork.drawLineBadges(inputControls.selectedLineName);
  overlay.drawHeader(tripData, timeline.monthIndex, inputControls.selectedLineName, fabricBreath, dataPanel);
  dataPanel.draw(timeline.monthIndex, inputControls.selectedLineName, fabricBreath, timeline.pulse);

  // 4. The control dock along the bottom: its background, the woven
  // timeline and the status message. (The buttons are HTML on top of it.)
  // The timeline shows a hover preview for a mouse (not touch), and the
  // current month's card while it is being dragged.
  overlay.drawDock();
  timeline.draw(!inputControls.usingTouch, inputControls.isScrubbingTimeline);
  overlay.drawFooter();
}

// Gives every line's stream its grains, on the tracks just built.
function fillStreams() {
  for (let stream of lineStreams) {
    stream.fillWithGrains(railNetwork.getPathsFor(stream.lineName), railNetwork.gridUnit);
  }
}

// Moves and draws every line's grains, with the density, speed and
// brightness of the month shown, pressed by the pointer. In listening mode
// the selected line is drawn last (on top) and the others fade back.
function drawStreams(selectedLineName) {
  let selectedStream = null;
  for (let stream of lineStreams) {
    stream.setMonth(timeline.monthIndex);
    stream.update();
    if (stream.lineName === selectedLineName) {
      selectedStream = stream;
    } else {
      let lineColour = color(theme.getLineColour(stream.lineName));
      if (selectedLineName !== null) {
        lineColour.setAlpha(60);
      }
      stream.draw(lineColour, fabricPress);
    }
  }
  if (selectedStream !== null) {
    selectedStream.draw(color(theme.getLineColour(selectedStream.lineName)), fabricPress);
  }
}

// Button callbacks. p5's mousePressed() on a button needs a plain function,
// so these pass the click on to the right object.
function toggleAudio() {
  audioReactive.toggleMute(overlay);
}

function toggleTimePlayback() {
  timeline.togglePlaying();
}

// Builds the map's tracks, keeping line badges and station names out from
// under the data panel.
function fitMapAndPanel() {
  // The data panel sits just above the control dock, and the map fills the
  // space above that (the full panel only takes a corner; the phone card
  // takes the whole width).
  dataPanel.setDockTop(overlay.getDockTop());
  railNetwork.mapBottom = dataPanel.getMapBottom();
  railNetwork.reservedArea = dataPanel.getArea();
  railNetwork.build();
}

function toggleTheme() {
  theme.toggle();
}

// Fits the buttons and timeline to the window (compact on phones).
function layoutInterface() {
  overlay.positionButtons(audioReactive.button, timeline.playButton, theme.button);
  if (overlay.isSlimDock()) {
    // One-row dock: the woven strip starts just right of the buttons.
    timeline.resize(overlay.isCompact(), overlay.getTimelineBaseY(), overlay.buttonArea.right + 28, overlay.getSlimStripHeight());
  } else {
    timeline.resize(overlay.isCompact(), overlay.getTimelineBaseY());
  }
}

// p5 event functions: each one hands the event to the input mechanic.
// Returning false stops the browser's default behaviour (e.g. text
// selection while dragging, or the page scrolling when space is pressed).
function mouseMoved() {
  inputControls.handleMouseMoved();
}

function mousePressed() {
  inputControls.handleMousePressed();
}

function mouseDragged() {
  inputControls.handleMouseDragged();
  return false;
}

function mouseReleased() {
  inputControls.handleMouseReleased();
}

// Touch screens. Returning false stops the browser from also sending
// pretend mouse events afterwards (which would count every tap twice) and
// from scrolling or zooming the page while you drag on the artwork.
function touchStarted() {
  inputControls.handleTouchStarted();
  return false;
}

function touchMoved() {
  inputControls.handleMouseDragged();
  return false;
}

function touchEnded() {
  inputControls.handleMouseReleased();
  return false;
}

// The scroll wheel steps through the months. event.delta is how far the
// wheel moved. Returning false stops the page itself from scrolling.
function mouseWheel(event) {
  inputControls.handleMouseWheel(event.delta);
  return false;
}

function keyPressed() {
  // D switches between the light and dark themes.
  if (key === "d" || key === "D") {
    theme.toggle();
  }
  inputControls.handleKeyPressed();
  if (key === " " || keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
    return false;
  }
}

// Keep the artwork filling the window: rebuild the tracks for the new size
// and refill each line with grains to match the new track lengths.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitMapAndPanel();
  fillStreams();
  layoutInterface();
}
