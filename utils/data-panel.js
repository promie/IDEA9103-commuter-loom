// data-panel.js
// The DataPanel class shows what the network is doing, in a panel in the
// bottom-right corner, just above the control dock:
//   - the month and the number of trips, which change with a split-flap
//     effect like a departure board: each digit that changes rolls up and
//     out while the new digit rolls in from below;
//   - a ten-year trace of the network's trips, drawn up to the current
//     month as time plays, so you can watch the history being woven
//     (the quiet COVID period is shaded and a dotted line marks an
//     average month). In listening mode it shows the selected line instead;
//   - a breath monitor: a dot that swells with every breath of the fabric
//     (rippling outwards at each in-breath) and a live trace of the
//     breathing, both large in busy months and nearly flat in quiet ones.
//
// Wide screens get the full panel in the bottom-right corner. Narrower
// screens that are tall enough (phones held upright, small tablets) get the
// same information as a compact card across the bottom, just above the
// control dock. Screens too short for either (phones on their side) show
// the numbers in the header instead (see InterfaceOverlay).
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// Where the panel sits and how big it is. It is placed PANEL_MARGIN from
// the right edge of the screen and PANEL_GAP above the control dock (see
// getLeft() and getTop()).
const PANEL_MARGIN = 28;
const PANEL_GAP = 16;

// The panel's top must stay below the title.
const PANEL_HIGHEST_TOP = 110;

// The compact card for narrower screens: its height, its gap above the
// dock, its side margins, and the shortest screen it appears on.
const CARD_HEIGHT = 112;
const CARD_GAP = 10;
const CARD_MARGIN = 16;
const CARD_MIN_HEIGHT = 640;
const PANEL_WIDTH = 292;
const PANEL_HEIGHT = 272;
const PANEL_PADDING = 18;

// The panel needs at least this much room.
// (narrower than 900 and it would run into the subtitle).
const PANEL_MIN_WIDTH = 900;
const PANEL_MIN_HEIGHT = 500;

// How many recent breath values the breath trace remembers (about 2.5
// seconds at 60 frames per second).
const BREATH_TRACE_LENGTH = 150;

// The top of the ten-year trace: 145% of an average month.
const TRACE_MAX_RATIO = 1.45;

// The split-flap effect: how many frames one character takes to flip, and
// how many frames later each next character starts (so they ripple left
// to right instead of all flipping at once).
const FLIP_FRAMES = 18;
const FLIP_STAGGER = 3;

class DataPanel {
  constructor(tripData, theme) {
    this.tripData = tripData;
    this.theme = theme;

    // The top of the control dock (set by setDockTop()). The panel sits
    // just above it.
    this.dockTop = 600;

    // The trip count for the month on screen.
    this.currentTrips = tripData.getNetworkTrips(0);

    // One flip display each for the month name, the year and the trips.
    // Each remembers the text it shows now, the text it showed before, and
    // the frame its last flip started.
    this.monthFlip = { text: "", previousText: "", startFrame: -1000 };
    this.yearFlip = { text: "", previousText: "", startFrame: -1000 };
    this.tripsFlip = { text: "", previousText: "", startFrame: -1000 };

    // Recent breath values, oldest first, for the breath trace.
    this.breathTrace = [];

    // Rings spreading out from the breath dot, one per in-breath.
    this.ripples = [];
    this.lastSwell = 0;
    this.wasBreathingIn = false;
  }

  // The panel's left edge, so its right edge sits PANEL_MARGIN from the
  // right of the screen.
  getLeft() {
    return width - PANEL_MARGIN - PANEL_WIDTH;
  }

  // Called whenever the layout changes, with the top of the control dock.
  setDockTop(dockTop) {
    this.dockTop = dockTop;
  }

  // The full panel needs a wide enough window, and enough height between
  // the title and the dock.
  isFullPanel() {
    let fullPanelTop = this.dockTop - PANEL_GAP - PANEL_HEIGHT;
    return width >= PANEL_MIN_WIDTH && height >= PANEL_MIN_HEIGHT && fullPanelTop >= PANEL_HIGHEST_TOP;
  }

  // Otherwise, a tall enough screen gets the compact card.
  isCard() {
    return !this.isFullPanel() && height >= CARD_MIN_HEIGHT;
  }

  isVisible() {
    return this.isFullPanel() || this.isCard();
  }

  getTop() {
    if (this.isCard()) {
      return this.dockTop - CARD_GAP - CARD_HEIGHT;
    }
    return this.dockTop - PANEL_GAP - PANEL_HEIGHT;
  }

