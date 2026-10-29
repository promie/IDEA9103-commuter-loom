// interface-overlay.js
// The InterfaceOverlay class draws everything that sits on top of the
// moving map: the title, the current month, the status message and the
// keyboard hints. It also places the two buttons. Soft paper-coloured
// fades at the top and bottom keep the text readable while the particles
// keep flowing underneath.
//
// There are two layouts. The wide layout (computers and tablets) puts the
// month and trip counts on the right. The compact layout (phones, or any
// narrow or short window) stacks everything on the left in smaller text,
// fits the buttons to the screen width, and hides the keyboard hints.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

const DEFAULT_STATUS = "Hover or touch to part the threads · drag a line to pull it · click a line to listen";

// The fades are drawn as thin strips, each a little more see-through.
const FADE_STRIP_HEIGHT = 4;

// Sizes of the controls, matching style.css.
const ICON_BUTTON_SIZE = 44;
const THEME_SWITCH_WIDTH = 76;

// The control dock: a solid band along the bottom holding the buttons, the
// woven timeline and the status message. From top to bottom: padding, the
// button row, room for the playhead's month label, the woven strip (its
// height is set in timeline.js), and room for the year labels.
const DOCK_PADDING = 14;
const DOCK_PLAYHEAD_SPACE = 30;
const DOCK_LABEL_SPACE = 30;

// On compact screens there is no room for the status message beside the
// buttons, so it gets its own line at the bottom of the dock.
const DOCK_COMPACT_STATUS_SPACE = 34;

// The one-row dock, used on computers, tablets and phones on their side:
// the buttons sit on the left and the woven timeline runs beside them. From
// top to bottom: padding, room for the playhead's month label, the strip,
// and room for the year labels. Short screens use smaller values.
// (Phones held upright keep the stacked dock above: a strip beside the
// buttons would be too narrow there.)
const SLIM_PADDING = 14;
const SLIM_PLAYHEAD_SPACE = 26;
const SLIM_LABEL_SPACE = 30;
const SHORT_PADDING = 10;
const SHORT_PLAYHEAD_SPACE = 22;
const SHORT_LABEL_SPACE = 28;
const SHORT_STRIP_HEIGHT = 26;

// Windows narrower or shorter than this use the compact layout.
const COMPACT_WIDTH = 700;
const COMPACT_HEIGHT = 500;

// The logo's size in each layout, and the space between it and the title.
const WIDE_LOGO_SIZE = 54;
const COMPACT_LOGO_SIZE = 32;
const LOGO_GAP = 12;

// The "about" block at the top right on wide screens.
const ABOUT_EYEBROW = "SYDNEY TRAINS · 2016–2026";
const ABOUT_HEADING = "Collective movement memory";
const ABOUT_TEXT = "Ten years of monthly Sydney Trains trips, woven into a living map.";

// Gap between the screen edge and the text, in each layout.
const WIDE_MARGIN = 28;
const COMPACT_MARGIN = 16;

class InterfaceOverlay {
  constructor(theme) {
    this.theme = theme;
    this.logo = new LogoMark(theme);
    this.statusMessage = "Loading processed train-trip data…";

    // The rectangle covering the controls, set in positionButtons().
    this.buttonArea = { left: 0, top: 0, right: 0, bottom: 0 };

    // Whether the subtitle sits under the name (set by drawWideHeader()).
    this.subtitleUnderName = false;
  }

  setStatus(message) {
    this.statusMessage = message;
  }

  resetStatus() {
    this.statusMessage = DEFAULT_STATUS;
  }

  isCompact() {
    return width < COMPACT_WIDTH || height < COMPACT_HEIGHT;
  }

  isShort() {
    return height < COMPACT_HEIGHT;
  }

  // Everything except phones held upright gets the one-row dock.
  isSlimDock() {
    return this.isShort() || !this.isCompact();
  }

