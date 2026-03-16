import { createContext, useContext } from 'react';

interface PagerContextValue {
  goToPage: (index: number) => void;
}

export const PagerContext = createContext<PagerContextValue>({ goToPage: () => {} });
export const usePager = () => useContext(PagerContext);
