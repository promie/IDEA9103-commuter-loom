// sketch.js
// Commuter Loom: collective movement memory, woven from monthly Sydney
// train trips.
//
// This file brings everything together. It loads the data, creates one
// object for each part of the artwork, and calls them every frame. The
// actual work happens in the classes:
//   utils/      ColourTheme, TripData, RailNetwork + TrackPath, and the
//               interface: PageHeader, Timeline, DataPanel,
//               PlaybackControls
//   utils/      FabricBreath (the network breathing with the data)
//   mechanics/  LineStream + Grain + FabricPress (Perlin noise and
//               randomness), InputControls (user input), AudioReactive
//               (audio)

// Monthly Opal trips for each Sydney Trains line, made from the raw
// Transport for NSW data (data/train.csv) by script/clean_data.py.
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
let inputControls;
// One stream of grains per line, and the dent the pointer presses into
// them (mechanics/perlin-flow.js).
let lineStreams = [];
let fabricPress;
// The interface around the artwork.
let pageHeader;
let timeline;
let dataPanel;
let playbackControls;
// The city sound, and the breathing it deepens.
let audioReactive;
let fabricBreath;

// Whether the mouse (or finger) went down on the interface rather than the
// map, and the timeline or data panel chart being dragged, or null.
let pressedOnInterface = false;
let monthPicker = null;

// Whether the pointer is on the canvas: a mouse over it, or a finger
// touching it. Touch screens have no hover, so a lifted finger stops
// pressing.
let pointerOnCanvas = false;

// Fallback: set to true to draw the old solid tracks instead of the grains.
const SHOW_SOLID_TRACKS = false;

// The month the artwork shows. The timeline, the data panel's chart, the
// play button and the arrow keys all change it through setMonth().
// It starts on the latest month in the data. To start on another month
// while testing, put its number here instead of null: 0 = July 2016,
// 1 = August 2016, ... 45 = April 2020, ... 121 = August 2026.
const START_MONTH_INDEX = null;
let monthIndex = 0;

// Heavy files are loaded before setup() runs, so they are ready to use.
function preload() {
  tripTable = loadTable(DATA_PATH, "csv", "header");
  rumbleSound = loadSound(RUMBLE_PATH);
  humSound = loadSound(HUM_PATH);
  tapsSound = loadSound(TAPS_PATH);
  flipSound = loadSound(FLIP_PATH);
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.mouseOut(handlePointerLeft);

  // The dark theme is the default. getURLParams() reads the page address,
  // so ...index.html?theme=light starts in the light theme.
  theme = new ColourTheme(getURLParams().theme);

  tripData = new TripData(tripTable, LINE_NAMES);
  railNetwork = new RailNetwork(STATIONS, LINE_ROUTES, LANE_ORDER, theme);
  timeline = new Timeline(tripData, LINE_NAMES);
  dataPanel = new DataPanel(tripData);
  fitMap();

  if (START_MONTH_INDEX === null) {
    setMonth(tripData.getMonthCount() - 1);
  } else {
    setMonth(START_MONTH_INDEX);
  }

  for (let lineName of LINE_NAMES) {
    lineStreams.push(new LineStream(lineName, tripData));
  }
  fillStreams();
  fabricPress = new FabricPress();

  inputControls = new InputControls(railNetwork);
  playbackControls = new PlaybackControls();
  pageHeader = new PageHeader(tripData, OFFICIAL_LINE_COLOURS);

  fabricBreath = new FabricBreath();
  audioReactive = new AudioReactive(rumbleSound, humSound, tapsSound, flipSound);
  // Sound is on by default: start the layers now. The browser lets them be
  // heard from the visitor's first click, tap or key press.
  audioReactive.start(pageHeader);

  // Buttons respond to a mouse press, or to a finger lifting on a touch
  // screen.
  theme.button.mousePressed(toggleTheme);
  theme.button.touchEnded(toggleTheme);
  playbackControls.playButton.mousePressed(togglePlayback);
  playbackControls.playButton.touchEnded(togglePlayback);
  audioReactive.button.mousePressed(toggleAudio);
  audioReactive.button.touchEnded(toggleAudio);
  positionControls();
}

function draw() {
  if (playbackControls.update()) {
    stepPlayback();
  }

  // The sound follows the month's data, and the network breathes with the
  // data, deepened by how loud the sound is.
  audioReactive.update();
  fabricBreath.update(tripData.getNetworkRatio(monthIndex), audioReactive.getLevel());
  audioReactive.followData(fabricBreath.getBusyness());

  background(theme.getBackground(255));
  railNetwork.drawTrackGuides();
  // The pointer presses into the threads while it is over the map (not
  // the timeline or the data panel), and presses deeper while the mouse
  // button or a finger is held down.
  let pointerOverMap = pointerOnCanvas && monthPicker === null && !isOverInterface(mouseX, mouseY);
  fabricPress.update(mouseX, mouseY, pointerOverMap, mouseIsPressed && !pressedOnInterface);
  if (SHOW_SOLID_TRACKS) {
    drawTracks(inputControls.selectedLineName);
  } else {
    drawStreams(inputControls.selectedLineName);
  }

  // Labels on top. In listening mode, the other lines' badges fade back.
  railNetwork.drawStationLabels();
  railNetwork.drawLineBadges(inputControls.selectedLineName);

  drawDock();
  dataPanel.draw(theme, monthIndex);
}

