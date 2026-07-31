"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { useIsClient } from "../../lib/use-is-client";

/**
 * Accessible confirmation dialog replacing browser `confirm()`.
 *
 * Implements the shared dialog contract: title/description associations,
 * initial focus, focus trap, Escape handling, focus return, scroll
 * containment, and explicit cancel/confirm actions. Destructive dialogs
 * name the object and its consequence in `description`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger", // danger | primary
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const mounted = useIsClient();

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onCancel?.();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = Array.from(
        dialogRef.current?.querySelectorAll("button:not([disabled])") || []
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, busy, onCancel]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="confirm-overlay"
      onClick={() => { if (!busy) onCancel?.(); }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog__head">
          <span className={`confirm-dialog__icon confirm-dialog__icon--${tone}`} aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">{title}</h2>
        </div>

        {description && (
          <p id="confirm-dialog-description" className="confirm-dialog__body">{description}</p>
        )}

        <div className="confirm-dialog__actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
