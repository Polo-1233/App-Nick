/**
 * ambient-audio.ts — ambient music for wind-down mode.
 *
 * IMPORTANT: expo-av is NEVER imported at the top level.
 * Every function uses `const { Audio } = await import('expo-av')` so that
 * builds without the native expo-av module linked (e.g. Expo Go, unit tests)
 * never crash — they just silently skip audio.
 *
 * Usage:
 *   await playAmbientLoop(require('../assets/music/ambient.mp3'), { volume: 0.4 });
 *   await stopAmbient({ fadeOutMs: 1500 });
 */

// ─── Internal sound reference ─────────────────────────────────────────────────
//
// We deliberately avoid importing the expo-av Sound type statically.
// Instead we define a minimal structural interface that matches the methods
// we call — zero import of expo-av at the module level.

interface SoundLike {
  setVolumeAsync(volume: number): Promise<unknown>;
  stopAsync():                    Promise<unknown>;
  unloadAsync():                  Promise<unknown>;
  getStatusAsync():               Promise<{ isLoaded: boolean; volume?: number }>;
}

let _current: SoundLike | null = null;

// ─── Play ─────────────────────────────────────────────────────────────────────

/**
 * Load and loop an ambient audio asset, fading in from silence.
 * Stops any currently playing sound first.
 *
 * @param asset    - Any value accepted by Audio.Sound.createAsync (require())
 * @param options  - volume (0–1, default 0.4) | fadeInMs (default 2000)
 */
export async function playAmbientLoop(
  asset:   unknown,
  options: { volume?: number; fadeInMs?: number } = {},
): Promise<void> {
  try {
    const { Audio } = await import('expo-av');

    // Allow playback in iOS silent mode / background is handled by wind-down screen
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS:      true,
      staysActiveInBackground:   false,
    });

    // Stop existing sound before starting a new one
    await stopAmbient({ fadeOutMs: 0 });

    const { sound } = await Audio.Sound.createAsync(
      asset as Parameters<typeof Audio.Sound.createAsync>[0],
      {
        isLooping:   true,
        volume:      0,          // Start silent; fade in below
        shouldPlay:  true,
      },
    );

    _current = sound as unknown as SoundLike;

    // Fade in over fadeInMs
    const targetVolume = options.volume  ?? 0.4;
    const fadeInMs     = options.fadeInMs ?? 2000;
    const steps        = 20;
    const stepMs       = fadeInMs / steps;
    const stepVol      = targetVolume / steps;

    for (let i = 1; i <= steps; i++) {
      await sleep(stepMs);
      if (_current !== sound) return; // Sound was replaced/stopped mid-fade
      await (sound as unknown as SoundLike).setVolumeAsync(
        Math.min(i * stepVol, targetVolume),
      );
    }
  } catch (err) {
    console.warn('[ambient-audio] playAmbientLoop failed (non-fatal):', err);
  }
}

// ─── Stop ─────────────────────────────────────────────────────────────────────

/**
 * Stop and unload the current ambient sound, fading out first.
 *
 * @param options - fadeOutMs (default 1500, pass 0 for immediate stop)
 */
export async function stopAmbient(
  options: { fadeOutMs?: number } = {},
): Promise<void> {
  const sound = _current;
  if (!sound) return;
  _current = null; // Clear reference immediately so re-entry is safe

  try {
    const fadeOutMs = options.fadeOutMs ?? 1500;

    if (fadeOutMs > 0) {
      const status = await sound.getStatusAsync();
      const currentVolume = (status.isLoaded ? (status.volume ?? 0.4) : 0);

      if (currentVolume > 0) {
        const steps   = 15;
        const stepMs  = fadeOutMs / steps;
        const stepVol = currentVolume / steps;

        for (let i = steps - 1; i >= 0; i--) {
          await sleep(stepMs);
          await sound.setVolumeAsync(Math.max(i * stepVol, 0));
        }
      }
    }

    await sound.stopAsync();
    await sound.unloadAsync();
  } catch (err) {
    console.warn('[ambient-audio] stopAmbient failed (non-fatal):', err);
    // Best-effort cleanup even if fade failed
    try { await sound.unloadAsync(); } catch (_) {}
  }
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
