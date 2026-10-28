// input-controls.js  —  MECHANIC: User input (mouse and keyboard)
//
// The mouse is a hand touching the rail network like fabric:
//   - click a line:   listening mode, where that line comes forward and
//                     the rest of the network fades back
// Keyboard: R resets (leaves listening mode), D switches between the light
// and dark themes.
//
// On touch screens there is no hover, so a quick tap on a line enters
// listening mode.
//
// p5's event functions (mousePressed(), touchStarted() etc.) live in
// sketch.js and call the matching handle...() method here.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// Presses shorter than this count as a click (listening mode).
const CLICK_MAX_MILLIS = 350;

class InputControls {
  constructor(railNetwork) {
    this.railNetwork = railNetwork;

    // The line in listening mode, e.g. "T4", or null for none.
    this.selectedLineName = null;

    // When the mouse was pressed, and the line under it (if any).
    this.pressMillis = 0;
    this.pressedLineName = null;

    // Whether the last press was on the map. Presses on the controls
    // below it (like the theme switch) belong to the controls.
    this.pressedOnMap = false;
  }

  handleMouseMoved() {
    // A hand cursor over a line shows it can be clicked.
    let hitPoint = null;
    if (mouseY < this.railNetwork.mapBottom) {
      hitPoint = this.railNetwork.findNearestHitPoint(mouseX, mouseY);
    }
    if (hitPoint !== null) {
      cursor(HAND);
    } else {
      cursor(ARROW);
    }
  }

  handleMousePressed() {
    this.pressedLineName = null;
    // Below the map is not part of the fabric.
    this.pressedOnMap = mouseY <= this.railNetwork.mapBottom;
    if (!this.pressedOnMap) {
      return;
    }

    let hitPoint = this.railNetwork.findNearestHitPoint(mouseX, mouseY);
    if (hitPoint !== null) {
      this.pressedLineName = hitPoint.path.lineName;
    }
    this.pressMillis = millis();
  }

  handleMouseReleased() {
    if (!this.pressedOnMap) {
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
    } else {
      this.selectedLineName = lineName;
    }
  }

  handleKeyPressed() {
    if (key === "r" || key === "R") {
      this.selectedLineName = null;
    }
  }
}
