import { useEffect, useState } from "react";

/** True après le premier rendu client (évite les appels API authentifiés en SSR). */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
