// timeline.js
// The Timeline class keeps track of which month is on screen, draws the
// woven timeline at the bottom of the canvas, and plays through the months on its
// own like a clock (one new month every PLAY_FRAMES_PER_MONTH frames).
// It starts playing as soon as the artwork opens, and loops: after the
// latest month it pauses briefly, then starts again from July 2016.
// Each time the month changes the particles briefly swell, so new months
// look like they are being woven in.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// At 60 frames per second, 45 frames is three quarters of a second per
// month, so ten years take about a minute and a half and every number has
// time to be read.
const PLAY_FRAMES_PER_MONTH = 45;

// Button icons (SVG, see audio-reactive.js). Like most media players, the
// button shows what pressing it will do: pause while playing, play while
// paused.
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>' +
  '<rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';

// The woven timeline: one thin vertical thread per month. A thread's
// height shows that month's network trips, and it is split into the T1-T9
// colours by each line's share. Months already played are in full colour;
// months still to come are faint, so playing time weaves the strip.
const WIDE_STRIP_HEIGHT = 44;
const COMPACT_STRIP_HEIGHT = 30;
const FUTURE_THREAD_OPACITY = 55;

// How long to stay on the latest month before looping back to the start
// (120 frames is about 2 seconds).
const END_HOLD_FRAMES = 120;

class Timeline {
  constructor(tripData, theme) {
    this.tripData = tripData;
    this.theme = theme;

    // Start at the first month and play straight away.
    this.monthIndex = 0;
    this.isPlaying = true;

    // Counts frames spent waiting on the latest month before looping.
    this.endHoldFrames = 0;

    // Goes to 1 when the month changes, then fades back to 0.
    this.pulse = 0;

    // The ruler's position, set in resize().
    this.left = 100;
    this.right = 600;
    this.y = 500;

    // Show a year label every this many years (2 on narrow screens).
    this.yearLabelStep = 1;

    // The tallest thread is the busiest month in the whole dataset.
    this.busiestMonthTrips = 0;
    for (let i = 0; i < tripData.getMonthCount(); i++) {
      this.busiestMonthTrips = max(this.busiestMonthTrips, tripData.getNetworkTrips(i));
    }

    // threadHeights[month][line] is the height in pixels of that line's
    // piece of that month's thread. Worked out in resize().
    this.stripHeight = WIDE_STRIP_HEIGHT;
    this.threadHeights = [];

    // The button is placed by InterfaceOverlay.positionButtons().
    this.playButton = createButton("");
    this.playButton.id("play-control");
    this.playButton.addClass("commuter-control");
    this.showButton(PAUSE_ICON, "Pause time");
    this.resize(false, height - 30);
  }

  // Fits the timeline into the control dock. baseY is where the base of the
  // woven strip sits (from InterfaceOverlay.getTimelineBaseY()). In the slim
  // dock on short screens the strip sits beside the buttons, so leftEdge
  // and stripHeight are given; otherwise they are left out.
  resize(isCompact, baseY, leftEdge = 0, stripHeight = 0) {
    let margin = 42;
    if (isCompact) {
      margin = 28;
    }
    this.left = margin;
    if (leftEdge > 0) {
      this.left = leftEdge;
    }
    this.right = width - margin;
    this.y = baseY;

    this.stripHeight = WIDE_STRIP_HEIGHT;
    if (isCompact) {
      this.stripHeight = COMPACT_STRIP_HEIGHT;
    }
    if (stripHeight > 0) {
      this.stripHeight = stripHeight;
    }
    this.measureThreads();

    // Each year gets (ruler length / number of years) pixels. If that is
    // too tight for "2017", "2018"... only label every second year.
    let yearCount = this.tripData.getMonthCount() / 12;
    let pixelsPerYear = (this.right - this.left) / yearCount;
    if (pixelsPerYear < 36) {
      this.yearLabelStep = 2;
    } else {
      this.yearLabelStep = 1;
    }
  }

  // Works out how tall each line's piece of each month's thread is, so
  // draw() does not need to recalculate it every frame.
  measureThreads() {
    this.threadHeights = [];
    for (let month = 0; month < this.tripData.getMonthCount(); month++) {
      let heights = [];
      for (let lineName of this.tripData.lineNames) {
        let trips = this.tripData.getTrips(lineName, month);
        heights.push((trips / this.busiestMonthTrips) * this.stripHeight);
      }
      this.threadHeights.push(heights);
    }
  }

