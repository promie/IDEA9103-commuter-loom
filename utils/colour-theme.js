// colour-theme.js
// The ColourTheme class keeps every colour the artwork uses in one place,
// in two palettes: "dark" (a night network glowing on deep navy, the
// default) and "light" (warm paper). Every other class asks the theme for
// its colours instead of typing them in, so switching theme recolours the
// whole artwork at once.
//
// Adding ?theme=light to the page address starts in the light theme.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// Sydney Trains line colours, from the official Transport for NSW map.
const OFFICIAL_LINE_COLOURS = {
  T1: "#EF9E32",
  T2: "#1193B9",
  T3: "#DE6D2B",
  T4: "#11589A",
  T5: "#C02688",
  T6: "#486CA1",
  T7: "#738189",
  T8: "#019451",
  T9: "#CD2338",
};

// The same colours, lifted a little for the dark theme. The darker lines
// (T4, T6, T7) would almost disappear against a dark background otherwise.
const NIGHT_LINE_COLOURS = {
  T1: "#F5A93F",
  T2: "#25A9D1",
  T3: "#EC7A37",
  T4: "#3D86D6",
  T5: "#DC3A9F",
  T6: "#7E9EDB",
  T7: "#A3AEB5",
  T8: "#14B866",
  T9: "#EE3D52",
};

const LIGHT_PALETTE = {
  background: [248, 245, 236], // warm paper
  title: "#171a22",
  text: "#596171",
  accent: "#c6782b", // month and timeline
  yearText: "#7b725f",
  quietBand: [198, 120, 43, 45],
  trackGuide: [89, 74, 48, 30],
  stationDot: "#fffaf0",
  stationOutline: "#171a22",
  labelBackground: [248, 245, 236, 220],
  labelText: "#3d4250",
  badgeText: "#ffffff",
  lineColours: OFFICIAL_LINE_COLOURS,
};

const DARK_PALETTE = {
  background: [14, 17, 26], // deep navy
  title: "#f2efe6",
  text: "#a3a9b8",
  accent: "#e8a75e",
  yearText: "#8d93a1",
  quietBand: [232, 167, 94, 50],
  trackGuide: [220, 210, 190, 26],
  stationDot: "#0e111a",
  stationOutline: "#f2efe6",
  labelBackground: [14, 17, 26, 210],
  labelText: "#dfe2ea",
  badgeText: "#0e111a",
  lineColours: NIGHT_LINE_COLOURS,
};

class ColourTheme {
  constructor(themeName) {
    this.name = "dark";
    this.palette = DARK_PALETTE;

    this.use(themeName);
  }

  // Switches to "light" or "dark". Anything else uses the dark theme.
  use(themeName) {
    if (themeName === "light") {
      this.name = "light";
      this.palette = LIGHT_PALETTE;
    } else {
      this.name = "dark";
      this.palette = DARK_PALETTE;
    }
  }

  isDark() {
    return this.name === "dark";
  }

  getLineColour(lineName) {
    return this.palette.lineColours[lineName];
  }

  // The background colour with a chosen opacity (0-255), for the fades
  // and label backgrounds that let the background show through.
  getBackground(opacity) {
    let background = this.palette.background;
    return color(background[0], background[1], background[2], opacity);
  }

  // The secondary text colour with a chosen opacity (0-255), for faint
  // lines and outlines.
  getTextColour(opacity) {
    let textColour = color(this.palette.text);
    textColour.setAlpha(opacity);
    return textColour;
  }
}
