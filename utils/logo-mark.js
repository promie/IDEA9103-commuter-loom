// logo-mark.js
// The LogoMark class draws the Commuter Loom logo: a small woven swatch.
// Four coloured threads (the T1, T2, T8 and T9 train lines) run across,
// and four plain threads run down. They pass over and under each other in
// a checkerboard, like real weaving, turning the rail network into fabric.
//
// The mark is designed on a 48 x 48 grid and drawn at any size with
// translate() and scale() (the transformations from week 10). Its colours
// come from the colour theme, so it matches the light and dark themes.
// The same design, as an SVG file, is the browser-tab icon (assets/logo.svg).
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// Where the four threads sit in each direction, on the 48 x 48 grid.
const LOGO_THREAD_POSITIONS = [10.5, 19.5, 28.5, 37.5];

// The coloured threads running across, top to bottom.
const LOGO_THREAD_LINES = ["T1", "T2", "T8", "T9"];

// The swatch runs from 6 to 42 on the grid.
const LOGO_EDGE_START = 6;
const LOGO_EDGE_END = 42;

class LogoMark {
  constructor(theme) {
    this.theme = theme;
  }

  // Draws the mark with its top-left corner at (x, y), size pixels across.
  draw(x, y, size) {
    let plainColour = this.theme.palette.title;
    let gapColour = this.theme.getBackground(255);
    let threadWidth = 5.5;
    let gapWidth = 7.5;

    push();
    translate(x, y);
    // Everything below is drawn on the 48 x 48 grid and scaled to size.
    scale(size / 48);
    noFill();
    // SQUARE line ends stop exactly at the end point, so the swatch has
    // clean cut edges.
    strokeCap(SQUARE);

    // 1. The coloured threads running across.
    for (let row = 0; row < 4; row++) {
      let threadY = LOGO_THREAD_POSITIONS[row];
      stroke(this.theme.getLineColour(LOGO_THREAD_LINES[row]));
      strokeWeight(threadWidth);
      line(LOGO_EDGE_START, threadY, LOGO_EDGE_END, threadY);
    }

    // 2. The plain threads running down, on top of everything so far. A
    // slightly wider stroke in the background colour first leaves a small
    // gap either side, so the crossings read as over and under.
    for (let column = 0; column < 4; column++) {
      let threadX = LOGO_THREAD_POSITIONS[column];
      stroke(gapColour);
      strokeWeight(gapWidth);
      line(threadX, LOGO_EDGE_START, threadX, LOGO_EDGE_END);
      stroke(plainColour);
      strokeWeight(threadWidth);
      line(threadX, LOGO_EDGE_START, threadX, LOGO_EDGE_END);
    }

    // 3. At every other crossing (a checkerboard), the coloured thread goes
    // back over the plain one: we redraw a short piece of it on top.
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        if ((row + column) % 2 !== 0) {
          continue;
        }
        let threadX = LOGO_THREAD_POSITIONS[column];
        let threadY = LOGO_THREAD_POSITIONS[row];
        stroke(gapColour);
        strokeWeight(gapWidth);
        line(threadX - 4.75, threadY, threadX + 4.75, threadY);
        stroke(this.theme.getLineColour(LOGO_THREAD_LINES[row]));
        strokeWeight(threadWidth);
        line(threadX - 5.6, threadY, threadX + 5.6, threadY);
      }
    }
    pop();
  }
}