// The control dock along the bottom: the buttons on the left (HTML, see
// positionControls()) and the timeline. Narrow screens stack the timeline
// above the buttons.
const DOCK_HEIGHT = 72;
const NARROW_DOCK_HEIGHT = 124;
const NARROW_SCREEN_WIDTH = 640;
// Room at the top for the title. The map is fitted below it.
const HEADER_HEIGHT = 64;
const NARROW_HEADER_HEIGHT = 96;
// The sound button, play button and theme switch side by side.
const BUTTON_ROW_LEFT = 20;
const BUTTON_ROW_WIDTH = 188;

// Lays out the map, the timeline and the data panel to fill the window.
function fitMap() {
  let isNarrow = width < NARROW_SCREEN_WIDTH;
  let dockTop = height - DOCK_HEIGHT;
  railNetwork.mapTop = HEADER_HEIGHT;
  railNetwork.mapBottom = dockTop;

  let panelWidth = 200;
  let panelLeft = width - panelWidth - 20;
  let panelTop = 0;
  if (isNarrow) {
    // Narrow screens: the map has no room to spare, so the panel becomes a
    // strip across the bottom, above the timeline, and the map (with the
    // title above it taking more lines) is fitted above both.
    dockTop = height - NARROW_DOCK_HEIGHT;
    panelWidth = width - 24;
    panelLeft = 12;
    dataPanel.setArea(0, 0, panelWidth, true);
    panelTop = dockTop - dataPanel.getHeight() - 8;
    railNetwork.mapTop = NARROW_HEADER_HEIGHT;
    railNetwork.mapBottom = panelTop - 8;
    timeline.setArea(20, dockTop + 6, width - 20, dockTop + 64);
  } else {
    // The data panel sits at the bottom right, above the dock. On tall
    // screens the map's southern lines run down the right, so it moves to
    // the top right instead, under the header.
    dataPanel.setArea(0, 0, panelWidth, false);
    panelTop = dockTop - dataPanel.getHeight() - 12;
    if (height > width) {
      panelTop = HEADER_HEIGHT + 40;
    }
    timeline.setArea(BUTTON_ROW_LEFT + BUTTON_ROW_WIDTH + 28, dockTop + 8, width - 24, height - 6);
  }
  dataPanel.setArea(panelLeft, panelTop, panelWidth, isNarrow);
  railNetwork.reservedArea = {
    left: panelLeft,
    top: panelTop,
    right: panelLeft + panelWidth,
    bottom: panelTop + dataPanel.getHeight(),
  };

  railNetwork.build();
}

// Puts the sound button, play button and theme switch in a row at the
// bottom left, level with the timeline's bars (or under the timeline on
// narrow screens).
function positionControls() {
  let rowMiddle = railNetwork.mapBottom + 38;
  if (width < NARROW_SCREEN_WIDTH) {
    rowMiddle = height - 30;
  }
  audioReactive.button.position(BUTTON_ROW_LEFT, rowMiddle - 20);
  playbackControls.playButton.position(BUTTON_ROW_LEFT + 50, rowMiddle - 24);
  theme.button.position(BUTTON_ROW_LEFT + 108, rowMiddle - 22);
}

// The dock's background (covering anything pressed over the map's bottom
// edge), a thin line along its top, and the timeline. On narrow screens
// the dock starts at the data panel strip.
function drawDock() {
  let dockTop = railNetwork.mapBottom;
  noStroke();
  fill(theme.getBackground(255));
  rect(0, dockTop, width, height - dockTop);
  stroke(theme.getTextColour(45));
  strokeWeight(1);
  line(0, dockTop + 0.5, width, dockTop + 0.5);
  timeline.draw(theme, monthIndex);
}

// Button callbacks. p5's mousePressed() on a button needs a plain
// function, so these pass the click on.
function toggleTheme() {
  theme.toggle();
}

function toggleAudio() {
  audioReactive.toggleMute(pageHeader);
}

// Play from where the artwork is. At the last month, play starts again
// from the first.
function togglePlayback() {
  if (playbackControls.isPlaying) {
    setPlaying(false);
  } else {
    if (monthIndex === tripData.getMonthCount() - 1) {
      setMonth(0);
    }
    setPlaying(true);
  }
}

function setPlaying(isPlaying) {
  playbackControls.setPlaying(isPlaying);
  pageHeader.showPlaying(isPlaying);
}

