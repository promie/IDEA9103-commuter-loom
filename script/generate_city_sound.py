"""Generate the three layered city sounds used by Commuter Loom.

Each layer is a 12-second seamless loop, aimed at one of the frequency
bands that p5.FFT's getEnergy() reports, so each one drives a different
part of the fabric:

  city-rumble.wav  bass (20-140 Hz):        a low drone, like trains in tunnels
  city-hum.wav     mid (400-2,600 Hz):      a warm, slowly swelling chord
  city-taps.wav    treble (5,200-14,000 Hz): scattered bright ticks, like
                                             Opal cards tapping on

The artwork plays all three together and sets each layer's volume from
the month's data (see AudioReactive.followData()), so a busy month sounds
full and a quiet month only keeps a faint rumble.

It also writes city-flip.wav: a short mechanical "clack", like a
split-flap departure board, played each time a new month flips over.

To loop without a click, every tone completes a whole number of cycles in
12 seconds (frequency x 12 is a whole number), and every slow swell
repeats a whole number of times.

Run from the project folder:  python3 script/generate_city_sound.py

AI acknowledgement: this script was written with the help of Claude
(Anthropic).
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 22_050
LOOP_SECONDS = 12
ASSETS = Path(__file__).parent.parent / "assets"


def sine(frequency: float, seconds: float, phase: float = 0) -> float:
    return math.sin(2 * math.pi * frequency * seconds + phase)


def swell(cycles_per_loop: int, seconds: float, depth: float) -> float:
    """A slow rise and fall that repeats a whole number of times per loop."""
    return 1 - depth + depth * (0.5 + 0.5 * sine(cycles_per_loop / LOOP_SECONDS, seconds))


def rumble(seconds: float) -> float:
    # A1 (55 Hz) with a slightly detuned copy, so the two beat slowly like
    # a train rolling past, plus a fifth above and a soft sub-bass.
    drone = (
        0.45 * sine(55, seconds)
        + 0.35 * sine(55.25, seconds, 1.3)
        + 0.22 * sine(82.5, seconds, 0.4)
        + 0.18 * sine(41.25, seconds, 2.1)
    )
    return drone * swell(2, seconds, 0.35)


def hum(seconds: float) -> float:
    # An A major chord (A4, C#5, E5, A5). Each note swells at its own slow
    # pace, so the chord shimmers like the murmur of a crowd.
    return (
        0.30 * sine(440, seconds) * swell(3, seconds, 0.6)
        + 0.24 * sine(554.25, seconds, 0.7) * swell(4, seconds, 0.6)
        + 0.22 * sine(659.25, seconds, 1.9) * swell(5, seconds, 0.6)
        + 0.12 * sine(880, seconds, 2.6) * swell(6, seconds, 0.7)
    )


def tap_times() -> list[float]:
    """About seven taps a second at slightly irregular times. A fixed random
    seed means the pattern is the same every time the script runs."""
    rng = random.Random(9103)
    times = []
    t = 0.05
    while t < LOOP_SECONDS - 0.1:
        times.append(t)
        t += rng.uniform(0.06, 0.24)
    return times


def taps_layer(total_samples: int) -> list[float]:
    samples = [0.0] * total_samples
    rng = random.Random(2016)
    tap_length = int(SAMPLE_RATE * 0.05)
    for start_time in tap_times():
        start = int(start_time * SAMPLE_RATE)
        # Each tap is a short, bright "tick" with its own pitch and loudness.
        pitch = rng.choice([6_000, 6_800, 7_500, 8_400])
        loudness = rng.uniform(0.35, 0.8)
        for k in range(tap_length):
            index = start + k
            if index >= total_samples:
                break
            seconds = k / SAMPLE_RATE
            envelope = math.exp(-seconds * 120)
            samples[index] += loudness * envelope * (sine(pitch, seconds) + 0.4 * sine(pitch * 1.5, seconds))
    return samples


def flip_layer() -> list[float]:
    """A 0.12 second clack: a burst of noise with a bright click and a soft
    low thump, all dying away quickly."""
    rng = random.Random(1907)
    total = int(SAMPLE_RATE * 0.12)
    samples = []
    for index in range(total):
        seconds = index / SAMPLE_RATE
        noise = rng.uniform(-1, 1) * math.exp(-seconds * 90)
        click = sine(2_400, seconds) * math.exp(-seconds * 160)
        thump = sine(140, seconds) * math.exp(-seconds * 45)
        samples.append(0.55 * noise + 0.35 * click + 0.6 * thump)
    return samples


def write_wav(name: str, samples: list[float]) -> None:
    peak = max(abs(value) for value in samples) or 1
    scale = 0.85 / peak
    frames = bytearray()
    for value in samples:
        frames.extend(struct.pack("<h", round(max(-1, min(1, value * scale)) * 32_767)))

    path = ASSETS / name
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(frames)
    print(f"Wrote {path} ({len(samples) / SAMPLE_RATE:.2f} seconds).")


def main() -> None:
    total_samples = SAMPLE_RATE * LOOP_SECONDS
    times = [index / SAMPLE_RATE for index in range(total_samples)]
    write_wav("city-rumble.wav", [rumble(t) for t in times])
    write_wav("city-hum.wav", [hum(t) for t in times])
    write_wav("city-taps.wav", taps_layer(total_samples))
    write_wav("city-flip.wav", flip_layer())


if __name__ == "__main__":
    main()
