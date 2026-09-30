"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CACHE_KEY = "cmp_custom_boundary_offsets";
const SAVE_DEBOUNCE_MS = 800;

const isValidOffsets = (v) => Array.isArray(v) && v.length >= 3;

function readCachedOffsets() {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isValidOffsets(parsed)) return parsed;
    }
  } catch {
    // ignore — local cache only
  }
  return null;
}

function sameOffsets(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((o, i) => Math.abs(o.dx - b[i].dx) < 0.01 && Math.abs(o.dy - b[i].dy) < 0.01)
  );
}

/**
 * The shared cemetery boundary polygon (relative offsets in metres), or null
 * when none has been saved — callers then use a default derived from the
 * building plots (see `deriveBoundaryOffsets`).
 *
 * Starts from the locally cached value, then adopts the server's (the source of
 * truth shared by every user). Edits update state and the local cache
 * immediately and persist to the server on a debounce. The edit controls are
 * Admin-only, so other roles never trigger a save (401/403 are ignored).
 *
 * @param {{ notify?: (message: string) => void }} [options]
 */
export function useBoundarySettings({ notify } = {}) {
  const [boundaryOffsets, setBoundaryOffsets] = useState(readCachedOffsets);
  const saveTimerRef = useRef(null);
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  // Adopt the server-persisted boundary when available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/boundary");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (isValidOffsets(data?.offsets)) {
          setBoundaryOffsets(data.offsets);
        } else {
          // The server is the source of truth: no saved boundary means use the
          // derived default, even if an older local cache says otherwise.
          setBoundaryOffsets(null);
          try {
            localStorage.removeItem(CACHE_KEY);
          } catch {
            // ignore — local cache only
          }
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear any pending save when leaving the page.
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const scheduleSave = useCallback((offsets) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/settings/boundary", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offsets }),
        });
        if (!res.ok && res.status !== 401 && res.status !== 403) {
          notifyRef.current?.("Boundary could not be saved");
        }
      } catch {
        notifyRef.current?.("Boundary could not be saved");
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const updateBoundaryOffsets = useCallback(
    (next) => {
      setBoundaryOffsets((prev) => (sameOffsets(prev, next) ? prev : next));
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // ignore — local cache only
      }
      scheduleSave(next);
    },
    [scheduleSave]
  );

  const resetBoundary = useCallback(async () => {
    // A pending debounced save must not resurrect the boundary being removed.
    clearTimeout(saveTimerRef.current);
    setBoundaryOffsets(null);
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore — local cache only
    }
    try {
      const res = await fetch("/api/settings/boundary", { method: "DELETE" });
      if (!res.ok && res.status !== 401 && res.status !== 403) {
        notifyRef.current?.("Boundary could not be reset");
        return;
      }
    } catch {
      notifyRef.current?.("Boundary could not be reset");
      return;
    }
    notifyRef.current?.("Boundary lines reset to default");
  }, []);

  return { boundaryOffsets, updateBoundaryOffsets, resetBoundary };
}
