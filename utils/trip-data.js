// trip-data.js
// The TripData class reads the processed Opal trips table
// (data/monthly_line_trips_full.csv) and answers questions about it, such
// as "how many trips did T4 have in March 2020?" or "is this a busy month
// for T1 compared with its normal month?".
//
// The CSV is produced by script/clean_data.py from the raw Transport for
// NSW data. It is already sorted by month, one row per month and line.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

class TripData {
  constructor(table, lineNames) {
    this.lineNames = lineNames;

    // months[0] is "2016-07", months[1] is "2016-08", and so on.
    this.months = [];

    // trips["2020-03"]["T4"] is the number of T4 trips in March 2020.
    this.trips = {};

    // averageTrips["T4"] is T4's average month across the whole dataset.
    this.averageTrips = {};

    // The smallest and largest line averages (on a log scale), so we can
    // compare quiet lines like T7 with busy lines like T1 on a 0-1 scale.
    this.smallestLogAverage = Infinity;
    this.largestLogAverage = -Infinity;

    // The whole network's average month, across all lines.
    this.networkAverage = 0;

    this.readTable(table);
    this.calculateAverages();
  }

  readTable(table) {
    for (let row of table.rows) {
      let month = row.getString("month");
      let lineName = row.getString("line");

      if (this.trips[month] === undefined) {
        this.trips[month] = {};
        this.months.push(month);
      }
      this.trips[month][lineName] = row.getNum("totalTrips");
    }
  }

  calculateAverages() {
    for (let lineName of this.lineNames) {
      let total = 0;
      for (let month of this.months) {
        total += this.trips[month][lineName] ?? 0;
      }
      let average = total / this.months.length;
      this.averageTrips[lineName] = average;

      // log() squashes big numbers together, so T1 (millions of trips)
      // doesn't make every other line look empty.
      let logAverage = log(average + 1);
      this.smallestLogAverage = min(this.smallestLogAverage, logAverage);
      this.largestLogAverage = max(this.largestLogAverage, logAverage);

      // The network's average month is the sum of every line's average.
      this.networkAverage += average;
    }
  }

  getMonthCount() {
    return this.months.length;
  }

  getTrips(lineName, monthIndex) {
    let month = this.months[constrain(monthIndex, 0, this.months.length - 1)];
    return this.trips[month][lineName] ?? 0;
  }

  getNetworkTrips(monthIndex) {
    let total = 0;
    for (let lineName of this.lineNames) {
      total += this.getTrips(lineName, monthIndex);
    }
    return total;
  }

  // How big this line usually is, from 0 (the quietest line) to 1 (the
  // busiest). Busy lines get denser, wider particle streams.
  getLineVolume(lineName) {
    let logAverage = log(this.averageTrips[lineName] + 1);
    return map(logAverage, this.smallestLogAverage, this.largestLogAverage, 0, 1, true);
  }

  // This month's trips compared with the line's own normal month:
  // 1 = a normal month, 0.3 = 30% of normal (quiet), 1.2 = busier than usual.
  // Comparing each line with itself means a quiet month thins T7 just as
  // visibly as T1, even though T1 has far more trips.
  getTripRatio(lineName, monthIndex) {
    let average = max(this.averageTrips[lineName], 1);
    return this.getTrips(lineName, monthIndex) / average;
  }

  // The whole network this month compared with its average month:
  // about 1.3 in a busy month, 0.2 during the 2020 and 2021 lockdowns.
  getNetworkRatio(monthIndex) {
    return this.getNetworkTrips(monthIndex) / max(this.networkAverage, 1);
  }
}