  // Where the map should stop. The card spans the whole width, so the map
  // ends just above it; the full panel sits in a corner, so the map runs
  // down to the dock and only keeps its labels out of the panel's way.
  getMapBottom() {
    if (this.isCard()) {
      return this.getTop() - 8;
    }
    return this.dockTop;
  }

  // The rectangle the full panel covers (or null), so the rail network can
  // keep its labels out of the way.
  getArea() {
    if (!this.isFullPanel()) {
      return null;
    }
    let left = this.getLeft();
    let top = this.getTop();
    return { left: left - 6, top: top - 6, right: left + PANEL_WIDTH + 6, bottom: top + PANEL_HEIGHT + 6 };
  }

  // Called every frame, whether or not the panel is visible.
  update(monthIndex, selectedLineName, fabricBreath) {
    // Update the flip displays. Each one starts flipping when its text changes.
    this.currentTrips = this.getTrips(monthIndex, selectedLineName);
    // split() turns "Aug 2016" into ["Aug", "2016"].
    let monthParts = split(this.tripData.formatMonth(monthIndex), " ");
    this.setFlipText(this.monthFlip, monthParts[0]);
    this.setFlipText(this.yearFlip, monthParts[1]);
    // nfc() adds thousands separators: 28856516 -> "28,856,516".
    this.setFlipText(this.tripsFlip, nfc(this.currentTrips));

    // Remember the breath. splice() removes the oldest value once the trace
    // is full, so it scrolls along like a heart monitor.
    let swell = fabricBreath.getSwell();
    this.breathTrace.push(swell);
    if (this.breathTrace.length > BREATH_TRACE_LENGTH) {
      this.breathTrace.splice(0, 1);
    }

    // A new ripple each time the fabric starts breathing in (the swell
    // starts rising). Deeper breaths make stronger ripples.
    let breathingIn = swell > this.lastSwell;
    if (breathingIn && !this.wasBreathingIn) {
      this.ripples.push({ age: 0, strength: fabricBreath.getBusyness() });
    }
    this.wasBreathingIn = breathingIn;
    this.lastSwell = swell;

    // Ripples grow older and are removed after about a second.
    for (let ripple of this.ripples) {
      ripple.age++;
    }
    if (this.ripples.length > 0 && this.ripples[0].age > 70) {
      this.ripples.splice(0, 1);
    }
  }

  getTrips(monthIndex, selectedLineName) {
    if (selectedLineName !== null) {
      return this.tripData.getTrips(selectedLineName, monthIndex);
    }
    return this.tripData.getNetworkTrips(monthIndex);
  }

  getDisplayedTrips() {
    return this.currentTrips;
  }

  // Starts a flip if the text has changed.
  setFlipText(flip, newText) {
    if (newText === flip.text) {
      return;
    }
    flip.previousText = flip.text;
    flip.text = newText;
    flip.startFrame = frameCount;
  }

  // Draws a flip display at (x, y), its text baseline, in the current text
  // size, in textColour. If wholeWord is true the text flips as one piece
  // (for the month name); otherwise each character flips on its own, and
  // only the characters that changed move. A clip (beginClip/endClip, from
  // p5.js 1.8) hides anything outside the line of text, so characters roll
  // in from below and out at the top. Returns the display's width.
  drawFlipText(flip, x, y, wholeWord, textColour) {
    // The slot is exactly one line of text tall: from the top of the
    // tallest letters (textAscent) to the bottom of letters like "y"
    // (textDescent).
    let slotTop = y - textAscent();
    let slotHeight = textAscent() + textDescent();
    let displayWidth = max(textWidth(flip.text), textWidth(flip.previousText));

    push();
    beginClip();
    rect(x - 2, slotTop, displayWidth + 4, slotHeight);
    endClip();

    if (wholeWord) {
      this.drawFlippingPiece(flip.text, flip.previousText, x, y, slotHeight, flip.startFrame, textColour);
    } else {
      let pieceX = x;
      for (let i = 0; i < flip.text.length; i++) {
        let newCharacter = flip.text.charAt(i);
        let oldCharacter = flip.previousText.charAt(i);
        // A character only flips if it changed (or the length changed).
        if (newCharacter === oldCharacter && flip.text.length === flip.previousText.length) {
          fill(textColour);
          text(newCharacter, pieceX, y);
        } else {
          this.drawFlippingPiece(newCharacter, oldCharacter, pieceX, y, slotHeight, flip.startFrame + i * FLIP_STAGGER, textColour);
        }
        pieceX += textWidth(newCharacter);
      }
    }
    pop();
    return textWidth(flip.text);
  }

