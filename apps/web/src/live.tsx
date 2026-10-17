import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type StatusData } from "./api";

const LiveContext = createContext<StatusData | null>(null);
export const useLiveStatus = () => useContext(LiveContext);
export function LiveProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusData | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void api.status().then((value) => { if (active) setStatus(value.data); }).catch(() => { if (active) setStatus(null); }); };
    refresh();
    window.addEventListener("rightsrail-confirmed", refresh);
    return () => { active = false; window.removeEventListener("rightsrail-confirmed", refresh); };
  }, []);
  return <LiveContext.Provider value={status}>{children}</LiveContext.Provider>;
}