  setMonth(newMonthIndex) {
    let lastMonth = this.tripData.getMonthCount() - 1;
    let clampedIndex = constrain(round(newMonthIndex), 0, lastMonth);
    if (clampedIndex !== this.monthIndex) {
      this.pulse = 1;
    }
    this.monthIndex = clampedIndex;
  }

  stepMonth(step) {
    this.setMonth(this.monthIndex + step);
  }

  // Dragging along the ruler: turn the mouse's x position into a month.
  setMonthFromX(x) {
    let lastMonth = this.tripData.getMonthCount() - 1;
    this.setMonth(map(x, this.left, this.right, 0, lastMonth, true));
  }

  getMonthX(monthIndex) {
    let lastMonth = this.tripData.getMonthCount() - 1;
    return map(monthIndex, 0, lastMonth, this.left, this.right);
  }

  // The area you can click or drag on: the whole strip, the playhead
  // above it, and the year labels below it.
  isOverRuler(x, y) {
    let top = this.y - this.stripHeight - 26;
    return y > top && y < this.y + 26 && x >= this.left - 12 && x <= this.right + 12;
  }

  // The month nearest to an x position on the strip.
  getMonthAtX(x) {
    let lastMonth = this.tripData.getMonthCount() - 1;
    return constrain(round(map(x, this.left, this.right, 0, lastMonth)), 0, lastMonth);
  }

  // A press on the timeline. On the year labels (below the strip) it jumps
  // to January of that year; anywhere else it jumps to the nearest month.
  handlePress(x, y) {
    if (y > this.y + 4) {
      let nearest = this.getMonthAtX(x);
      for (let i = 0; i < this.tripData.getMonthCount(); i++) {
        if (this.tripData.isJanuary(i) && abs(this.getMonthX(i) - x) < 22) {
          nearest = i;
        }
      }
      this.setMonth(nearest);
    } else {
      this.setMonthFromX(x);
    }
  }

  play() {
    this.isPlaying = true;
    this.showButton(PAUSE_ICON, "Pause time");
  }

  pause() {
    this.isPlaying = false;
    this.showButton(PLAY_ICON, "Play time");
  }

  // Sets the button's icon, its screen-reader label and its tooltip.
  showButton(icon, label) {
    this.playButton.html(icon);
    this.playButton.attribute("aria-label", label);
    this.playButton.attribute("title", label);
  }

  togglePlaying() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  // Back to July 2016 and playing, used by the R key.
  restart() {
    this.setMonth(0);
    this.endHoldFrames = 0;
    this.play();
  }

  // Called every frame. While playing, frameCount is used as a timer: every
  // PLAY_FRAMES_PER_MONTH frames we move on one month. At the latest month
  // we wait END_HOLD_FRAMES frames, then loop back to the first month.
  update() {
    this.pulse = this.pulse * 0.92;
    if (!this.isPlaying) {
      return;
    }

    let lastMonth = this.tripData.getMonthCount() - 1;
    if (this.monthIndex >= lastMonth) {
      this.endHoldFrames++;
      if (this.endHoldFrames >= END_HOLD_FRAMES) {
        this.endHoldFrames = 0;
        this.setMonth(0);
      }
      return;
    }

    if (frameCount % PLAY_FRAMES_PER_MONTH === 0) {
      this.stepMonth(1);
    }
  }

  // showHover: draw a preview card for the month under the mouse (only for
  // a real mouse, not touch). isScrubbing: the visitor is dragging along
  // the timeline, so show the card for the current month at the playhead.
  draw(showHover, isScrubbing) {
    push();
    this.drawThreads();
    this.drawYearLabels();
    this.drawPlayhead();

    if (isScrubbing) {
      this.drawMonthCard(this.monthIndex, this.getMonthX(this.monthIndex), false);
    } else if (showHover && this.isOverRuler(mouseX, mouseY) && mouseY < this.y + 4) {
      let hoverMonth = this.getMonthAtX(mouseX);
      this.drawMonthCard(hoverMonth, this.getMonthX(hoverMonth), true);
    }
    pop();
  }

