"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { HistoryStack } from "@/lib/history-stack";

/**
 * React wrapper around `HistoryStack`. Returns stable callbacks plus
 * `canUndo` / `canRedo` state that re-renders the caller after each change.
 * `undo`/`redo` return the snapshot to restore (or null).
 */
export function useHistoryStack(options) {
  const stackRef = useRef(null);
  if (stackRef.current === null) stackRef.current = new HistoryStack(options);
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });

  const sync = useCallback(() => {
    const s = stackRef.current;
    setFlags((prev) =>
      prev.canUndo === s.canUndo && prev.canRedo === s.canRedo
        ? prev
        : { canUndo: s.canUndo, canRedo: s.canRedo }
    );
  }, []);

  const api = useMemo(
    () => ({
      push(snapshot) {
        stackRef.current.push(snapshot);
        sync();
      },
      reset(snapshot) {
        stackRef.current.reset(snapshot);
        sync();
      },
      clear() {
        stackRef.current.clear();
        sync();
      },
      undo() {
        const snapshot = stackRef.current.undo();
        sync();
        return snapshot;
      },
      redo() {
        const snapshot = stackRef.current.redo();
        sync();
        return snapshot;
      },
    }),
    [sync]
  );

  return { ...api, canUndo: flags.canUndo, canRedo: flags.canRedo };
}
