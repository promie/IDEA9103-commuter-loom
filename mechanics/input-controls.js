// input-controls.js  —  MECHANIC: User input (mouse and keyboard)
//
// The mouse is a hand touching the rail network like fabric:
//   - hover:          the flow speeds up around the hand, like stirring a
//                     current (the threads also part around the pointer:
//                     that dent is Wanghao's FabricPress in perlin-flow.js)
//   - press and hold: the grains gather into the hand (compression)
//   - drag a line:    pull that thread out of the network; let go and it
//                     springs back onto its track
//   - click a line:   listening mode, where that line comes forward and
//                     the rest of the network fades back
//   - drag the ruler: travel through time (this pauses the automatic playback)
//   - scroll wheel:   step through the months (also pausing playback)
// Keyboard: left/right arrows step a month (also pausing playback), space
// plays or pauses time, R resets and starts playing from July 2016.
//
// On touch screens there is no hover, so: dragging a finger parts the
// threads, holding it still gathers them, dragging a line pulls it, and a
// quick tap on a line enters listening mode.
//
// The grains ask this class how the hand moves them (getTouchAmount(),
// applyGather() and getPullWeight()), so all the hand's rules live here.
//
// p5's event functions (mousePressed(), touchStarted() etc.) live in
// sketch.js and call the matching handle...() method here.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// How far the hand reaches, in pixels.
const TOUCH_RADIUS = 120;

// How hard pressing pulls grains in towards the hand.
const GATHER_PULL = 1.4;

// How far you must drag before a press becomes a pull, in pixels.
const PULL_DRAG_THRESHOLD = 6;

// Presses shorter than this count as a click (listening mode); longer
// presses just gather the fabric.
const CLICK_MAX_MILLIS = 350;

// How far along the track a pull is felt, and the furthest it can stretch.
const PULL_REACH = 120;
const MAX_PULL = 200;

// How much scroll-wheel movement steps one month.
const WHEEL_UNITS_PER_MONTH = 100;

class InputControls {
  constructor(railNetwork, timeline, overlay) {
    this.railNetwork = railNetwork;
    this.timeline = timeline;
    this.overlay = overlay;

    // The line in listening mode, e.g. "T4", or null for none.
    this.selectedLineName = null;

    // Where and when the mouse was pressed, and the line under it (if any).
    this.pressX = 0;
    this.pressY = 0;
    this.pressMillis = 0;
    this.pressedLineName = null;

    this.isScrubbingTimeline = false;

    // While a line is being pulled: which line, how far the mouse has moved
    // since the press, and where along each branch it was grabbed.
    this.isPulling = false;
    this.pulledLineName = null;
    this.pullOffsetX = 0;
    this.pullOffsetY = 0;
    this.grabbedDistances = [];

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
    this.handIsGathering = mouseIsPressed && heldLongEnough && !this.isPulling && !this.isScrubbingTimeline;
  }

  // 0 (far from the hand) to 1 (right under it). Used to speed up the flow
  // near the hand, like stirring a current.
  getTouchAmount(x, y) {
    if (!this.handIsActive) {
      return 0;
    }
    let distanceToHand = dist(x, y, mouseX, mouseY);
    if (distanceToHand >= TOUCH_RADIUS) {
      return 0;
    }
    return 1 - distanceToHand / TOUCH_RADIUS;
  }

  // While the mouse is held, pulls a grain in towards the hand. trackX,
  // trackY is where the grain sits on its track this frame; its offsetX/Y
  // is how far the hand has already moved it.
  applyGather(grain, trackX, trackY) {
    if (!this.handIsActive || !this.handIsGathering) {
      return;
    }
    let awayX = trackX + grain.offsetX - mouseX;
    let awayY = trackY + grain.offsetY - mouseY;
    let distanceToHand = dist(0, 0, awayX, awayY);
    // Stop just short of the hand, so the grains bunch around it.
    if (distanceToHand >= TOUCH_RADIUS || distanceToHand <= 10) {
      return;
    }

    // Strongest right under the hand, fading to nothing at the edge.
    let strength = pow(1 - distanceToHand / TOUCH_RADIUS, 2);
    // Divide by the distance to get a length-1 direction.
    let directionX = awayX / distanceToHand;
    let directionY = awayY / distanceToHand;
    grain.velocityX -= directionX * GATHER_PULL * strength;
    grain.velocityY -= directionY * GATHER_PULL * strength;
  }

  // How much of the pull a grain feels, from 0 to 1. Grains right where the
  // line was grabbed move the full distance; further along the track they
  // move less, so the line bends like a pulled thread.
  getPullWeight(grain) {
    if (!this.isPulling || grain.path.lineName !== this.pulledLineName) {
      return 0;
    }
    let grabbedAt = this.grabbedDistances[grain.path.branchIndex];
    if (grabbedAt === -1) {
      return 0;
    }
    let along = grain.distance - grabbedAt;
    return exp(-(along * along) / (2 * PULL_REACH * PULL_REACH));
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
    this.pressX = mouseX;
    this.pressY = mouseY;
    this.pressMillis = millis();
    this.isPulling = false;
  }

  handleMouseDragged() {
    if (this.isScrubbingTimeline) {
      this.timeline.setMonthFromX(mouseX);
      return;
    }
    if (this.pressedLineName === null) {
      return;
    }

    // Once the mouse has moved far enough from the press, start pulling.
    let draggedDistance = dist(mouseX, mouseY, this.pressX, this.pressY);
    if (!this.isPulling && draggedDistance > PULL_DRAG_THRESHOLD) {
      this.isPulling = true;
      this.pulledLineName = this.pressedLineName;
      this.grabbedDistances = this.railNetwork.findGrabbedDistances(this.pressedLineName, this.pressX, this.pressY);
      this.overlay.setStatus("Pulling " + this.pressedLineName + " out of the network…");
    }

    if (this.isPulling) {
      this.pullOffsetX = mouseX - this.pressX;
      this.pullOffsetY = mouseY - this.pressY;
      // Limit how far the thread can be stretched.
      let pullLength = dist(0, 0, this.pullOffsetX, this.pullOffsetY);
      if (pullLength > MAX_PULL) {
        this.pullOffsetX = (this.pullOffsetX / pullLength) * MAX_PULL;
        this.pullOffsetY = (this.pullOffsetY / pullLength) * MAX_PULL;
      }
    }
  }

  handleMouseReleased() {
    if (this.isScrubbingTimeline) {
      this.isScrubbingTimeline = false;
      return;
    }

    let wasClick = millis() - this.pressMillis < CLICK_MAX_MILLIS;
    if (this.isPulling) {
      // Letting go: the grains' springs ease the thread back onto its track.
      this.overlay.setStatus("Released " + this.pulledLineName + " — the thread eases back onto its track.");
    } else if (this.pressedLineName !== null && wasClick) {
      this.toggleListening(this.pressedLineName);
    } else if (this.pressedLineName === null && wasClick && this.selectedLineName !== null) {
      // Clicking empty space leaves listening mode.
      this.toggleListening(this.selectedLineName);
    }

    this.isPulling = false;
    this.pulledLineName = null;
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
