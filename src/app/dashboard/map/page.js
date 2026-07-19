"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Check, MapPinOff, AlertTriangle, X, Crosshair } from "lucide-react";
import NavigationOverlay from "../../../components/NavigationOverlay";

const CemeteryMap = dynamic(() => import("../../../components/CemeteryMap"), {
  ssr: false,
  loading: () => (
    <div className="card" style={{ height: "100%", minHeight: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner spinner-lg"></div>
    </div>
  ),
});

function hasGps(p) {
  return p && p.gpsLat != null && p.gpsLng != null;
}

// Simple centered modal wrapper.
function Modal({ title, onClose, children, footer }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%" }}>
        <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-md)" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
        {footer && <div className="flex gap-sm w-full" style={{ marginTop: "var(--space-lg)" }}>{footer}</div>}
      </div>
    </div>
  );
}

function MapPageInner() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  const searchParams = useSearchParams();

  const [plots, setPlots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [routeCoords, setRouteCoords] = useState(null);

  // View: plot shown in the details modal.
  const [detailsPlot, setDetailsPlot] = useState(null);

  // Edit-locations mode (drag & drop existing markers).
  const [editing, setEditing] = useState(false);

  // Placement: setting one plot's location. `pending` is either an existing
  // plot object, or { isNew: true, plotNumber, locationDetailId } for a new one.
  const [pending, setPending] = useState(null);
  const [draftCoords, setDraftCoords] = useState(null);

  // Add-plot metadata modal.
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ locationDetailId: "", plotNumber: "" });

  const [unplacedOpen, setUnplacedOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const fetchPlots = useCallback(async () => {
    try {
      const res = await fetch("/api/plots?limit=1000");
      const data = await res.json();
      setPlots(data.plots || []);
      return data.plots || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchPlots);
    (async () => {
      try {
        const res = await fetch("/api/locations");
        setLocations((await res.json()) || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [fetchPlots]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const unpinned = plots.filter((p) => !hasGps(p));

  // Resolve a section's subsection label (e.g. "A1") from its detail id.
  const subsectionOf = useCallback((locationDetailId) => {
    for (const loc of locations) {
      for (const det of loc.details || []) {
        if (String(det.id) === String(locationDetailId)) return det.subsection || "P";
      }
    }
    return "P";
  }, [locations]);

  // Suggest the next plot number for a section: "<subsection>-<NNN>" using the
  // highest existing trailing number in that section + 1.
  const nextPlotNumber = useCallback((locationDetailId) => {
    if (!locationDetailId) return "";
    const subsection = subsectionOf(locationDetailId);
    let max = 0;
    for (const p of plots) {
      const ld = p.locationDetailId ?? p.locationDetail?.id;
      if (String(ld) !== String(locationDetailId)) continue;
      const m = /(\d+)\s*$/.exec(p.plotNumber || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${subsection}-${String(max + 1).padStart(3, "0")}`;
  }, [plots, subsectionOf]);

  const sectionPoint = useCallback((locationDetailId) => {
    if (!locationDetailId) return null;
    for (const loc of locations) {
      for (const det of loc.details || []) {
        if (String(det.id) === String(locationDetailId)) {
          if (loc.gpsLat != null && loc.gpsLng != null) return { lat: Number(loc.gpsLat), lng: Number(loc.gpsLng) };
          return null;
        }
      }
    }
    return null;
  }, [locations]);

  // Deep-link: /dashboard/map?plot=<id>
  useEffect(() => {
    const target = searchParams.get("plot");
    if (!target || !plots.length) return;
    const plot = plots.find((item) => String(item.id) === String(target));
    if (!plot) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (hasGps(plot)) setDetailsPlot(plot);
      else if (isAdmin) startPlacing(plot);
    });
    return () => {
      cancelled = true;
    };
    // startPlacing intentionally uses the latest placement state after the
    // deep-link target changes; the microtask prevents a synchronous cascade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, plots, isAdmin]);

  function resetModes() {
    setPending(null);
    setDraftCoords(null);
    setEditing(false);
    setAddOpen(false);
    setUnplacedOpen(false);
    setError("");
  }

  function scrollToMap() {
    setTimeout(() => {
      document.getElementById("cemetery-map-container")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  function startPlacing(plot) {
    setDetailsPlot(null);
    setRouteCoords(null);
    setEditing(false);
    setError("");
    setPending(plot);
    setDraftCoords(hasGps(plot) ? { lat: Number(plot.gpsLat), lng: Number(plot.gpsLng) } : null);
    scrollToMap();
  }

  function openAdd() {
    resetModes();
    setAddForm({ locationDetailId: "", plotNumber: "" });
    setAddOpen(true);
  }

  function proceedAddToMap(e) {
    e.preventDefault();
    if (!addForm.locationDetailId) return;
    // plotNumber here is only a preview; the server assigns the authoritative,
    // incremented number on create.
    setPending({ isNew: true, locationDetailId: addForm.locationDetailId, plotNumber: addForm.plotNumber || nextPlotNumber(addForm.locationDetailId) });
    setDraftCoords(null);
    setAddOpen(false);
    scrollToMap();
  }

  function toggleEditing() {
    if (editing) {
      setEditing(false);
    } else {
      resetModes();
      setDetailsPlot(null);
      setRouteCoords(null);
      setEditing(true);
      scrollToMap();
    }
  }

  const draftMarker = pending && draftCoords ? draftCoords : null;

  const focusPoint = useMemo(() => {
    if (pending) {
      if (!pending.isNew && hasGps(pending)) return { lat: Number(pending.gpsLat), lng: Number(pending.gpsLng) };
      const ldId = pending.isNew ? pending.locationDetailId : (pending.locationDetailId ?? pending.locationDetail?.id);
      return sectionPoint(ldId);
    }
    if (detailsPlot && hasGps(detailsPlot)) return { lat: Number(detailsPlot.gpsLat), lng: Number(detailsPlot.gpsLng) };
    return null;
  }, [pending, detailsPlot, sectionPoint]);

  function handleMapClick(lat, lng) {
    if (!pending) return;
    setDraftCoords({ lat, lng });
  }

  async function savePlacement() {
    if (!pending || !draftCoords) {
      setError("Click on the map to place the marker first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isNew = !!pending.isNew;
      const url = isNew ? "/api/plots" : `/api/plots/${pending.id}`;
      const method = isNew ? "POST" : "PUT";
      // For new plots, omit plotNumber so the server assigns the next
      // incremented number for the section (race-safe).
      const payload = isNew
        ? { locationDetailId: parseInt(pending.locationDetailId, 10), gpsLat: Number(draftCoords.lat), gpsLng: Number(draftCoords.lng) }
        : { gpsLat: Number(draftCoords.lat), gpsLng: Number(draftCoords.lng) };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json().catch(() => null);
        const refreshed = await fetchPlots();
        setPending(null);
        setDraftCoords(null);
        setToast(isNew ? `Plot ${saved?.plotNumber ?? ""} added` : "Location updated");
        const savedId = saved?.id ?? (!isNew ? pending.id : null);
        const found = refreshed.find((p) => p.id === savedId);
        if (found) setDetailsPlot(found);
      } else if (res.status === 401 || res.status === 403) {
        setError("You don't have permission to manage plots.");
      } else if (res.status === 409) {
        setError("A plot with this number already exists in this section.");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message || body?.error || "Failed to save.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePlotDragEnd(plot, lat, lng) {
    try {
      const res = await fetch(`/api/plots/${plot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gpsLat: Number(lat), gpsLng: Number(lng) }),
      });
      if (res.ok) {
        // Update local coordinates without a full refetch to keep the marker put.
        setPlots((prev) => prev.map((p) => (p.id === plot.id ? { ...p, gpsLat: lat, gpsLng: lng } : p)));
        setToast(`Plot ${plot.plotNumber} relocated`);
      } else if (res.status === 401 || res.status === 403) {
        setToast("No permission to move plots");
        fetchPlots();
      } else {
        setToast("Failed to relocate");
        fetchPlots();
      }
    } catch (err) {
      console.error(err);
      setToast("Failed to relocate");
      fetchPlots();
    }
  }

  const detailsDestination =
    detailsPlot && hasGps(detailsPlot) ? { lat: Number(detailsPlot.gpsLat), lng: Number(detailsPlot.gpsLng) } : detailsPlot ? { lat: NaN, lng: NaN } : null;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Cemetery Map</h1>
          <p className="page-subtitle">
            {isAdmin ? "Add plot markers, drag to relocate, and navigate" : "Interactive navigation with grave markers (powered by OpenStreetMap)"}
          </p>
        </div>

        {/* Toolbar (Admin) */}
        {isAdmin && (
          <div className="flex items-center gap-sm" style={{ flexWrap: "wrap" }}>
            {unpinned.length > 0 && !pending && !editing && (
              <button className="btn btn-ghost btn-sm flex items-center gap-xs" onClick={() => setUnplacedOpen(true)}>
                <MapPinOff size={16} /> Unplaced ({unpinned.length})
              </button>
            )}
            <button className="btn btn-primary flex items-center gap-xs" onClick={openAdd} disabled={editing || !!pending}>
              <Plus size={18} /> Add Plot
            </button>
            <button
              className={`btn ${editing ? "" : "btn-ghost"} flex items-center gap-xs`}
              onClick={toggleEditing}
              disabled={!!pending}
              style={editing ? { background: "var(--success, #2ECC71)", color: "#fff" } : undefined}
            >
              {editing ? <><Check size={18} /> Done Editing</> : <><Pencil size={16} /> Edit Locations</>}
            </button>
          </div>
        )}
      </div>

      {/* Mode banners */}
      {pending && (
        <div className="alert" style={{ marginBottom: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-sm)", background: "var(--primary-light, #eef4ff)", padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", flexWrap: "wrap" }}>
          <Crosshair size={18} />
          <span className="text-sm">
            {draftCoords
              ? `${pending.isNew ? "New plot" : "Plot"} ${pending.plotNumber}: drag the pin or click the map to fine-tune, then Save.`
              : `Click on the map to place ${pending.isNew ? "new plot" : "plot"} ${pending.plotNumber} — you can drag it afterward.`}
          </span>
          {error && <span className="text-sm" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={14} /> {error}</span>}
          <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-sm)" }}>
            <button className="btn btn-ghost btn-sm" onClick={resetModes} disabled={saving}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={savePlacement} disabled={saving || !draftCoords}>
              {saving ? "Saving..." : pending.isNew ? "Save Plot" : "Save Location"}
            </button>
          </span>
        </div>
      )}

      {editing && (
        <div className="alert alert-info flex items-center gap-sm" style={{ marginBottom: "var(--space-md)" }}>
          <Pencil size={16} /> <span className="text-sm">Edit mode: drag any plot marker to relocate it — changes save automatically. Click “Done Editing” when finished.</span>
        </div>
      )}

      {/* Map (full width) */}
      <div id="cemetery-map-container" style={{ height: 620, position: "relative" }}>
        <CemeteryMap
          plots={plots}
          selectedPlot={detailsPlot}
          onSelectPlot={(plot) => {
            if (pending || editing) return;
            setRouteCoords(null);
            setDetailsPlot(plot);
          }}
          routeCoords={routeCoords}
          placingMode={!!pending}
          draftMarker={draftMarker}
          onMapClick={handleMapClick}
          focusPoint={focusPoint}
          editable={editing}
          onPlotDragEnd={handlePlotDragEnd}
        />

        {/* Legend Overlay */}
        <div
          className="card"
          style={{
            position: "absolute",
            bottom: "24px",
            left: "24px",
            zIndex: 400,
            padding: "10px 16px",
            margin: 0,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            maxWidth: "calc(100% - 48px)"
          }}
        >
          <div className="flex items-center gap-md" style={{ flexWrap: "wrap" }}>
            <span className="text-xs text-muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Legend:</span>
            {[
              { color: "#2ECC71", label: "Available" },
              { color: "#FF6B6B", label: "Occupied" },
              { color: "#FFB547", label: "Reserved" },
              { color: "#4ECDC4", label: "Maintenance" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-xs">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, border: "1px solid rgba(255,255,255,0.2)" }} />
                <span className="text-sm" style={{ color: "#e2e8f0" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {toast && (
          <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--primary)", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", zIndex: 500, fontSize: "0.85rem", fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 4px 15px rgba(0,0,0,0.4)" }}>
            {toast}
          </div>
        )}
      </div>

      {/* Add Plot metadata modal */}
      {addOpen && (
        <Modal
          title="Add Plot"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={proceedAddToMap} disabled={!addForm.locationDetailId}>
                Place on Map
              </button>
            </>
          }
        >
          <form onSubmit={proceedAddToMap} className="flex flex-col gap-lg">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Location / Section</label>
              <select
                className="form-select"
                value={addForm.locationDetailId}
                onChange={(e) => {
                  const locationDetailId = e.target.value;
                  setAddForm({ locationDetailId, plotNumber: locationDetailId ? nextPlotNumber(locationDetailId) : "" });
                }}
                required
                style={{ width: "100%" }}
              >
                <option value="">Select a section...</option>
                {locations.map((loc) => (
                  <optgroup key={loc.id} label={loc.name}>
                    {loc.details?.map((det) => (
                      <option key={det.id} value={det.id}>{det.subsection} (Capacity: {det.capacity})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Plot Number</span>
                <span className="text-xs text-muted" style={{ fontWeight: 400, textTransform: "none", letterSpacing: "0" }}>(Assigned automatically)</span>
              </label>
              <div className="form-input" style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.1)", border: "1px dashed var(--border-default)", color: addForm.plotNumber ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font-mono)", width: "100%", height: "42px" }}>
                {addForm.plotNumber || "Select a section first"}
              </div>
            </div>
            <div className="text-center text-muted" style={{ marginTop: "var(--space-sm)" }}>
              <p className="text-sm" style={{ lineHeight: 1.5, margin: 0 }}>
                Click <strong>Place on Map</strong> and you will then drop a marker on the map and drag it to fine-tune the exact location before saving.
              </p>
            </div>
          </form>
        </Modal>
      )}

      {/* Unplaced plots modal */}
      {unplacedOpen && (
        <Modal title={`Unplaced plots (${unpinned.length})`} onClose={() => setUnplacedOpen(false)}>
          <p className="text-sm text-muted" style={{ marginBottom: "var(--space-sm)" }}>
            These plots have no GPS location yet. Pick one, then drop its marker on the map.
          </p>
          <div className="flex flex-col gap-xs" style={{ maxHeight: 360, overflowY: "auto" }}>
            {unpinned.length === 0 && <div className="text-sm text-muted">All plots have a location. 🎉</div>}
            {unpinned.map((p) => (
              <button
                key={p.id}
                className="btn btn-ghost btn-sm flex items-center justify-between"
                onClick={() => { setUnplacedOpen(false); startPlacing(p); }}
                style={{ width: "100%", textAlign: "left" }}
              >
                <span>
                  <strong>{p.plotNumber}</strong>
                  <span className="text-xs text-muted"> — {p.locationDetail?.location?.name || "—"}{p.locationDetail?.subsection ? ` / ${p.locationDetail.subsection}` : ""}</span>
                </span>
                <Crosshair size={14} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Plot Details modal (view mode, on marker click) */}
      {detailsPlot && !pending && !editing && (
        <Modal title="Plot Details" onClose={() => { setDetailsPlot(null); setRouteCoords(null); }}>
          <div className="flex flex-col gap-sm">
            <div><div className="form-label">Plot Number</div><div style={{ fontWeight: 600 }}>{detailsPlot.plotNumber}</div></div>
            <div><div className="form-label">Location</div><div>{detailsPlot.locationDetail?.location?.name || "—"}</div></div>
            <div><div className="form-label">Section</div><div>{detailsPlot.locationDetail?.subsection || "—"}</div></div>
            <div>
              <div className="form-label">Status</div>
              <span className={`badge ${
                detailsPlot.status === "available" ? "badge-success"
                  : detailsPlot.status === "occupied" ? "badge-danger"
                  : detailsPlot.status === "reserved" ? "badge-warning" : "badge-info"
              }`}>{detailsPlot.status}</span>
            </div>
            <div>
              <div className="form-label">GPS Coordinates</div>
              <div className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>
                {hasGps(detailsPlot) ? `${Number(detailsPlot.gpsLat).toFixed(6)}, ${Number(detailsPlot.gpsLng).toFixed(6)}` : "Not set"}
              </div>
            </div>
            {detailsPlot.graves?.length > 0 && (
              <div>
                <div className="form-label">Occupant(s)</div>
                {detailsPlot.graves.map((g) => (<div key={g.id} className="text-sm">{g.deceasedName}</div>))}
              </div>
            )}
          </div>

          {isAdmin && (
            <div style={{ marginTop: "var(--space-md)" }}>
              <button className="btn btn-primary btn-sm flex items-center gap-xs" onClick={() => startPlacing(detailsPlot)}>
                <Crosshair size={15} /> {hasGps(detailsPlot) ? "Edit location" : "Set location"}
              </button>
            </div>
          )}

          <NavigationOverlay
            key={detailsPlot.id}
            destination={detailsDestination}
            onRouteChange={setRouteCoords}
            plotId={detailsPlot.id}
            channel="dashboard"
            authenticated={Boolean(session?.user)}
          />
        </Modal>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="spinner spinner-lg" />}>
      <MapPageInner />
    </Suspense>
  );
}
