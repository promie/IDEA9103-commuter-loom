// page-header.js
// The PageHeader class adds the text above the map: the title, a small
// woven logo and the controls at the top left, and the subtitle and the
// years the data covers at the top right. It is HTML laid over the canvas,
// styled by style.css. The mouse passes straight through it to the
// artwork.
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

class PageHeader {
  constructor(tripData, lineColours) {
    let monthCount = tripData.getMonthCount();
    let firstYear = getYear(tripData.months[0]);
    let lastYear = getYear(tripData.months[monthCount - 1]);

    this.titleBlock = createDiv(
      '<div class="page-title">' + this.makeLogo(lineColours) + "<h1>Commuter Loom</h1></div>" +
        '<p class="page-status"></p>' +
        '<p class="page-keys">&larr; &rarr; step months &middot; space plays or pauses &middot; R restarts</p>'
    );
    this.titleBlock.id("page-title-block");
    this.titleBlock.addClass("page-header");
    this.status = this.titleBlock.elt.querySelector(".page-status");

    this.aboutBlock = createDiv(
      '<p class="page-range">Sydney Trains &middot; ' + firstYear + "&ndash;" + lastYear + "</p>" +
        '<p class="page-subtitle">Collective movement memory</p>' +
        '<p class="page-note">' + monthCount + " months of Sydney Trains trips, woven into a living map.</p>"
    );
    this.aboutBlock.id("page-about-block");
    this.aboutBlock.addClass("page-header");

    this.showPlaying(false);
  }

  // Shows a message in the status line, e.g. from the sound button.
  setStatus(message) {
    this.status.textContent = message;
  }

  showPlaying(isPlaying) {
    if (isPlaying) {
      this.status.textContent = "Weaving through the months. Press space or drag the timeline to explore.";
    } else {
      this.status.textContent = "Time paused while you explore. Press space or the play button to carry on.";
    }
  }

  // A tiny square of cloth: three threads each way in line colours,
  // passing over and under each other like a plain weave.
  makeLogo(lineColours) {
    let across = [lineColours.T9, lineColours.T4, lineColours.T5];
    let down = [lineColours.T1, lineColours.T2, lineColours.T8];
    let shapes = "";
    for (let row = 0; row < 3; row++) {
      shapes += '<rect x="1" y="' + (3 + row * 9) + '" width="28" height="6" fill="' + across[row] + '"/>';
    }
    for (let column = 0; column < 3; column++) {
      shapes += '<rect x="' + (3 + column * 9) + '" y="1" width="6" height="28" fill="' + down[column] + '"/>';
    }
    // Where a row passes over a column, draw the row's piece again on top.
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        if ((row + column) % 2 === 1) {
          shapes += '<rect x="' + (3 + column * 9) + '" y="' + (3 + row * 9) + '" width="6" height="6" fill="' + across[row] + '"/>';
        }
      }
    }
    return '<svg class="page-logo" viewBox="0 0 30 30" aria-hidden="true">' + shapes + "</svg>";
  }
}
