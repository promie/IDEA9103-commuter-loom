// playback-controls.js
// The PlaybackControls class makes the round buttons in the control dock:
//   - play / pause: steps the artwork through the months on its own
//   - sound on / off: mutes or unmutes everything p5.sound plays
// sketch.js places the buttons, connects them, and moves the month on when
// update() says it is time.
//
// The sound button only sets p5.sound's main volume (outputVolume()). It
// does not make any sound itself: the audio mechanic plays through it.
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
const SPEAKER_SHAPE = '<path d="M3.5 9.5h3.5l4.5-4v13l-4.5-4H3.5z" fill="currentColor"/>';
const SOUND_OFF_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' + SPEAKER_SHAPE +
  '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SOUND_ON_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' + SPEAKER_SHAPE +
  '<path d="M15 9a4.5 4.5 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

class PlaybackControls {
  constructor() {
    this.isPlaying = false;
    // When the month last moved on while playing.
    this.lastStepMillis = 0;

    // Sound starts off: browsers only let a page make sound after the
    // visitor has clicked something, and the artwork works silently.
    this.isMuted = true;
    outputVolume(0);

    this.soundButton = createButton(SOUND_OFF_ICON);
    this.soundButton.id("sound-control");
    this.soundButton.addClass("commuter-control");

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

  toggleMuted() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      // The browser keeps the audio paused until a click allows it.
      userStartAudio();
    }
    // A short fade (0.1 s) instead of a click in the speakers.
    outputVolume(this.isMuted ? 0 : 1, 0.1);
    this.showState();
  }

  // Updates the icons and the words screen readers use.
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

    if (this.isMuted) {
      this.soundButton.html(SOUND_OFF_ICON);
      this.soundButton.attribute("aria-label", "Turn sound on");
      this.soundButton.attribute("title", "Sound is off");
    } else {
      this.soundButton.html(SOUND_ON_ICON);
      this.soundButton.attribute("aria-label", "Turn sound off");
      this.soundButton.attribute("title", "Sound is on");
    }
  }
}