  // One piece of a flip: the old text moves up and fades out while the new
  // text moves up into place from below and fades in. The movement starts
  // fast and settles gently (an "ease out" curve).
  drawFlippingPiece(newText, oldText, x, y, slotHeight, startFrame, textColour) {
    let progress = constrain((frameCount - startFrame) / FLIP_FRAMES, 0, 1);
    let eased = 1 - pow(1 - progress, 3);
    let pieceColour = color(textColour);
    if (progress < 1) {
      pieceColour.setAlpha(255 * (1 - eased));
      fill(pieceColour);
      text(oldText, x, y - eased * slotHeight);
    }
    pieceColour.setAlpha(255 * eased);
    fill(pieceColour);
    text(newText, x, y + (1 - eased) * slotHeight);
  }

  // monthPulse (0-1, from the Timeline) is 1 just after the month changes.
  draw(monthIndex, selectedLineName, fabricBreath, monthPulse) {
    if (this.isCard()) {
      this.drawCard(monthIndex, selectedLineName, fabricBreath, monthPulse);
      return;
    }
    if (!this.isFullPanel()) {
      return;
    }
    let palette = this.theme.palette;
    let panelLeft = this.getLeft();
    let panelTop = this.getTop();
    let left = panelLeft + PANEL_PADDING;
    let innerWidth = PANEL_WIDTH - PANEL_PADDING * 2;

    push();

    // The panel background: the page colour, slightly see-through, so the
    // network still shows faintly behind it.
    noStroke();
    fill(this.theme.getBackground(215));
    rect(panelLeft, panelTop, PANEL_WIDTH, PANEL_HEIGHT, 14);
    noFill();
    stroke(this.theme.getTextColour(40));
    strokeWeight(1);
    rect(panelLeft, panelTop, PANEL_WIDTH, PANEL_HEIGHT, 14);

    // Small heading.
    noStroke();
    fill(palette.text);
    textSize(10);
    textStyle(BOLD);
    textAlign(LEFT, BASELINE);
    let heading = "NOW WEAVING";
    if (selectedLineName !== null) {
      heading = "LISTENING TO " + selectedLineName;
    }
    text(heading, left, panelTop + 26);

    this.drawMonth(monthIndex, left, panelTop + 62, monthPulse);
    this.drawTripCount(selectedLineName, left, panelTop + 94);
    this.drawTenYearTrace(monthIndex, selectedLineName, left, panelTop + 124, innerWidth, 46, monthPulse);
    this.drawBreathMonitor(fabricBreath, monthIndex, left, panelTop + 196, innerWidth);

    pop();
  }

  // "Aug" and a large "2016", both flipping like a departure board.
  drawMonth(monthIndex, x, y, monthPulse) {
    textStyle(BOLD);
    textSize(18);
    fill(this.theme.palette.title);
    let monthWidth = this.drawFlipText(this.monthFlip, x, y, true, this.theme.palette.title);

    textSize(34);
    fill(this.theme.palette.accent);
    this.drawFlipText(this.yearFlip, x + monthWidth + 8, y, false, this.theme.palette.accent);
  }

  // The rolling trip counter and what it counts.
  drawTripCount(selectedLineName, x, y) {
    fill(this.theme.palette.title);
    textStyle(BOLD);
    textSize(22);
    this.drawFlipText(this.tripsFlip, x, y, false, this.theme.palette.title);

    fill(this.theme.palette.text);
    textStyle(NORMAL);
    textSize(11);
    let label = "trips across the network this month";
    if (selectedLineName !== null) {
      label = "trips on " + selectedLineName + " this month";
    }
    text(label, x, y + 17);
  }

