// playback-controls.js
// The PlaybackControls class makes the round play / pause button in the
// control dock, which steps the artwork through the months on its own.
// sketch.js places the button, connects it, and moves the month on when
// update() says it is time.
//
// The speaker button next to it belongs to the audio mechanic
// (mechanics/audio-reactive.js).
//
// AI acknowledgement: this class was written with the help of Claude
// (Anthropic).

// How long each month stays on screen while playing (milliseconds).
const PLAYBACK_MONTH_MILLIS = 450;

// SVG icons that use the button's text colour (currentColor), like the
// theme switch in colour-theme.js.
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/>' +
  '<rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/></svg>';

class PlaybackControls {
  constructor() {
    this.isPlaying = false;
    // When the month last moved on while playing.
    this.lastStepMillis = 0;

    this.playButton = createButton(PLAY_ICON);
    this.playButton.id("play-control");
    this.playButton.addClass("commuter-control");

    this.showState();
  }

  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    this.lastStepMillis = millis();
    this.showState();
  }

  // Called every frame. True when the month should move on.
  update() {
    if (!this.isPlaying || millis() - this.lastStepMillis < PLAYBACK_MONTH_MILLIS) {
      return false;
    }
    this.lastStepMillis = millis();
    return true;
  }

  // Updates the icon and the words screen readers use.
  showState() {
    if (this.isPlaying) {
      this.playButton.html(PAUSE_ICON);
      this.playButton.attribute("aria-label", "Pause");
      this.playButton.attribute("title", "Pause (space)");
    } else {
      this.playButton.html(PLAY_ICON);
      this.playButton.attribute("aria-label", "Play through the months");
      this.playButton.attribute("title", "Play (space)");
    }
  }
}