// While playing: on to the next month, stopping after the last one.
function stepPlayback() {
  if (monthIndex < tripData.getMonthCount() - 1) {
    setMonth(monthIndex + 1);
  } else {
    setPlaying(false);
  }
}

// Shows a month. The streams ease to its density in drawStreams(), and the
// timeline and data panel read monthIndex when they draw.
// A new month also plays the departure-board "clack".
function setMonth(newMonthIndex) {
  let previousMonthIndex = monthIndex;
  monthIndex = constrain(newMonthIndex, 0, tripData.getMonthCount() - 1);
  if (monthIndex !== previousMonthIndex && audioReactive !== undefined) {
    audioReactive.playFlip();
  }
}

// Back to the first month, paused.
function restart() {
  setPlaying(false);
  setMonth(0);
}

// The dock along the bottom and the data panel are the interface. The
// rest of the window is the map.
function isOverInterface(x, y) {
  return y >= railNetwork.mapBottom || dataPanel.contains(x, y);
}

// The timeline or data panel chart under a point, or null.
function findMonthPicker(x, y) {
  if (timeline.contains(x, y)) {
    return timeline;
  }
  if (dataPanel.chartContains(x, y)) {
    return dataPanel;
  }
  return null;
}

// A press on the timeline or chart pauses playing and jumps to the month
// under the pointer. Dragging keeps choosing.
function startPickingMonth() {
  monthPicker = findMonthPicker(mouseX, mouseY);
  if (monthPicker !== null) {
    setPlaying(false);
    setMonth(monthPicker.getMonthAt(mouseX));
  }
}

// Gives every line's stream its grains, on the tracks just built.
function fillStreams() {
  for (let stream of lineStreams) {
    stream.fillWithGrains(railNetwork.getPathsFor(stream.lineName), railNetwork.gridUnit);
  }
}

// Moves and draws every line's grains, with the density, speed and
// brightness of the month shown, pressed by the pointer. In listening mode
// the selected line is drawn last (on top) and the others fade back, as
// the solid tracks below did.
function drawStreams(selectedLineName) {
  let selectedStream = null;
  for (let stream of lineStreams) {
    stream.setMonth(monthIndex);
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

// p5 event functions: presses on the interface (the dock and the data
// panel) go to the timeline and chart; everything else is handed to the
// input mechanic. Each also notes whether the pointer is on the canvas
// (for the fabric press).
function mouseMoved() {
  pointerOnCanvas = true;
  if (isOverInterface(mouseX, mouseY)) {
    if (findMonthPicker(mouseX, mouseY) !== null) {
      cursor(HAND);
    } else {
      cursor(ARROW);
    }
    return;
  }
  inputControls.handleMouseMoved();
}

function mousePressed() {
  pointerOnCanvas = true;
  pressedOnInterface = isOverInterface(mouseX, mouseY);
  if (pressedOnInterface) {
    startPickingMonth();
    return;
  }
  inputControls.handleMousePressed();
}

function mouseDragged() {
  if (monthPicker !== null) {
    setMonth(monthPicker.getMonthAt(mouseX));
  }
}

// Canvas callback: the mouse has left the canvas, so the press lifts.
function handlePointerLeft() {
  pointerOnCanvas = false;
}

function mouseReleased() {
  if (pressedOnInterface) {
    pressedOnInterface = false;
    monthPicker = null;
    return;
  }
  inputControls.handleMouseReleased();
}

// Touch screens. Returning false stops the browser from also sending
// pretend mouse events afterwards (which would count every tap twice) and
// from scrolling or zooming the page while you touch the artwork.
function touchStarted() {
  mousePressed();
  return false;
}

function touchMoved() {
  mouseDragged();
  return false;
}

function touchEnded() {
  pointerOnCanvas = false;
  mouseReleased();
  return false;
}

function keyPressed() {
  // D switches between the light and dark themes.
  if (key === "d" || key === "D") {
    theme.toggle();
  }
  // R leaves listening mode (in the input mechanic) and restarts the
  // timeline from the first month.
  inputControls.handleKeyPressed();
  if (key === "r" || key === "R") {
    restart();
  }

  // The arrow keys step one month back or forward, and space plays or
  // pauses. Returning false stops the browser using these keys too (for
  // scrolling, or pressing a focused button).
  if (keyCode === LEFT_ARROW) {
    setPlaying(false);
    setMonth(monthIndex - 1);
    return false;
  }
  if (keyCode === RIGHT_ARROW) {
    setPlaying(false);
    setMonth(monthIndex + 1);
    return false;
  }
  if (key === " ") {
    togglePlayback();
    return false;
  }
}

// Keep the artwork filling the window: lay out the map, timeline and data
// panel for the new size, refill each line with grains on the new tracks,
// and move the buttons to the new bottom edge. The playhead stays on the
// same month.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitMap();
  fillStreams();
  positionControls();
}