  // The woven strip's height in the one-row dock.
  getSlimStripHeight() {
    if (this.isShort()) {
      return SHORT_STRIP_HEIGHT;
    }
    return WIDE_STRIP_HEIGHT;
  }

  getMargin() {
    if (this.isCompact()) {
      return COMPACT_MARGIN;
    }
    return WIDE_MARGIN;
  }

  // How tall the control dock is, and where its top edge sits.
  getDockHeight() {
    if (this.isShort()) {
      return SHORT_PADDING + SHORT_PLAYHEAD_SPACE + SHORT_STRIP_HEIGHT + SHORT_LABEL_SPACE;
    }
    if (this.isSlimDock()) {
      return SLIM_PADDING + SLIM_PLAYHEAD_SPACE + WIDE_STRIP_HEIGHT + SLIM_LABEL_SPACE;
    }
    let stripHeight = WIDE_STRIP_HEIGHT;
    if (this.isCompact()) {
      stripHeight = COMPACT_STRIP_HEIGHT;
    }
    let dockHeight = DOCK_PADDING + ICON_BUTTON_SIZE + DOCK_PLAYHEAD_SPACE + stripHeight + DOCK_LABEL_SPACE;
    if (this.isCompact()) {
      dockHeight += DOCK_COMPACT_STATUS_SPACE;
    }
    return dockHeight;
  }

  getDockTop() {
    return height - this.getDockHeight();
  }

  // Where the woven strip's base line sits inside the dock.
  getTimelineBaseY() {
    if (this.isShort()) {
      return height - SHORT_LABEL_SPACE;
    }
    if (this.isSlimDock()) {
      return height - SLIM_LABEL_SPACE;
    }
    return height - DOCK_LABEL_SPACE - DOCK_COMPACT_STATUS_SPACE;
  }

  // Places the controls in a row at the top-left of the dock, just above
  // the woven timeline: the sound and time icon buttons, then the theme
  // switch. Their sizes are fixed in style.css.
  positionButtons(soundButton, timeButton, themeButton) {
    let margin = this.getMargin();
    let gap = 12;
    let buttonY = this.getDockTop() + DOCK_PADDING;
    // In the one-row dock the buttons line up with the middle of the strip.
    if (this.isSlimDock()) {
      let stripMiddle = this.getTimelineBaseY() - this.getSlimStripHeight() / 2;
      buttonY = stripMiddle - ICON_BUTTON_SIZE / 2;
    }

    soundButton.position(margin, buttonY);
    timeButton.position(margin + ICON_BUTTON_SIZE + gap, buttonY);
    themeButton.position(margin + (ICON_BUTTON_SIZE + gap) * 2, buttonY);

    // Remember where the controls are, so a press on one is not also
    // treated as a press on the map.
    let rowRight = margin + (ICON_BUTTON_SIZE + gap) * 2 + THEME_SWITCH_WIDTH;
    this.buttonArea = { left: margin, top: buttonY, right: rowRight, bottom: buttonY + ICON_BUTTON_SIZE };
  }

  isOverButtons(x, y) {
    let area = this.buttonArea;
    return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
  }

  // Paper-coloured fades: almost solid at the very top and bottom of the
  // canvas, fading to clear towards the middle.
  drawFades() {
    push();
    noStroke();
    let topFadeHeight = 140;
    if (this.isCompact() && height < COMPACT_HEIGHT) {
      topFadeHeight = 110;
    }
    for (let y = 0; y < topFadeHeight; y += FADE_STRIP_HEIGHT) {
      let opacity = map(y, 0, topFadeHeight, 245, 0);
      fill(this.theme.getBackground(opacity));
      rect(0, y, width, FADE_STRIP_HEIGHT);
    }

    pop();
  }

  // The control dock: fully see-through, marked only by a thin line along
  // its top so it reads as the place for controls. The map is clipped to
  // the area above this line (see draw() in sketch.js), so nothing from
  // the map shows inside the dock.
  drawDock() {
    push();
    let top = this.getDockTop();
    stroke(this.theme.getTextColour(70));
    strokeWeight(1);
    line(0, top, width, top);
    pop();
  }

