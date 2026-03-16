/**
 * TourContext — Product tour state shared between HomeScreen (messages)
 * and the tab bar (highlight rings).
 *
 * tourStep:
 *   null   = tour not active (done or not yet started)
 *   0      = Coach tab intro
 *   1      = Planning tab highlight
 *   2      = Insights tab highlight
 *   3      = Profile tab highlight
 *   4      = Final message → done
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_DONE_KEY = '@r90:tourDone';

export type TourStep = 0 | 1 | 2 | 3 | 4 | null;

interface TourContextValue {
  tourStep:    TourStep;
  startTour:   () => void;
  advanceTour: () => void;
  skipTour:    () => void;
}

const TourContext = createContext<TourContextValue>({
  tourStep:    null,
  startTour:   () => {},
  advanceTour: () => {},
  skipTour:    () => {},
});

export function TourProvider({ children }: { children: ReactNode }) {
  const [tourStep, setTourStep] = useState<TourStep>(null);

  const markDone = useCallback(async () => {
    await AsyncStorage.setItem(TOUR_DONE_KEY, 'true');
    setTourStep(null);
  }, []);

  const startTour = useCallback(async () => {
    const done = await AsyncStorage.getItem(TOUR_DONE_KEY);
    if (done === 'true') return;
    setTourStep(0);
  }, []);

  const advanceTour = useCallback(() => {
    setTourStep(prev => {
      if (prev === null) return null;
      if (prev >= 4) { markDone(); return null; }
      return (prev + 1) as TourStep;
    });
  }, [markDone]);

  const skipTour = useCallback(() => { markDone(); }, [markDone]);

  return (
    <TourContext.Provider value={{ tourStep, startTour, advanceTour, skipTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}