  // The woven strip. Each line is drawn across all months in one go, so
  // the fill colour only changes twice per line (played and still to come).
  drawThreads() {
    let monthCount = this.tripData.getMonthCount();
    let step = (this.right - this.left) / (monthCount - 1);
    let threadWidth = max(1, step * 0.72);

    // How much of each month's thread has been drawn so far, from the
    // bottom up. Each line's piece sits on top of the previous lines.
    let stacked = [];
    for (let month = 0; month < monthCount; month++) {
      stacked.push(0);
    }

    noStroke();
    for (let line = 0; line < this.tripData.lineNames.length; line++) {
      let lineColour = color(this.theme.getLineColour(this.tripData.lineNames[line]));
      for (let month = 0; month < monthCount; month++) {
        // Full colour up to the current month, faint after it.
        if (month === 0) {
          lineColour.setAlpha(255);
          fill(lineColour);
        } else if (month === this.monthIndex + 1) {
          lineColour.setAlpha(FUTURE_THREAD_OPACITY);
          fill(lineColour);
        }
        let pieceHeight = this.threadHeights[month][line];
        let x = this.getMonthX(month) - threadWidth / 2;
        rect(x, this.y - stacked[month] - pieceHeight, threadWidth, pieceHeight);
        stacked[month] += pieceHeight;
      }
    }

    // A thin base line under the threads.
    stroke(this.theme.getTextColour(90));
    strokeWeight(1);
    line(this.left, this.y + 1, this.right, this.y + 1);
  }

  // A tick and a year label at every January.
  drawYearLabels() {
    textSize(9);
    textStyle(NORMAL);
    textAlign(CENTER, TOP);
    for (let i = 0; i < this.tripData.getMonthCount(); i++) {
      if (!this.tripData.isJanuary(i)) {
        continue;
      }
      let x = this.getMonthX(i);
      stroke(this.theme.getTextColour(120));
      strokeWeight(1);
      line(x, this.y + 1, x, this.y + 5);
      noStroke();
      fill(this.theme.palette.yearText);
      // int() turns "2018" into the number 2018, so we can check whether
      // it is a year we label (every year, or every second year).
      if (int(this.tripData.getYear(i)) % this.yearLabelStep === 0) {
        text(this.tripData.getYear(i), x, this.y + 9);
      }
    }
  }

  // The playhead: a line through the strip with a round handle on top that
  // pops a little each time a new month is woven in, and the month above.
  drawPlayhead() {
    let x = this.getMonthX(this.monthIndex);
    let top = this.y - this.stripHeight - 8;
    stroke(this.theme.palette.title);
    strokeWeight(1.5);
    line(x, top, x, this.y + 4);

    noStroke();
    fill(this.theme.palette.accent);
    circle(x, top, 11 + this.pulse * 6);
    fill(this.theme.palette.title);
    textAlign(CENTER, BOTTOM);
    textSize(11);
    textStyle(BOLD);
    text(this.tripData.formatMonth(this.monthIndex), x, top - 9);
  }

  // A small card above the strip for one month: its trips and how busy it
  // was compared with an average month. isPreview draws a faint guide line
  // at that month, for hovering (the playhead itself does not move).
  drawMonthCard(monthIndex, x, isPreview) {
    let top = this.y - this.stripHeight - 8;
    if (isPreview) {
      stroke(this.theme.getTextColour(140));
      strokeWeight(1);
      line(x, top, x, this.y + 4);
    }

    let monthText = this.tripData.formatMonth(monthIndex);
    let tripsText = nfc(this.tripData.getNetworkTrips(monthIndex)) + " trips";
    let percentText = round(this.tripData.getNetworkRatio(monthIndex) * 100) + "% of an average month";

    // The card is as wide as its longest line, plus some padding.
    textSize(11);
    textStyle(BOLD);
    let boldWidth = max(textWidth(monthText), textWidth(tripsText));
    textStyle(NORMAL);
    let cardWidth = max(boldWidth, textWidth(percentText)) + 24;
    let cardHeight = 58;
    // Keep the card on screen near the edges.
    let cardLeft = constrain(x - cardWidth / 2, 8, width - cardWidth - 8);
    let cardTop = top - cardHeight - 26;

    noStroke();
    fill(this.theme.getBackground(235));
    rect(cardLeft, cardTop, cardWidth, cardHeight, 8);
    noFill();
    stroke(this.theme.getTextColour(70));
    rect(cardLeft, cardTop, cardWidth, cardHeight, 8);

    noStroke();
    textAlign(LEFT, TOP);
    fill(this.theme.palette.accent);
    textStyle(BOLD);
    text(monthText, cardLeft + 12, cardTop + 9);
    fill(this.theme.palette.title);
    text(tripsText, cardLeft + 12, cardTop + 24);
    fill(this.theme.palette.text);
    textStyle(NORMAL);
    text(percentText, cardLeft + 12, cardTop + 39);
  }
}
