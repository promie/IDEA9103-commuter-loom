// network-layout.js
// The fixed data that describes our schematic Sydney Trains map: where each
// station sits on a grid, and which stations each train line stops at.
// There is no logic in this file, only constants. The RailNetwork class
// (rail-network.js) reads these to build the tracks the particles flow along.
//
// Stopping patterns follow the current route descriptions in
// data/sydneytrains.geojson (Transport for NSW). Positions are schematic,
// like the official network map, not geographic: every track runs
// horizontally, vertically or at 45 degrees.
//
// AI acknowledgement: the station grid positions were planned with the help
// of Claude (Anthropic), using the official network map as the guide.

// Each station has a short id, a grid position (x grows east, y grows south,
// Central is 0, 0), a display name and a "tier".
// tier 3 = major CBD hub, 2 = big interchange, 1 = named station,
// 0 = unnamed stop or a bend in the track.
// Tiers are a provisional stand-in for foot traffic (busier stations get
// more crowded particles). They should be replaced with the Transport for
// NSW "Train Station Entries and Exits" dataset in the final version.
const STATIONS = [
  // CBD and the City Circle
  { id: "CEN", name: "Central", x: 0, y: 0, tier: 3 },
  { id: "TH", name: "Town Hall", x: 0, y: -2, tier: 3 },
  { id: "WY", name: "Wynyard", x: 0, y: -4, tier: 3 },
  { id: "CQ", name: "Circular Quay", x: 2, y: -6, tier: 2 },
  { id: "SJ", name: "St James", x: 4, y: -4, tier: 1 },
  { id: "MU", name: "Museum", x: 4, y: -2, tier: 1 },
  { id: "BEND_MUSEUM", name: "", x: 2, y: 0, tier: 0 },

  // Eastern Suburbs
  { id: "BEND_TOWN_HALL", name: "", x: 1, y: -3, tier: 0 },
  { id: "MP", name: "Martin Place", x: 2, y: -3, tier: 2 },
  { id: "KX", name: "Kings Cross", x: 6, y: -3, tier: 1 },
  { id: "EC", name: "Edgecliff", x: 8, y: -3, tier: 0 },
  { id: "BJ", name: "Bondi Junction", x: 11, y: -3, tier: 2 },

  // North Shore and Northern lines
  { id: "NSY", name: "North Sydney", x: 0, y: -7, tier: 2 },
  { id: "CHW", name: "Chatswood", x: 0, y: -9, tier: 2 },
  { id: "GOR", name: "Gordon", x: -2, y: -11, tier: 1 },
  { id: "HBY", name: "Hornsby", x: -6, y: -15, tier: 2 },
  { id: "BER", name: "Berowra", x: -6, y: -23, tier: 1 },
  { id: "EPP", name: "Epping", x: -6, y: -8, tier: 1 },

  // Inner West and Western line
  { id: "RED", name: "Redfern", x: -2, y: 0, tier: 2 },
  { id: "STR", name: "Strathfield", x: -6, y: 0, tier: 2 },
  { id: "LID", name: "Lidcombe", x: -10, y: 0, tier: 1 },
  { id: "OLY", name: "Olympic Park", x: -8, y: -2, tier: 1 },
  { id: "GRV", name: "Granville", x: -13, y: 0, tier: 1 },
  { id: "HPK", name: "Harris Park", x: -16, y: 0, tier: 0 },
  { id: "PAR", name: "Parramatta", x: -18, y: 0, tier: 2 },
  { id: "WMD", name: "Westmead", x: -20, y: 0, tier: 1 },
  { id: "SVH", name: "Seven Hills", x: -23, y: 0, tier: 0 },
  { id: "BLK", name: "Blacktown", x: -25, y: 0, tier: 2 },
  { id: "PEN", name: "Penrith", x: -32, y: 0, tier: 1 },
  { id: "EMU", name: "Emu Plains", x: -36, y: 0, tier: 1 },
  { id: "BEND_BLACKTOWN", name: "", x: -27, y: -2, tier: 0 },
  { id: "SCH", name: "Schofields", x: -29, y: -4, tier: 0 },
  { id: "RIC", name: "Richmond", x: -35, y: -10, tier: 1 },

  // South-west: Bankstown, Liverpool and Leppington
  { id: "RGP", name: "Regents Park", x: -10, y: 3, tier: 0 },
  { id: "BIR", name: "", x: -9, y: 4, tier: 0 },
  { id: "BEND_BANKSTOWN", name: "", x: -8, y: 5, tier: 0 },
  { id: "BNK", name: "Bankstown", x: -6, y: 5, tier: 1 },
  { id: "SEF", name: "", x: -11, y: 4, tier: 0 },
  { id: "MRY", name: "Merrylands", x: -16, y: 3, tier: 0 },
  { id: "BEND_MERRYLANDS", name: "", x: -17, y: 4, tier: 0 },
  { id: "CAB", name: "Cabramatta", x: -17, y: 10, tier: 1 },
  { id: "LIV", name: "Liverpool", x: -17, y: 13, tier: 2 },
  { id: "GLF", name: "Glenfield", x: -17, y: 16, tier: 1 },
  { id: "LEP", name: "Leppington", x: -23, y: 22, tier: 1 },
  { id: "CTN", name: "Campbelltown", x: -17, y: 22, tier: 1 },
  { id: "MAC", name: "Macarthur", x: -17, y: 25, tier: 1 },

  // South: Airport, Illawarra and East Hills
  { id: "GSQ", name: "Green Square", x: 0, y: 2, tier: 0 },
  { id: "AIR", name: "Airport", x: 0, y: 5, tier: 2 },
  { id: "SYD", name: "Sydenham", x: -2, y: 4, tier: 1 },
  { id: "WOL", name: "Wolli Creek", x: -2, y: 7, tier: 1 },
  { id: "BEND_WOLLI_CREEK", name: "", x: -4, y: 9, tier: 0 },
  { id: "EHL", name: "East Hills", x: -10, y: 9, tier: 0 },
  { id: "HUR", name: "Hurstville", x: -2, y: 11, tier: 1 },
  { id: "SUT", name: "Sutherland", x: -2, y: 15, tier: 1 },
  { id: "CRO", name: "Cronulla", x: 3, y: 20, tier: 1 },
  { id: "WAT", name: "Waterfall", x: -2, y: 24, tier: 0 },
];

