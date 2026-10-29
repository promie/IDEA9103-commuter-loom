// data-panel.js
// The DataPanel class draws the floating "Now weaving" panel: the month
// being shown, the network's trips that month, a small chart of every
// month with the average month dotted across it, and a phrase saying how
// busy the month was compared with the average. Clicking or dragging along
// the chart chooses a month, like the timeline (sketch.js passes the
// presses on).
//
// Every number comes from TripData. Station labels stay out of the
// panel's area (RailNetwork.reservedArea, set in sketch.js).
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

const DATA_PANEL_PADDING = 14;
const DATA_PANEL_CHART_HEIGHT = 30;
// The network ratio at the right-hand end of the busyness bar: 2 = twice an
// average month. The average month sits in the middle.
const DATA_PANEL_BAR_MAX_RATIO = 2;

class DataPanel {
  constructor(tripData) {
    this.tripData = tripData;

    // The network's trips in every month, and the busiest month, for the
    // chart.
    this.networkTrips = [];
    this.busiestTrips = 1;
    for (let i = 0; i < tripData.getMonthCount(); i++) {
      let trips = tripData.getNetworkTrips(i);
      this.networkTrips.push(trips);
      this.busiestTrips = max(this.busiestTrips, trips);
    }

    // Where the panel is. Set in setArea(). A compact panel (for narrow
    // screens) leaves out the chart and the busyness bar.
    this.left = 0;
    this.top = 0;
    this.width = 200;
    this.isCompact = false;
    this.rows = this.layoutRows();
  }

  // The top of each row inside the panel, and the panel's height. The
  // compact panel is a short strip with everything in two columns.
  layoutRows() {
    let rows = {};
    if (this.isCompact) {
      rows.height = 58;
      return rows;
    }
    let y = 12;
    rows.heading = y;
    y += 14;
    rows.month = y;
    y += 26;
    rows.trips = y;
    y += 20;
    rows.caption = y;
    y += 22;
    rows.chart = y;
    y += DATA_PANEL_CHART_HEIGHT + 3;
    rows.chartLabels = y;
    y += 15;
    rows.bar = y;
    y += 10;
    rows.phrase = y;
    y += 15;
    rows.detail = y;
    y += 13;
    rows.height = y + 10;
    return rows;
  }