  // The title, the month, its trip count and how the network is breathing.
  // In listening mode the count is for the selected line only. When the
  // DataPanel is showing, it shows the numbers instead, so the header only
  // draws the logo and title. The trip count comes from the panel, which
  // rolls it smoothly between months.
  drawHeader(tripData, monthIndex, selectedLineName, fabricBreath, dataPanel) {
    let label = "Network";
    if (selectedLineName !== null) {
      label = selectedLineName;
    }
    // nfc() adds thousands separators: 27906963 -> "27,906,963".
    let tripText = label + " · " + nfc(dataPanel.getDisplayedTrips()) + " trips this month";
    let networkPercent = round(tripData.getNetworkRatio(monthIndex) * 100);

    push();
    noStroke();
    if (this.isCompact() && dataPanel.isVisible()) {
      // The data card shows the numbers, so the header shows the brand.
      this.drawCompactBrand();
    } else if (this.isCompact()) {
      this.drawCompactHeader(tripData.formatMonth(monthIndex), tripText, networkPercent, fabricBreath);
    } else {
      this.drawWideHeader(tripData.formatMonth(monthIndex), tripText, networkPercent, fabricBreath.describe(), !dataPanel.isVisible());
    }
    pop();
  }

  // Logo, title and subtitle on the left; month and numbers on the right
  // (only when showNumbers is true, i.e. the DataPanel is hidden).
  drawWideHeader(monthText, tripText, networkPercent, breathText, showNumbers) {
    // The logo and the name, large, at the top left.
    this.logo.draw(WIDE_MARGIN - 6, 18, WIDE_LOGO_SIZE);
    let titleX = WIDE_MARGIN + WIDE_LOGO_SIZE + LOGO_GAP - 6;
    noStroke();
    fill(this.theme.palette.title);
    textSize(32);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text("COMMUTER LOOM", titleX, 18 + WIDE_LOGO_SIZE / 2);
    textAlign(LEFT, BASELINE);

    // On wide screens with the data panel showing, the description goes in
    // its own block at the top right. Otherwise it sits under the name, and
    // the top right shows the numbers if the panel is hidden.
    // Remember where the subtitle went, so the status message (see
    // drawFooter()) can sit underneath it.
    this.subtitleUnderName = !(!showNumbers && width >= 1000);
    if (!showNumbers && width >= 1000) {
      this.drawAboutBlock();
      return;
    }
    textStyle(NORMAL);
    fill(this.theme.palette.text);
    textSize(13);
    text("Collective movement memory, woven from monthly Sydney Trains trips", titleX + 1, 18 + WIDE_LOGO_SIZE + 14);
    if (!showNumbers) {
      return;
    }

    textAlign(RIGHT, TOP);
    fill(this.theme.palette.accent);
    textSize(18);
    text(monthText, width - WIDE_MARGIN, 30);

    fill(this.theme.palette.text);
    textSize(12);
    text(tripText, width - WIDE_MARGIN, 56);
    // e.g. "Network at 118% of an average month · breathing deeply"
    text("Network at " + networkPercent + "% of an average month · " + breathText, width - WIDE_MARGIN, 74);
  }

  // The "about" block at the top right: a short accent line, a small
  // heading, the piece's subtitle in bold, and one line describing it,
  // all right-aligned to mirror the logo on the left.
  drawAboutBlock() {
    let right = width - WIDE_MARGIN;
    push();
    stroke(this.theme.palette.accent);
    strokeWeight(2);
    line(right - 28, 26, right, 26);

    noStroke();
    textAlign(RIGHT, BASELINE);
    fill(this.theme.palette.accent);
    textStyle(BOLD);
    textSize(10);
    text(ABOUT_EYEBROW, right, 46);

    fill(this.theme.palette.title);
    textSize(17);
    text(ABOUT_HEADING, right, 68);

    fill(this.theme.palette.text);
    textStyle(NORMAL);
    textSize(12);
    text(ABOUT_TEXT, right, 87);
    pop();
  }