// Each line is one or more branches, and each branch is the list of stops a
// train passes, in order. Routes that start "CEN, TH, WY, CQ, SJ, MU, ...,
// CEN" go round the City Circle first, so their particles loop the CBD
// before heading back out.
const LINE_ROUTES = [
  {
    lineName: "T1",
    branches: [
      ["BER", "HBY", "GOR", "CHW", "NSY", "WY", "TH", "CEN", "RED", "STR", "LID", "GRV", "HPK", "PAR", "WMD", "SVH", "BLK", "PEN", "EMU"],
      ["BER", "HBY", "GOR", "CHW", "NSY", "WY", "TH", "CEN", "RED", "STR", "LID", "GRV", "HPK", "PAR", "WMD", "SVH", "BLK", "BEND_BLACKTOWN", "SCH", "RIC"],
    ],
  },
  {
    lineName: "T2",
    branches: [
      ["CEN", "TH", "WY", "CQ", "SJ", "MU", "BEND_MUSEUM", "CEN", "RED", "STR", "LID", "GRV", "HPK", "PAR"],
      ["CEN", "TH", "WY", "CQ", "SJ", "MU", "BEND_MUSEUM", "CEN", "RED", "STR", "LID", "GRV", "HPK", "MRY", "BEND_MERRYLANDS", "CAB", "LIV", "GLF", "LEP"],
    ],
  },
  {
    lineName: "T3",
    branches: [
      ["CEN", "TH", "WY", "CQ", "SJ", "MU", "BEND_MUSEUM", "CEN", "RED", "STR", "LID", "RGP", "SEF", "CAB", "LIV"],
      ["BNK", "BEND_BANKSTOWN", "BIR", "RGP", "SEF", "CAB", "LIV"],
    ],
  },
  {
    lineName: "T4",
    branches: [
      ["BJ", "EC", "KX", "MP", "BEND_TOWN_HALL", "TH", "CEN", "RED", "SYD", "WOL", "HUR", "SUT", "CRO"],
      ["BJ", "EC", "KX", "MP", "BEND_TOWN_HALL", "TH", "CEN", "RED", "SYD", "WOL", "HUR", "SUT", "WAT"],
    ],
  },
  {
    lineName: "T5",
    branches: [
      ["RIC", "SCH", "BEND_BLACKTOWN", "BLK", "SVH", "WMD", "PAR", "HPK", "MRY", "BEND_MERRYLANDS", "CAB", "LIV", "GLF", "LEP"],
      ["EMU", "PEN", "BLK", "SVH", "WMD", "PAR", "HPK", "MRY", "BEND_MERRYLANDS", "CAB", "LIV", "GLF", "CTN"],
    ],
  },
  {
    lineName: "T6",
    branches: [["LID", "RGP", "BIR", "BEND_BANKSTOWN", "BNK"]],
  },
  {
    lineName: "T7",
    branches: [["LID", "OLY"]],
  },
  {
    lineName: "T8",
    branches: [
      ["CEN", "TH", "WY", "CQ", "SJ", "MU", "BEND_MUSEUM", "CEN", "GSQ", "AIR", "WOL", "BEND_WOLLI_CREEK", "EHL", "GLF", "CTN", "MAC"],
      ["CEN", "TH", "WY", "CQ", "SJ", "MU", "BEND_MUSEUM", "CEN", "RED", "SYD", "WOL", "BEND_WOLLI_CREEK", "EHL", "GLF", "LEP"],
    ],
  },
  {
    lineName: "T9",
    branches: [["GOR", "CHW", "NSY", "WY", "TH", "CEN", "RED", "STR", "EPP", "HBY", "BER"]],
  },
];

// When several lines share a stretch of track they are drawn side by side.
// This list sets their order across the bundle (first = right-hand side
// when travelling away from Central). It was chosen so that lines peel off
// a bundle on the side they branch towards, keeping crossings to a minimum.
const LANE_ORDER = ["T6", "T4", "T8", "T3", "T5", "T2", "T1", "T9", "T7"];

// The part of the grid that should fill the screen. Anything outside it
// (Emu Plains, Berowra, Macarthur...) is allowed to run off the edge.
// Landscape screens (computers, tablets on their side):
const MAP_VIEW_LEFT = -26;
const MAP_VIEW_RIGHT = 12;
const MAP_VIEW_TOP = -14;
const MAP_VIEW_BOTTOM = 13;

// Portrait screens (phones, tablets upright): narrower and taller, centred
// a little west of Central so Parramatta to Bondi Junction fits across,
// with the northern and southern lines filling the height.
const PORTRAIT_VIEW_LEFT = -17.5;
const PORTRAIT_VIEW_RIGHT = 9.5;
const PORTRAIT_VIEW_TOP = -17;
const PORTRAIT_VIEW_BOTTOM = 21;
