"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Gate portals until hydration without setting state in a mount effect. */
export function useMounted() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
