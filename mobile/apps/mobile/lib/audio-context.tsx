/**
 * audio-context.tsx — Gestion globale de l'audio R90
 *
 * Fournit un contexte unique pour gérer l'instance Audio.Sound.
 * Évite les conflits entre MRM, CRP et Wind-down players.
 */

import {
  createContext, useContext, useState, useRef, useCallback,
  type ReactNode,
} from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface AudioTrack {
  source:   { uri: string } | number;
  title:    string;
  category: 'mrm' | 'crp' | 'winddown';
}

interface AudioContextValue {
  isPlaying:    boolean;
  currentTrack: AudioTrack | null;
  progress:     number;        // 0–1
  timeRemaining: number;       // seconds
  playAudio:    (source: AudioTrack['source'], meta: Omit<AudioTrack, 'source'>) => Promise<void>;
  pauseAudio:   () => Promise<void>;
  resumeAudio:  () => Promise<void>;
  stopAudio:    () => Promise<void>;
}

const AudioContext = createContext<AudioContextValue>({
  isPlaying:    false,
  currentTrack: null,
  progress:     0,
  timeRemaining: 0,
  playAudio:    async () => {},
  pauseAudio:   async () => {},
  resumeAudio:  async () => {},
  stopAudio:    async () => {},
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const soundRef     = useRef<Audio.Sound | null>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [progress,     setProgress]     = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const stopAudio = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
    setProgress(0);
    setTimeRemaining(0);
  }, []);

  const playAudio = useCallback(async (
    source: AudioTrack['source'],
    meta:   Omit<AudioTrack, 'source'>,
  ) => {
    await stopAudio();
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS:    true,
        staysActiveInBackground: true,
        allowsRecordingIOS:      false,
      });
      const { sound } = await Audio.Sound.createAsync(source as any, { shouldPlay: true });
      soundRef.current = sound;
      setCurrentTrack({ source, ...meta });
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        const dur = status.durationMillis ?? 0;
        const pos = status.positionMillis ?? 0;
        setProgress(dur > 0 ? pos / dur : 0);
        setTimeRemaining(Math.max(0, Math.ceil((dur - pos) / 1000)));
        if (status.didJustFinish) { setIsPlaying(false); }
      });
    } catch {}
  }, [stopAudio]);

  const pauseAudio = useCallback(async () => {
    await soundRef.current?.pauseAsync().catch(() => {});
    setIsPlaying(false);
  }, []);

  const resumeAudio = useCallback(async () => {
    await soundRef.current?.playAsync().catch(() => {});
    setIsPlaying(true);
  }, []);

  return (
    <AudioContext.Provider value={{ isPlaying, currentTrack, progress, timeRemaining, playAudio, pauseAudio, resumeAudio, stopAudio }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