  // The compact header when the data card is showing: the logo and name,
  // then the same description as the wide screen's "about" block.
  drawCompactBrand() {
    this.logo.draw(COMPACT_MARGIN - 3, 9, COMPACT_LOGO_SIZE);
    noStroke();
    fill(this.theme.palette.title);
    textSize(18);
    textStyle(BOLD);
    textAlign(LEFT, BASELINE);
    text("COMMUTER LOOM", COMPACT_MARGIN + COMPACT_LOGO_SIZE + LOGO_GAP - 4, 30);

    textSize(12);
    text(ABOUT_HEADING, COMPACT_MARGIN, 56);
    fill(this.theme.palette.accent);
    textSize(9);
    text(ABOUT_EYEBROW, COMPACT_MARGIN, 71);
  }

  // Logo, title and month on one line, then the numbers underneath, all small.
  drawCompactHeader(monthText, tripText, networkPercent, fabricBreath) {
    this.logo.draw(COMPACT_MARGIN - 3, 9, COMPACT_LOGO_SIZE);

    noStroke();
    fill(this.theme.palette.title);
    textSize(18);
    textStyle(BOLD);
    text("COMMUTER LOOM", COMPACT_MARGIN + COMPACT_LOGO_SIZE + LOGO_GAP - 4, 30);

    textAlign(RIGHT, BASELINE);
    fill(this.theme.palette.accent);
    textSize(16);
    text(monthText, width - COMPACT_MARGIN, 30);

    textAlign(LEFT, BASELINE);
    textStyle(NORMAL);
    fill(this.theme.palette.text);
    textSize(11);
    text(tripText, COMPACT_MARGIN, 50);
    // A short landscape phone only has room for one line of numbers. The
    // small dot before it swells and shrinks with the network's breath.
    if (height >= COMPACT_HEIGHT) {
      fill(this.theme.palette.accent);
      circle(COMPACT_MARGIN + 4, 62, max(3, 7 + fabricBreath.getSwell() * 10));
      fill(this.theme.palette.text);
      text(networkPercent + "% of an average month · " + fabricBreath.describe(), COMPACT_MARGIN + 14, 66);
    }
  }

  // The status message, plus keyboard hints on wide screens. On compact
  // screens the status wraps inside a box so it never runs off the edge,
  // and the keyboard hints are left out (phones have no keyboard).
  // The status message. On computers and tablets it sits under the name at
  // the top left, with the keyboard hints underneath. On phones held
  // upright it has its own line along the bottom of the dock. Phones on
  // their side have no room for it.
  drawFooter() {
    push();
    noStroke();
    fill(this.theme.palette.text);
    let margin = this.getMargin();
    if (this.isShort()) {
      pop();
      return;
    }
    if (!this.isCompact()) {
      // Under the name, or under the subtitle when that sits there too.
      let statusY = 18 + WIDE_LOGO_SIZE + 22;
      if (this.subtitleUnderName) {
        statusY += 22;
      }
      let left = WIDE_MARGIN + WIDE_LOGO_SIZE + LOGO_GAP - 5;
      textAlign(LEFT, BASELINE);
      textSize(12);
      text(this.statusMessage, left, statusY);
      fill(this.theme.getTextColour(150));
      textSize(11);
      text("← → step months · space plays or pauses · R restarts", left, statusY + 17);
      pop();
      return;
    }
    // Phones held upright: a line of its own along the bottom of the dock.
    textSize(11);
    textAlign(LEFT, TOP);
    // With a width and height, text() wraps the words inside that box.
    text(this.statusMessage, margin, height - DOCK_COMPACT_STATUS_SPACE, width - margin * 2, DOCK_COMPACT_STATUS_SPACE - 4);
    pop();
  }
}
