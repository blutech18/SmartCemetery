"use client";

import { useEffect } from "react";

let activeLocks = 0;
let prevBodyOverflow = "";
let prevHtmlOverflow = "";
let prevBodyPaddingRight = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;

  if (activeLocks === 0) {
    prevBodyOverflow = document.body.style.overflow;
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevBodyPaddingRight = document.body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  activeLocks++;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;

  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks === 0) {
    document.documentElement.classList.remove("modal-open");
    document.body.classList.remove("modal-open");
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.paddingRight = prevBodyPaddingRight;
  }
}

/**
 * Hook to lock background body and html scrolling when a modal or overlay is active.
 *
 * @param {boolean} locked Whether the scroll should currently be locked.
 */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}
