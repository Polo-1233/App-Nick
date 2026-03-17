import { createContext, useContext } from 'react';

interface PagerContextValue {
  goToPage:        (index: number) => void;
  setScrollLocked: (locked: boolean) => void; // lock page swipe while carousel is scrolling
}

export const PagerContext = createContext<PagerContextValue>({
  goToPage:        () => {},
  setScrollLocked: () => {},
});

export const usePager = () => useContext(PagerContext);
