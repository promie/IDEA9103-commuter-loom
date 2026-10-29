// timeline.js
// The Timeline class draws the month strip in the control dock along the
// bottom of the screen: one bar for every month in the data, split into
// the lines' colours and as tall as that month's network trips, with an
// orange playhead on the month the artwork is showing. Clicking or
// dragging along the strip chooses a month (sketch.js passes the presses
// on).
//
// The bars never change, so they are drawn once into an off-screen
// p5.Graphics layer and redrawn only when the size or theme changes.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// The interface's typeface on the canvas: the browser's sans-serif, like
// the station labels. (p5's textFont() takes one font name, not a list.)
const INTERFACE_FONT = "sans-serif";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Space above the bars for the playhead's month label, and below them for
// the year labels (pixels).
const TIMELINE_LABEL_SPACE = 18;
const TIMELINE_YEAR_SPACE = 14;
// Gap between neighbouring bars (pixels).
const TIMELINE_BAR_GAP = 1;
// How strongly the bars show (0-255). The month being shown is drawn at
// full strength on top.
const TIMELINE_BAR_ALPHA = 105;

// "2016-07" -> "Jul", and "2016-07" -> "2016".
function getMonthName(monthKey) {
  return MONTH_NAMES[int(monthKey.slice(5, 7)) - 1];
}

function getYear(monthKey) {
  return monthKey.slice(0, 4);
}

class Timeline {
  constructor(tripData, lineNames) {
    this.tripData = tripData;
    this.lineNames = lineNames;

    // The strip's area on screen, including the labels. Set in setArea().
    this.left = 0;
    this.top = 0;
    this.right = 0;
    this.bottom = 0;

    // The busiest month's network trips: the tallest bar.
    this.busiestTrips = 1;
    for (let i = 0; i < tripData.getMonthCount(); i++) {
      this.busiestTrips = max(this.busiestTrips, tripData.getNetworkTrips(i));
    }

    // The bars, drawn once (see drawBarLayer()), and the theme they were
    // drawn in.
    this.barLayer = null;
    this.barLayerTheme = null;
  }

  setArea(left, top, right, bottom) {
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    // The size changed, so the bars are drawn again.
    this.barLayerTheme = null;
  }

  getBarsTop() {
    return this.top + TIMELINE_LABEL_SPACE;
  }

  getBarsBottom() {
    return this.bottom - TIMELINE_YEAR_SPACE;
  }

  getBarWidth() {
    return (this.right - this.left) / this.tripData.getMonthCount();
  }

  // The middle of a month's bar.
  getMonthX(monthIndex) {
    return this.left + (monthIndex + 0.5) * this.getBarWidth();
  }

  // The month under a point on the strip. Points past either end pick the
  // first or last month, so a drag can run off the ends.
  getMonthAt(x) {
    let monthIndex = floor((x - this.left) / this.getBarWidth());
    return constrain(monthIndex, 0, this.tripData.getMonthCount() - 1);
  }

  contains(x, y) {
    return x >= this.left - 8 && x <= this.right + 8 && y >= this.top && y <= this.bottom;
  }

  draw(theme, monthIndex) {
    if (this.barLayerTheme !== theme.name) {
      this.drawBarLayer(theme);
    }
    image(this.barLayer, this.left, this.top);

    // The month being shown, at full strength.
    this.drawBar(window, monthIndex, this.left, this.top, theme, 255);
    this.drawPlayhead(theme, monthIndex);
  }

  // Draws every month's bar and the year labels into the off-screen layer.
  drawBarLayer(theme) {
    let layerWidth = max(1, ceil(this.right - this.left));
    let layerHeight = max(1, ceil(this.bottom - this.top));
    if (this.barLayer !== null) {
      this.barLayer.remove();
    }
    this.barLayer = createGraphics(layerWidth, layerHeight);
    this.barLayerTheme = theme.name;

    let layer = this.barLayer;
    for (let i = 0; i < this.tripData.getMonthCount(); i++) {
      this.drawBar(layer, i, 0, 0, theme, TIMELINE_BAR_ALPHA);
    }
    this.drawYearLabels(layer, theme);
  }

  // One month's bar, stacked from the bottom in line order. "canvas" is
  // either the off-screen layer or the main canvas (window), and the bar
  // is drawn relative to originX, originY (the strip's top left there).
  drawBar(canvas, monthIndex, originX, originY, theme, alpha) {
    let barWidth = this.getBarWidth();
    let barsTop = TIMELINE_LABEL_SPACE;
    let barsBottom = this.bottom - this.top - TIMELINE_YEAR_SPACE;
    let barsHeight = barsBottom - barsTop;
    let x = originX + monthIndex * barWidth;
    let y = originY + barsBottom;

    canvas.noStroke();
    for (let lineName of this.lineNames) {
      let trips = this.tripData.getTrips(lineName, monthIndex);
      let pieceHeight = (trips / this.busiestTrips) * barsHeight;
      let pieceColour = canvas.color(theme.getLineColour(lineName));
      pieceColour.setAlpha(alpha);
      canvas.fill(pieceColour);
      canvas.rect(x, y - pieceHeight, max(1, barWidth - TIMELINE_BAR_GAP), pieceHeight);
      y -= pieceHeight;
    }
  }

  // A year label under each January (and under the first month, so the
  // first year shows too), skipping any that would overlap the one before.
  drawYearLabels(layer, theme) {
    layer.textFont(INTERFACE_FONT);
    layer.textSize(10);
    layer.textAlign(LEFT, BOTTOM);
    layer.noStroke();
    layer.fill(theme.palette.yearText);

    let barWidth = this.getBarWidth();
    let lastLabelRight = -Infinity;
    for (let i = 0; i < this.tripData.getMonthCount(); i++) {
      let monthKey = this.tripData.months[i];
      if (i > 0 && getMonthName(monthKey) !== "Jan") {
        continue;
      }
      let label = getYear(monthKey);
      let labelX = i * barWidth;
      if (labelX < lastLabelRight + 8) {
        continue;
      }
      layer.text(label, labelX, layer.height);
      lastLabelRight = labelX + layer.textWidth(label);
    }
  }

  // An orange pill over the month's bar, a knob above it, and the month's
  // name above that, kept inside the strip at either end.
  drawPlayhead(theme, monthIndex) {
    let x = this.getMonthX(monthIndex);
    let barsTop = this.getBarsTop();
    let barsBottom = this.getBarsBottom();

    push();
    noStroke();
    fill(theme.palette.accent);
    rect(x - 3, barsTop - 3, 6, barsBottom - barsTop + 6, 3);
    circle(x, barsTop - 6, 9);

    let label = getMonthName(this.tripData.months[monthIndex]) + " " + getYear(this.tripData.months[monthIndex]);
    textFont(INTERFACE_FONT);
    textStyle(BOLD);
    textSize(11);
    textAlign(CENTER, BOTTOM);
    let halfLabel = textWidth(label) / 2;
    let labelX = constrain(x, this.left + halfLabel, this.right - halfLabel);
    fill(theme.palette.title);
    text(label, labelX, barsTop - 12);
    pop();
  }
}