  // Ten years of trips as a line. The part up to the current month is drawn
  // solid with a soft fill underneath; the months still to come are faint.
  // showLabels: draw the years and the "dotted line" note underneath (the
  // compact card leaves them out to save room).
  drawTenYearTrace(monthIndex, selectedLineName, x, y, traceWidth, traceHeight, monthPulse, showLabels = true) {
    let monthCount = this.tripData.getMonthCount();
    let traceColour = color(this.theme.palette.accent);
    if (selectedLineName !== null) {
      traceColour = color(this.theme.getLineColour(selectedLineName));
    }

    // Each month's trips compared with normal (the network, or the line).
    let ratios = [];
    for (let i = 0; i < monthCount; i++) {
      if (selectedLineName !== null) {
        ratios.push(this.tripData.getTripRatio(selectedLineName, i));
      } else {
        ratios.push(this.tripData.getNetworkRatio(i));
      }
    }

    // The quiet period, shaded.
    let quiet = this.tripData.quietPeriod;
    if (quiet !== null) {
      let band = this.theme.palette.quietBand;
      noStroke();
      fill(band[0], band[1], band[2], band[3]);
      let startX = this.traceX(quiet.startIndex, x, traceWidth);
      rect(startX, y, this.traceX(quiet.endIndex, x, traceWidth) - startX, traceHeight);
    }

    // A dotted line at an average month (100%).
    let averageY = this.traceY(1, y, traceHeight);
    stroke(this.theme.getTextColour(90));
    strokeWeight(1);
    for (let dotX = x; dotX < x + traceWidth; dotX += 5) {
      point(dotX, averageY);
    }

    // The months still to come: a faint thin line.
    noFill();
    stroke(this.theme.getTextColour(60));
    strokeWeight(1);
    beginShape();
    for (let i = monthIndex; i < monthCount; i++) {
      vertex(this.traceX(i, x, traceWidth), this.traceY(ratios[i], y, traceHeight));
    }
    endShape();

    // The months already woven: a soft filled area...
    let areaColour = color(red(traceColour), green(traceColour), blue(traceColour), 50);
    noStroke();
    fill(areaColour);
    beginShape();
    vertex(this.traceX(0, x, traceWidth), y + traceHeight);
    for (let i = 0; i <= monthIndex; i++) {
      vertex(this.traceX(i, x, traceWidth), this.traceY(ratios[i], y, traceHeight));
    }
    vertex(this.traceX(monthIndex, x, traceWidth), y + traceHeight);
    endShape(CLOSE);

    // ...with a solid line on top.
    noFill();
    stroke(traceColour);
    strokeWeight(2);
    beginShape();
    for (let i = 0; i <= monthIndex; i++) {
      vertex(this.traceX(i, x, traceWidth), this.traceY(ratios[i], y, traceHeight));
    }
    endShape();

    // The playhead: a thin line and a dot that pops as each month arrives.
    let headX = this.traceX(monthIndex, x, traceWidth);
    let headY = this.traceY(ratios[monthIndex], y, traceHeight);
    stroke(this.theme.getTextColour(80));
    strokeWeight(1);
    line(headX, y, headX, y + traceHeight);
    noStroke();
    let glow = color(red(traceColour), green(traceColour), blue(traceColour), 70);
    fill(glow);
    circle(headX, headY, 10 + monthPulse * 12);
    fill(traceColour);
    circle(headX, headY, 6);

    if (!showLabels) {
      return;
    }

    // Labels under the trace.
    fill(this.theme.palette.text);
    textStyle(NORMAL);
    textSize(10);
    textAlign(LEFT, TOP);
    text(this.tripData.getYear(0), x, y + traceHeight + 6);
    textAlign(RIGHT, TOP);
    text(this.tripData.getYear(monthCount - 1), x + traceWidth, y + traceHeight + 6);
    textAlign(CENTER, TOP);
    text("dotted line: average month", x + traceWidth / 2, y + traceHeight + 6);
    textAlign(LEFT, BASELINE);
  }

  // The compact card for narrower screens: the same information as the full
  // panel, arranged in three rows across the screen.
  //   1. "NOW WEAVING" on the left; the breathing dot and how busy the
  //      network is on the right.
  //   2. The flipping month and year on the left; the flipping trip count
  //      on the right.
  //   3. The ten-year trace across the full width.
  drawCard(monthIndex, selectedLineName, fabricBreath, monthPulse) {
    let palette = this.theme.palette;
    let top = this.getTop();
    let cardWidth = width - CARD_MARGIN * 2;
    let left = CARD_MARGIN + 14;
    let right = CARD_MARGIN + cardWidth - 14;

    push();
    noStroke();
    fill(this.theme.getBackground(215));
    rect(CARD_MARGIN, top, cardWidth, CARD_HEIGHT, 12);
    noFill();
    stroke(this.theme.getTextColour(40));
    strokeWeight(1);
    rect(CARD_MARGIN, top, cardWidth, CARD_HEIGHT, 12);

    // Row 1: heading on the left, breath on the right.
    noStroke();
    fill(palette.text);
    textSize(9);
    textStyle(BOLD);
    textAlign(LEFT, BASELINE);
    let heading = "NOW WEAVING";
    if (selectedLineName !== null) {
      heading = "LISTENING TO " + selectedLineName;
    }
    text(heading, left, top + 19);

    let breathText = fabricBreath.describe();
    // Capitalise the first letter: "breathing deeply" -> "Breathing deeply".
    breathText = breathText.charAt(0).toUpperCase() + breathText.substring(1);
    breathText = breathText + " · " + round(this.tripData.getNetworkRatio(monthIndex) * 100) + "%";
    textStyle(NORMAL);
    textSize(10);
    textAlign(RIGHT, BASELINE);
    text(breathText, right, top + 19);
    this.drawSmallBreathDot(right - textWidth(breathText) - 10, top + 15, fabricBreath);

    // Row 2: month and year on the left, trip count on the right.
    textAlign(LEFT, BASELINE);
    textStyle(BOLD);
    textSize(15);
    let monthWidth = this.drawFlipText(this.monthFlip, left, top + 52, true, palette.title);
    textSize(26);
    this.drawFlipText(this.yearFlip, left + monthWidth + 6, top + 52, false, palette.accent);

    textSize(17);
    let tripsWidth = textWidth(this.tripsFlip.text);
    this.drawFlipText(this.tripsFlip, right - tripsWidth, top + 46, false, palette.title);
    noStroke();
    fill(palette.text);
    textStyle(NORMAL);
    textSize(10);
    textAlign(RIGHT, BASELINE);
    let label = "trips this month";
    if (selectedLineName !== null) {
      label = "trips on " + selectedLineName + " this month";
    }
    text(label, right, top + 60);

    // Row 3: the ten-year trace, without its labels.
    textAlign(LEFT, BASELINE);
    this.drawTenYearTrace(monthIndex, selectedLineName, left, top + 72, right - left, 28, monthPulse, false);
    pop();
  }