  setArea(left, top, width, isCompact) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.isCompact = isCompact;
    this.rows = this.layoutRows();
  }

  getHeight() {
    return this.rows.height;
  }

  contains(x, y) {
    return x >= this.left && x <= this.left + this.width && y >= this.top && y <= this.top + this.rows.height;
  }

  getChartLeft() {
    return this.left + DATA_PANEL_PADDING;
  }

  getChartRight() {
    return this.left + this.width - DATA_PANEL_PADDING;
  }

  // Whether a point is on the chart (with a little room around it, so
  // it's easy to grab).
  chartContains(x, y) {
    if (this.isCompact) {
      return false;
    }
    let chartTop = this.top + this.rows.chart;
    return x >= this.getChartLeft() - 4 && x <= this.getChartRight() + 4 && y >= chartTop - 6 && y <= chartTop + DATA_PANEL_CHART_HEIGHT + 6;
  }

  getMonthX(monthIndex) {
    let lastMonth = this.tripData.getMonthCount() - 1;
    return map(monthIndex, 0, lastMonth, this.getChartLeft(), this.getChartRight());
  }

  // The month under a point on the chart, to the nearest month.
  getMonthAt(x) {
    let lastMonth = this.tripData.getMonthCount() - 1;
    return round(map(x, this.getChartLeft(), this.getChartRight(), 0, lastMonth, true));
  }

  draw(theme, monthIndex) {
    let palette = theme.palette;
    let left = this.left + DATA_PANEL_PADDING;
    let monthKey = this.tripData.months[monthIndex];

    push();
    translate(0, this.top);
    textFont(INTERFACE_FONT);

    // The panel itself.
    stroke(theme.getTextColour(60));
    strokeWeight(1);
    fill(theme.getBackground(225));
    rect(this.left, 0, this.width, this.rows.height, 10);
    noStroke();

    let ratio = this.tripData.getNetworkRatio(monthIndex);
    if (this.isCompact) {
      this.drawCompact(theme, monthIndex, ratio);
      pop();
      return;
    }

    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(9);
    fill(palette.text);
    text("NOW WEAVING", left, this.rows.heading);

    // "Jul 2016", with the year larger and in the accent colour.
    textAlign(LEFT, BASELINE);
    textSize(15);
    fill(palette.title);
    let monthName = getMonthName(monthKey) + " ";
    text(monthName, left, this.rows.month + 21);
    let yearX = left + textWidth(monthName);
    textSize(23);
    fill(palette.accent);
    text(getYear(monthKey), yearX, this.rows.month + 21);

    textAlign(LEFT, TOP);
    textSize(17);
    fill(palette.title);
    text(this.formatTrips(this.networkTrips[monthIndex]), left, this.rows.trips);
    textStyle(NORMAL);
    textSize(10);
    fill(palette.text);
    text("trips across the network this month", left, this.rows.caption);

    this.drawChart(theme, monthIndex);
    this.drawBusynessBar(theme, ratio);

    textStyle(BOLD);
    textSize(12);
    fill(palette.title);
    text(this.describe(ratio), left, this.rows.phrase);
    textStyle(NORMAL);
    textSize(10);
    fill(palette.text);
    text("Network at " + round(ratio * 100) + "% of an average month", left, this.rows.detail);
    pop();
  }

  // The compact strip: the month on the left, the trips and how busy the
  // month was on the right.
  drawCompact(theme, monthIndex, ratio) {
    let palette = theme.palette;
    let monthKey = this.tripData.months[monthIndex];
    let left = this.left + DATA_PANEL_PADDING;
    let right = left + 104;

    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(9);
    fill(palette.text);
    text("NOW WEAVING", left, 10);
    textAlign(LEFT, BASELINE);
    textSize(14);
    fill(palette.title);
    let monthName = getMonthName(monthKey) + " ";
    text(monthName, left, 46);
    let yearX = left + textWidth(monthName);
    textSize(21);
    fill(palette.accent);
    text(getYear(monthKey), yearX, 46);

    textAlign(LEFT, TOP);
    textSize(15);
    fill(palette.title);
    text(this.formatTrips(this.networkTrips[monthIndex]), right, 9);
    textStyle(NORMAL);
    textSize(9);
    fill(palette.text);
    text("trips across the network", right, 27);
    textStyle(BOLD);
    textSize(10);
    fill(palette.title);
    let phrase = this.describe(ratio) + " ";
    text(phrase, right, 40);
    let phraseWidth = textWidth(phrase);
    textStyle(NORMAL);
    fill(palette.text);
    text("· " + round(ratio * 100) + "% of average", right + phraseWidth, 40);
  }

  // The network's trips in every month as a line, the average month as a
  // dotted line, and a marker on the month being shown.
  drawChart(theme, monthIndex) {
    let palette = theme.palette;
    let chartTop = this.rows.chart;
    let chartBottom = chartTop + DATA_PANEL_CHART_HEIGHT;
    let chartLeft = this.getChartLeft();
    let chartRight = this.getChartRight();

    noFill();
    stroke(theme.getTextColour(150));
    strokeWeight(1);
    beginShape();
    for (let i = 0; i < this.networkTrips.length; i++) {
      vertex(this.getMonthX(i), map(this.networkTrips[i], 0, this.busiestTrips, chartBottom, chartTop));
    }
    endShape();

    // drawingContext is the browser's canvas, which can draw dashed lines.
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash
    let averageY = map(this.tripData.networkAverage, 0, this.busiestTrips, chartBottom, chartTop);
    stroke(theme.getTextColour(120));
    drawingContext.setLineDash([2, 3]);
    line(chartLeft, averageY, chartRight, averageY);
    drawingContext.setLineDash([]);

    let markerX = this.getMonthX(monthIndex);
    let markerY = map(this.networkTrips[monthIndex], 0, this.busiestTrips, chartBottom, chartTop);
    stroke(palette.accent);
    strokeWeight(2);
    line(markerX, chartTop - 2, markerX, chartBottom + 2);
    noStroke();
    fill(palette.accent);
    circle(markerX, markerY, 6);

    let firstYear = getYear(this.tripData.months[0]);
    let lastYear = getYear(this.tripData.months[this.tripData.getMonthCount() - 1]);
    textSize(9);
    textStyle(NORMAL);
    fill(palette.yearText);
    textAlign(LEFT, TOP);
    text(firstYear, chartLeft, this.rows.chartLabels);
    textAlign(CENTER, TOP);
    text("dotted line: average month", (chartLeft + chartRight) / 2, this.rows.chartLabels);
    textAlign(RIGHT, TOP);
    text(lastYear, chartRight, this.rows.chartLabels);
    textAlign(LEFT, TOP);
  }

  // A thin bar filled to this month's busyness, with a tick in the middle
  // for an average month: past the tick is busier than average.
  drawBusynessBar(theme, ratio) {
    let palette = theme.palette;
    let barLeft = this.getChartLeft();
    let barRight = this.getChartRight();
    let barY = this.rows.bar;
    let fillRight = map(ratio, 0, DATA_PANEL_BAR_MAX_RATIO, barLeft, barRight, true);
    let middle = (barLeft + barRight) / 2;

    noStroke();
    fill(theme.getTextColour(50));
    rect(barLeft, barY, barRight - barLeft, 4, 2);
    if (ratio >= 1) {
      fill(palette.accent);
    } else {
      fill(theme.getTextColour(200));
    }
    rect(barLeft, barY, fillRight - barLeft, 4, 2);
    fill(palette.title);
    rect(middle - 0.5, barY - 3, 1, 10);
  }

  // A few words for how busy the network is compared with its average
  // month (1 = an average month).
  describe(ratio) {
    if (ratio < 0.35) {
      return "Barely a thread";
    } else if (ratio < 0.7) {
      return "Running thin";
    } else if (ratio < 0.95) {
      return "A little quiet";
    } else if (ratio < 1.05) {
      return "An ordinary month";
    } else if (ratio < 1.2) {
      return "Busier than usual";
    }
    return "Woven tight";
  }

  // 25591487 -> "25,591,487"
  formatTrips(trips) {
    return round(trips).toLocaleString("en-AU");
  }
}
