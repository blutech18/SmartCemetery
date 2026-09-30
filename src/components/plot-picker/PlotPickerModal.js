"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Maximize2, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import { buildingLabel, columnShortLabel } from "@/lib/cemetery-layout";
import { canAddGrave, tierAvailability } from "@/lib/plot-format";
import { hasPosition, layoutMiniMap, panView, zoomView } from "@/lib/minimap";

const COLORS = {
  free: { fill: "rgba(16, 185, 129, 0.55)", stroke: "#10b981" },
  partial: { fill: "rgba(245, 158, 11, 0.55)", stroke: "#f59e0b" },
  blocked: { fill: "rgba(100, 116, 139, 0.22)", stroke: "rgba(100, 116, 139, 0.55)" },
  chosen: { fill: "rgba(59, 130, 246, 0.7)", stroke: "#3b82f6" },
};
const MAX_UNPLACED = 40;
const MAX_MATCHES = 8;

/**
 * Pick the plot (and tier) for a grave record by clicking it on a schematic
 * minimap drawn from the plots' own positions. Plots that cannot take another
 * record are shown dimmed; partly filled buildings are amber, open plots green.
 * Plots with no map position yet are offered in a searchable list.
 *
 * @param {{
 *   plots: Array, selectedPlotId?: string|number|null, selectedTier?: number|null,
 *   ignoreGraveId?: number|null, onSelect: (choice: { plotId: number, tier: number }) => void,
 *   onClose: () => void,
 * }} props
 */
