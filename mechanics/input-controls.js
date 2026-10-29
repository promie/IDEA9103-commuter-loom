// input-controls.js  —  MECHANIC: User input (mouse and keyboard)
//
// The mouse is a hand touching the rail network like fabric:
//   - click a line:   listening mode, where that line comes forward and
//                     the rest of the network fades back
//   - drag the ruler: travel through time (this pauses the automatic playback)
//   - scroll wheel:   step through the months (also pausing playback)
// Keyboard: left/right arrows step a month (also pausing playback), space
// plays or pauses time, R resets and starts playing from July 2016.
//
// On touch screens there is no hover, so a quick tap on a line enters
// listening mode.
//
// p5's event functions (mousePressed(), touchStarted() etc.) live in
// sketch.js and call the matching handle...() method here.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// Presses shorter than this count as a click (listening mode); longer
// presses just gather the fabric.
const CLICK_MAX_MILLIS = 350;

// How much scroll-wheel movement steps one month.
const WHEEL_UNITS_PER_MONTH = 100;

class InputControls {
  constructor(railNetwork, timeline, overlay) {
    this.railNetwork = railNetwork;
    this.timeline = timeline;
    this.overlay = overlay;

    // The line in listening mode, e.g. "T4", or null for none.
    this.selectedLineName = null;

    // When the mouse was pressed, and the line under it (if any).
    this.pressMillis = 0;
    this.pressedLineName = null;

    this.isScrubbingTimeline = false;

    // Worked out once per frame in update(): whether the hand is over the
    // fabric, and whether it is pressing into it.
    this.handIsActive = false;
    this.handIsGathering = false;

    // True once the visitor uses a touch screen. A finger only touches the
    // fabric while it is down (unlike a mouse, which hovers).
    this.usingTouch = false;

    // Scroll-wheel movement not yet turned into a month step.
    this.wheelTotal = 0;
  }

  // Called once per frame, before the grains move.
  update() {
    let mouseOnCanvas = mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;
    let overRuler = this.timeline.isOverRuler(mouseX, mouseY);
    let fingerIsUp = this.usingTouch && !mouseIsPressed;
    // Below the map (the data card and the dock) is not part of the fabric.
    let overDock = mouseY > this.railNetwork.mapBottom;
    this.handIsActive = mouseOnCanvas && !overRuler && !overDock && !this.isScrubbingTimeline && !fingerIsUp;

    // A mouse gathers as soon as it is pressed. A finger is always pressed
    // when it touches, so it only gathers once it has been held for a moment;
    // before that it parts the threads like a hovering mouse.
    let heldLongEnough = !this.usingTouch || millis() - this.pressMillis > CLICK_MAX_MILLIS;
    this.handIsGathering = mouseIsPressed && heldLongEnough && !this.isScrubbingTimeline;
  }

  handleMouseMoved() {
    // mouseMoved() only fires for a real mouse, so the visitor is not (or no
    // longer) using touch.
    this.usingTouch = false;
    let hitPoint = null;
    if (mouseY < this.railNetwork.mapBottom) {
      hitPoint = this.railNetwork.findNearestHitPoint(mouseX, mouseY);
    }
    if (hitPoint !== null || this.timeline.isOverRuler(mouseX, mouseY)) {
      cursor(HAND);
    } else {
      cursor(ARROW);
    }
  }

  handleTouchStarted() {
    this.usingTouch = true;
    this.handleMousePressed();
  }

  handleMousePressed() {
    // Presses on the buttons belong to the buttons, not the map.
    this.pressedLineName = null;
    if (this.overlay.isOverButtons(mouseX, mouseY)) {
      return;
    }
    if (this.timeline.isOverRuler(mouseX, mouseY)) {
      this.isScrubbingTimeline = true;
      this.takeControlOfTime();
      this.timeline.handlePress(mouseX, mouseY);
      return;
    }
    // Below the map (the data card and the rest of the dock) is not part of
    // the fabric.
    if (mouseY > this.railNetwork.mapBottom) {
      return;
    }

    let hitPoint = this.railNetwork.findNearestHitPoint(mouseX, mouseY);
    if (hitPoint !== null) {
      this.pressedLineName = hitPoint.path.lineName;
    }
    this.pressMillis = millis();
  }

  handleMouseDragged() {
    if (this.isScrubbingTimeline) {
      this.timeline.setMonthFromX(mouseX);
    }
  }

  handleMouseReleased() {
    if (this.isScrubbingTimeline) {
      this.isScrubbingTimeline = false;
      return;
    }

    let wasClick = millis() - this.pressMillis < CLICK_MAX_MILLIS;
    if (this.pressedLineName !== null && wasClick) {
      this.toggleListening(this.pressedLineName);
    } else if (this.pressedLineName === null && wasClick && this.selectedLineName !== null) {
      // Clicking empty space leaves listening mode.
      this.toggleListening(this.selectedLineName);
    }

    this.pressedLineName = null;
  }

  // Clicking a line enters listening mode; clicking it again leaves.
  toggleListening(lineName) {
    if (this.selectedLineName === lineName) {
      this.selectedLineName = null;
      this.overlay.resetStatus();
    } else {
      this.selectedLineName = lineName;
      this.overlay.setStatus("Listening to " + lineName + ": the rest of the network quietens around it.");
    }
  }

  handleKeyPressed() {
    if (keyCode === LEFT_ARROW) {
      this.takeControlOfTime();
      this.timeline.stepMonth(-1);
    } else if (keyCode === RIGHT_ARROW) {
      this.takeControlOfTime();
      this.timeline.stepMonth(1);
    } else if (key === " ") {
      this.timeline.togglePlaying();
    } else if (key === "r" || key === "R") {
      this.selectedLineName = null;
      this.overlay.resetStatus();
      this.timeline.restart();
    }
  }

  // The scroll wheel steps through time: one month for each notch (about
  // 100 units of wheel movement on most mice; trackpads send smaller
  // amounts, so we add them up). Down is later, up is earlier.
  handleMouseWheel(wheelDelta) {
    this.wheelTotal += wheelDelta;
    let steps = int(this.wheelTotal / WHEEL_UNITS_PER_MONTH);
    if (steps !== 0) {
      this.takeControlOfTime();
      this.timeline.stepMonth(steps);
      this.wheelTotal -= steps * WHEEL_UNITS_PER_MONTH;
    }
  }

  // When the visitor scrubs the ruler or steps through months, they take
  // over from the automatic playback, so we pause it.
  takeControlOfTime() {
    if (this.timeline.isPlaying) {
      this.timeline.pause();
      this.overlay.setStatus("Time paused while you explore. Press space or the play button to carry on.");
    }
  }
}
