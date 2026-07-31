"use client";

import { useSyncExternalStore } from "react";

// No external store to subscribe to — client state never changes after mount.
const subscribe = () => () => {};

/**
 * Returns `false` during server rendering and the first client render, then
 * `true` after hydration. This is the React-recommended way to gate
 * client-only work (e.g. `createPortal` into `document.body`) without a
 * `setState`-in-effect hydration guard.
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true, // client snapshot
    () => false // server snapshot
  );
}