export default function PlotPickerModal({
  plots,
  selectedPlotId = null,
  selectedTier = null,
  ignoreGraveId = null,
  onSelect,
  onClose,
}) {
  const selectable = useMemo(
    () =>
      new Set(
        plots
          .filter((p) => canAddGrave(p) || (selectedPlotId != null && String(p.id) === String(selectedPlotId)))
          .map((p) => p.id)
      ),
    [plots, selectedPlotId]
  );

  const layout = useMemo(() => layoutMiniMap(plots), [plots]);
  const fit = layout?.viewBox ?? null;
  const [view, setView] = useState(fit);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [chosenId, setChosenId] = useState(selectedPlotId != null ? String(selectedPlotId) : null);
  const [chosenTier, setChosenTier] = useState(selectedTier ?? null);
  const [hoverId, setHoverId] = useState(null);
  const [query, setQuery] = useState("");

  const svgRef = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);

  const chosenPlot = useMemo(() => plots.find((p) => String(p.id) === chosenId) || null, [plots, chosenId]);
  const hoverPlot = useMemo(() => plots.find((p) => p.id === hoverId) || null, [plots, hoverId]);
  const chosenTiers = useMemo(() => tierAvailability(chosenPlot, ignoreGraveId), [chosenPlot, ignoreGraveId]);

  // ── search ──
  const q = query.trim().toLowerCase();
  const matchesQuery = useCallback(
    (p) =>
      Boolean(q) &&
      (p.plotNumber?.toLowerCase().includes(q) ||
        (p.graves || []).some((g) => g.deceasedName?.toLowerCase().includes(q))),
    [q]
  );
  const matches = useMemo(() => (q ? plots.filter(matchesQuery).slice(0, MAX_MATCHES) : []), [plots, q, matchesQuery]);
  const unplaced = useMemo(
    () => plots.filter((p) => selectable.has(p.id) && !hasPosition(p) && (!q || matchesQuery(p))),
    [plots, selectable, q, matchesQuery]
  );

  // ── choosing ──
  const choose = useCallback(
    (plot) => {
      if (!selectable.has(plot.id)) return;
      setChosenId(String(plot.id));
      const tiers = tierAvailability(plot, ignoreGraveId);
      const keep =
        String(plot.id) === String(selectedPlotId) && tiers.find((t) => t.tier === selectedTier && !t.occupant);
      const first = keep || tiers.find((t) => !t.occupant);
      setChosenTier(first ? first.tier : null);
    },
    [selectable, ignoreGraveId, selectedPlotId, selectedTier]
  );

  const canConfirm = Boolean(chosenPlot) && (chosenTiers.length <= 1 || chosenTier != null);
  const confirm = () => {
    if (!canConfirm) return;
    onSelect({ plotId: chosenPlot.id, tier: chosenTiers.length <= 1 ? 1 : chosenTier });
  };

  // ── pan / zoom ──
  const zoomAround = useCallback(
    (factor, fx, fy) => {
      if (!fit) return;
      setView((v) => zoomView(v, factor, fx, fy, fit));
    },
    [fit]
  );

  const zoomCentre = (factor) => {
    const v = viewRef.current;
    if (v) zoomAround(factor, v.x + v.w / 2, v.y + v.h / 2);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (e) => {
      const v = viewRef.current;
      if (!v) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const fx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
      const fy = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
      zoomAround(e.deltaY < 0 ? 0.8 : 1.25, fx, fy);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAround, layout]);

  const startDrag = (e) => {
    if (e.button !== 0 || !viewRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, view: viewRef.current, k: viewRef.current.w / rect.width };
    moved.current = false;
    const onMove = (ev) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      if (moved.current) setView(panView(d.view, -dx * d.k, -dy * d.k));
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── close on Escape ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // ── drawing helpers ──
  const colorsFor = (plot) => {
    if (String(plot.id) === chosenId) return COLORS.chosen;
    if (!selectable.has(plot.id)) return COLORS.blocked;
    const tiers = tierAvailability(plot, ignoreGraveId);
    return tiers.every((t) => !t.occupant) ? COLORS.free : COLORS.partial;
  };

  const vacancyText = (plot) => {
    if (!plot) return "";
    const tiers = tierAvailability(plot, ignoreGraveId);
    const vacant = tiers.filter((t) => !t.occupant).length;
    if (!selectable.has(plot.id)) return "no vacant tier";
    return tiers.length > 1 ? `${vacant} of ${tiers.length} tiers vacant` : "available";
  };

  const plotWhere = (plot) =>
    [plot?.locationDetail?.location?.name, plot?.locationDetail?.subsection].filter(Boolean).join(" · ");

  const showNumbers = view && fit && view.w < fit.w / 2.5;
  // Building labels scale with the size of the cemetery instead of a fixed size.
  const labelSize = fit ? Math.min(2.4, Math.max(1.2, fit.w / 80)) : 2;

  const modal = (
    <div className="modal-overlay" style={{ zIndex: 10100 }} onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose a plot"
        style={{ zIndex: 10101, maxWidth: 1000, width: "96%" }}
        onClick={(e) => e.stopPropagation()}
        id="plot-picker"
      >
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="modal-title" style={{ margin: 0 }}>
            Choose a plot
          </h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close plot picker">
            <X size={16} />
          </button>
        </div>

        <div style={{ position: "relative", margin: "0.6rem 0" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 30 }}
            placeholder="Search by plot number or deceased name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            id="plot-picker-search"
          />
        </div>

        {matches.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }} id="plot-picker-matches">
            {matches.map((p) => {
              const ok = selectable.has(p.id);
              const who = (p.graves || []).map((g) => g.deceasedName).filter(Boolean).join(", ");
              return (
                <button
                  key={p.id}
                  type="button"
                  className="btn btn-ghost"
                  disabled={!ok}
                  title={ok ? vacancyText(p) : "No vacant tier"}
                  onClick={() => choose(p)}
                  style={{ fontSize: "0.75rem", opacity: ok ? 1 : 0.5 }}
                >
                  {p.plotNumber}
                  {who ? ` — ${who}` : ""}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          {/* ── Minimap ── */}
          <div style={{ flex: "1 1 520px", minWidth: 0 }}>
            {layout && view ? (
              <div
                style={{
                  position: "relative",
                  aspectRatio: "16 / 9",
                  width: "100%",
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <svg
                  ref={svgRef}
                  viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ width: "100%", height: "100%", display: "block", cursor: "grab", touchAction: "none" }}
                  onPointerDown={startDrag}
                  role="group"
                  aria-label="Cemetery plots"
                  id="plot-picker-map"
                >
                  {layout.groups.map((g) => (
                    <text
                      key={g.key}
                      x={g.cx}
                      y={g.top - labelSize * 1.1}
                      textAnchor="middle"
                      fontSize={labelSize}
                      fontWeight={700}
                      fill="var(--text-secondary)"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {buildingLabel(g.key)}
                    </text>
                  ))}

                  {layout.shapes.map((s) => {
                    const { plot } = s;
                    const ok = selectable.has(plot.id);
                    const c = colorsFor(plot);
                    const isChosen = String(plot.id) === chosenId;
                    const isMatch = matchesQuery(plot);
                    return (
                      <g key={plot.id}>
                        <polygon
                          points={s.points}
                          fill={c.fill}
                          stroke={isMatch ? "#e879f9" : c.stroke}
                          strokeWidth={isChosen || isMatch ? 0.5 : 0.22}
                          style={{ cursor: ok ? "pointer" : "not-allowed" }}
                          role="button"
                          tabIndex={ok ? 0 : -1}
                          aria-disabled={!ok}
                          aria-pressed={isChosen}
                          aria-label={`${plot.plotNumber}, ${vacancyText(plot)}`}
                          data-plot-number={plot.plotNumber}
                          onMouseEnter={() => setHoverId(plot.id)}
                          onMouseLeave={() => setHoverId((h) => (h === plot.id ? null : h))}
                          onFocus={() => setHoverId(plot.id)}
                          onClick={() => {
                            if (moved.current) {
                              moved.current = false;
                              return;
                            }
                            choose(plot);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              choose(plot);
                            }
                          }}
                        />
                        {showNumbers && (
                          <text
                            x={s.cx}
                            y={s.cy + 0.45}
                            textAnchor="middle"
                            fontSize={1.2}
                            fill="var(--text-primary)"
                            style={{ pointerEvents: "none", userSelect: "none" }}
                          >
                            {columnShortLabel(plot.plotNumber)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => zoomCentre(0.7)} aria-label="Zoom in" title="Zoom in">
                    <ZoomIn size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => zoomCentre(1 / 0.7)} aria-label="Zoom out" title="Zoom out">
                    <ZoomOut size={15} />
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setView(fit)} aria-label="Show everything" title="Show everything">
                    <Maximize2 size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "2rem 1rem",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  border: "1px dashed var(--border-default)",
                  borderRadius: 10,
                }}
              >
                No plot has a map position yet. Choose from the list below.
              </div>
            )}

            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: "0.72rem", color: "var(--text-secondary)" }}
              aria-hidden="true"
            >
              {[
                ["Open (all tiers vacant)", COLORS.free],
                ["Partly filled", COLORS.partial],
                ["No vacant tier", COLORS.blocked],
                ["Selected", COLORS.chosen],
              ].map(([label, c]) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: c.fill, border: `1px solid ${c.stroke}` }} />
                  {label}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 6, minHeight: 20, fontSize: "0.78rem", color: "var(--text-secondary)" }} id="plot-picker-hover">
              {hoverPlot ? (
                <>
                  <strong style={{ color: "var(--text-primary)" }}>{hoverPlot.plotNumber}</strong>
                  {plotWhere(hoverPlot) ? ` · ${plotWhere(hoverPlot)}` : ""} · {vacancyText(hoverPlot)}
                </>
              ) : (
                "Hover a plot for details, click to choose it. Scroll to zoom, drag to move."
              )}
            </div>
          </div>

          {/* ── Selection panel ── */}
          <div style={{ flex: "0 1 280px", minWidth: 240 }} id="plot-picker-panel">
            {chosenPlot ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{chosenPlot.plotNumber}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 8 }}>{plotWhere(chosenPlot)}</div>

                {chosenTiers.length > 1 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }} role="radiogroup" aria-label="Tier">
                    {[...chosenTiers].reverse().map((t) => (
                      <button
                        key={t.tier}
                        type="button"
                        role="radio"
                        aria-checked={chosenTier === t.tier}
                        disabled={Boolean(t.occupant)}
                        onClick={() => setChosenTier(t.tier)}
                        className="btn btn-ghost"
                        data-tier={t.tier}
                        style={{
                          justifyContent: "flex-start",
                          textAlign: "left",
                          opacity: t.occupant ? 0.55 : 1,
                          border: chosenTier === t.tier ? "1.5px solid #3b82f6" : "1px solid var(--border-default)",
                          background: chosenTier === t.tier ? "rgba(59, 130, 246, 0.15)" : undefined,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{t.label}</span>
                        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {t.occupant ? t.occupant.deceasedName : "vacant"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Single-burial lot.</div>
                )}
              </>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Click a green or amber plot on the map to choose it.
              </div>
            )}

            {unplaced.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                  NOT ON THE MAP ({unplaced.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 110, overflowY: "auto" }} id="plot-picker-unplaced">
                  {unplaced.slice(0, MAX_UNPLACED).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => choose(p)}
                      style={{
                        fontSize: "0.72rem",
                        padding: "2px 8px",
                        border: String(p.id) === chosenId ? "1.5px solid #3b82f6" : "1px solid var(--border-default)",
                      }}
                    >
                      {p.plotNumber}
                    </button>
                  ))}
                  {unplaced.length > MAX_UNPLACED && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      …{unplaced.length - MAX_UNPLACED} more — use search
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: "0.85rem", display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!canConfirm} onClick={confirm} id="plot-picker-confirm">
            <Check size={15} />{" "}
            {chosenPlot
              ? `Use ${chosenPlot.plotNumber}${
                  chosenTiers.length > 1 && chosenTier
                    ? ` · ${chosenTiers.find((t) => t.tier === chosenTier)?.label ?? `Tier ${chosenTier}`}`
                    : ""
                }`
              : "Choose a plot"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