  // A small breathing dot with ripples, for the compact card.
  drawSmallBreathDot(x, y, fabricBreath) {
    let accent = color(this.theme.palette.accent);
    noFill();
    for (let ripple of this.ripples) {
      stroke(red(accent), green(accent), blue(accent), (1 - ripple.age / 70) * 160 * (0.25 + ripple.strength));
      strokeWeight(1);
      circle(x, y, 8 + ripple.age * (0.2 + ripple.strength * 0.25));
    }
    noStroke();
    fill(accent);
    circle(x, y, max(3, 8 + fabricBreath.getSwell() * 12));
  }

  traceX(monthIndex, x, traceWidth) {
    return map(monthIndex, 0, this.tripData.getMonthCount() - 1, x, x + traceWidth);
  }

  traceY(ratio, y, traceHeight) {
    return map(ratio, 0, TRACE_MAX_RATIO, y + traceHeight, y, true);
  }

  // The breath monitor: a breathing dot with ripples, a scrolling trace of
  // the breath, and a description of how busy the network is.
  drawBreathMonitor(fabricBreath, monthIndex, x, y, monitorWidth) {
    let accent = color(this.theme.palette.accent);
    let dotX = x + 14;
    let dotY = y + 16;

    // Ripples: rings that grow and fade. Stronger in busy months.
    noFill();
    for (let ripple of this.ripples) {
      let ringColour = color(red(accent), green(accent), blue(accent), (1 - ripple.age / 70) * 160 * (0.25 + ripple.strength));
      stroke(ringColour);
      strokeWeight(1.5);
      circle(dotX, dotY, 14 + ripple.age * (0.35 + ripple.strength * 0.45));
    }

    // The dot swells and shrinks with the breath.
    noStroke();
    fill(accent);
    circle(dotX, dotY, max(5, 14 + fabricBreath.getSwell() * 22));

    // The breath trace, scrolling from right to left. Older values are
    // fainter. Its height shows how deeply the network is breathing.
    let traceLeft = x + 44;
    let traceWidth = monitorWidth - 44;
    let count = this.breathTrace.length;
    strokeWeight(2);
    for (let i = 1; i < count; i++) {
      let fade = map(i, 0, count, 30, 255);
      stroke(red(accent), green(accent), blue(accent), fade);
      let x1 = traceLeft + ((i - 1) / BREATH_TRACE_LENGTH) * traceWidth;
      let x2 = traceLeft + (i / BREATH_TRACE_LENGTH) * traceWidth;
      line(x1, dotY - this.breathTrace[i - 1] * 22, x2, dotY - this.breathTrace[i] * 22);
    }

    // What it means, in words.
    noStroke();
    fill(this.theme.palette.title);
    textStyle(BOLD);
    textSize(13);
    let breathText = fabricBreath.describe();
    // Capitalise the first letter: "breathing deeply" -> "Breathing deeply".
    text(breathText.charAt(0).toUpperCase() + breathText.substring(1), x, y + 50);

    fill(this.theme.palette.text);
    textStyle(NORMAL);
    textSize(11);
    let percent = round(this.tripData.getNetworkRatio(monthIndex) * 100);
    text("Network at " + percent + "% of an average month", x, y + 66);
  }
}
