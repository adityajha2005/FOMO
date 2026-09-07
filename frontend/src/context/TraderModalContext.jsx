import { createContext, useContext } from "react";

export const TraderModalContext = createContext(null);

export function useTraderModal() {
  return useContext(TraderModalContext);
}
