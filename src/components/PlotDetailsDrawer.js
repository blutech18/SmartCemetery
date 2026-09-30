"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  MapPin,
  Compass,
  Layers,
  ChevronRight,
  ChevronLeft,
  Navigation,
  CheckCircle2,
  Clock,
  User,
  Phone,
  FileText,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  Crosshair,
  ExternalLink,
  Search,
  Camera,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import NavigationOverlay from "./NavigationOverlay";
import {
  getInitials,
  formatPlotDate,
  extractPlotTiers,
  getPlotSummaryNames,
  getGravePhoto,
} from "@/lib/plot-format";

// Re-exported for backwards compatibility; the canonical definitions live in
// src/lib/plot-format.js and are unit-tested there.
export {
  formatPlotDate,
  extractPlotTiers,
  statusMeta,
  getPlotSummaryNames,
  getGravePhoto,
} from "@/lib/plot-format";

export default function PlotDetailsDrawer({
  plot,
  allPlots = [],
  isOpen = true,
  onClose,
  onToggleCollapse,
  isCollapsed = false,
  onSelectPlot,
  onRouteChange,
  onRelocatePlot,
  onUpdatePlot,
  activeRoute = false,
  isAdmin = false,
  authenticated = false,
}) {
  const getInitialTierIndex = (tierList, query = "") => {
    if (!tierList || tierList.length === 0) return 0;
    const q = query.trim().toLowerCase();
    if (q) {
      const matchIdx = tierList.findIndex((t) => t.deceasedName?.toLowerCase().includes(q));
      if (matchIdx !== -1) return matchIdx;
    }
    const occupiedIdx = tierList.findIndex((t) => t.status === "occupied" || t.deceasedName);
    return occupiedIdx !== -1 ? occupiedIdx : 0;
  };

  const [selectedTierIndex, setSelectedTierIndex] = useState(() => {
    const list = extractPlotTiers(plot);
    const sorted = [...list].sort((a, b) => b.tier - a.tier);
    return getInitialTierIndex(sorted);
  });
  const [copiedGps, setCopiedGps] = useState(false);
  const [isLight, setIsLight] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const lastPlotIdRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  // Debounce the raw query so typing does not re-scan the whole registry on
  // every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Precompute one lowercase searchable string per plot (plot number, status,
  // grave names and tier names) once per `allPlots` identity, instead of
  // JSON-parsing every plot's notes on each keystroke.
  const searchIndex = useMemo(
    () =>
      allPlots.map((p) => {
        const parts = [p.plotNumber, p.status];
        for (const g of p.graves || []) parts.push(g.deceasedName);
        for (const tier of extractPlotTiers(p)) parts.push(tier.deceasedName);
        return { plot: p, haystack: parts.filter(Boolean).join(" ").toLowerCase() };
      }),
    [allPlots]
  );

  const searchResults = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((entry) => entry.haystack.includes(q))
      .map((entry) => entry.plot);
  }, [searchIndex, debouncedQuery]);

  // One pass over allPlots for the empty-state summary card.
  const summaryCounts = useMemo(() => {
    let occupied = 0;
    let available = 0;
    for (const p of allPlots) {
      if (p.status === "occupied") occupied += 1;
      else if (p.status === "available") available += 1;
    }
    return { total: allPlots.length, occupied, available };
  }, [allPlots]);

  useEffect(() => {
    const updateTheme = () => {
      const themeAttr = document.documentElement.getAttribute("data-theme");
      setIsLight(themeAttr === "light");
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const activePlot = plot;

  // Photo modal state
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoModalTier, setPhotoModalTier] = useState(null);
  const [photoModalApplyToAll, setPhotoModalApplyToAll] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Occupy tier modal state
  const [showOccupyModal, setShowOccupyModal] = useState(false);
  const [selectedGraveId, setSelectedGraveId] = useState("");
  const [occupyError, setOccupyError] = useState("");
  const [occupying, setOccupying] = useState(false);
  const [occupySearchQuery, setOccupySearchQuery] = useState("");
  const [occupyDropdownOpen, setOccupyDropdownOpen] = useState(false);

  // Extract tiers for current plot
  const tiers = useMemo(() => {
    const list = extractPlotTiers(activePlot);
    // Sort from Top (Tier 4) to Bottom (Tier 1) for natural visual stack
    return [...list].sort((a, b) => b.tier - a.tier);
  }, [activePlot]);

  // Reset the selected tier when a different plot is selected or on mount.
  // Defaults to the occupied tier or matching search occupant.
  useEffect(() => {
    if (!activePlot) {
      lastPlotIdRef.current = null;
      return;
    }
    const plotKey = activePlot.id != null ? String(activePlot.id) : (activePlot.plotNumber || "unknown");
    if (plotKey === lastPlotIdRef.current) return;
    lastPlotIdRef.current = plotKey;
    const q = (debouncedQuery || searchQuery || "").trim().toLowerCase();
    const nextIdx = getInitialTierIndex(tiers, q);
    setSelectedTierIndex((prev) => (prev === nextIdx ? prev : nextIdx));
  }, [activePlot, tiers, debouncedQuery, searchQuery]);

  const currentTier = tiers[selectedTierIndex] || tiers[0] || null;
  const primaryGrave = activePlot?.graves?.[0];
  const structurePhoto = getGravePhoto(primaryGrave) || activePlot?.photo || null;
  // Multi-tier structures (like 4-tier crypt stacks) do not share photos across tiers.
  // Each tier shows its own photo, or falls back to the default headstone placeholder.
  const bannerPhoto =
    currentTier?.photo ||
    (tiers.length > 1
      ? (activePlot?.photo || "/images/memorial_headstone.jpg")
      : (structurePhoto || "/images/memorial_headstone.jpg"));

  const handleOpenPhotoModal = () => {
    setPhotoModalTier(currentTier?.tier || 1);
    setPhotoModalApplyToAll(false);
    setPhotoFile(null);
    const currentPhoto =
      currentTier?.photo ||
      (tiers.length > 1 ? "" : (structurePhoto || ""));
    setPhotoUrlInput(currentPhoto);
    setPhotoPreview(currentPhoto);
    setPhotoError("");
    setShowPhotoModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image size must be less than 5MB");
      return;
    }
    setPhotoError("");
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!activePlot) return;
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      const tierGrave = activePlot.graves?.find(
        (g) => (Number(g.tier) || 1) === (photoModalTier || currentTier?.tier || 1)
      );
      const graveId = tierGrave?.id || activePlot.graves?.[0]?.id;
      const endpoint = graveId
        ? `/api/graves/${graveId}/photo`
        : `/api/plots/${activePlot.id}/photo`;

      let res;
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        if (photoModalTier != null) fd.append("tier", String(photoModalTier));
        if (photoModalApplyToAll) fd.append("applyToAll", "true");
        res = await fetch(endpoint, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoUrl: photoUrlInput,
            tier: photoModalTier,
            applyToAll: photoModalApplyToAll,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update photo");
      }

      // Update local plot state
      const updatedPlot = JSON.parse(JSON.stringify(activePlot));
      if (!updatedPlot.graves || updatedPlot.graves.length === 0) {
        updatedPlot.graves = [{ id: data.graveId || 0, details: { notes: data.notes } }];
      } else {
        if (!updatedPlot.graves[0].details) updatedPlot.graves[0].details = {};
        updatedPlot.graves[0].details.notes = data.notes;
      }
      if (photoModalApplyToAll || !updatedPlot.photo) {
        updatedPlot.photo = data.photoUrl;
      }

      if (typeof onUpdatePlot === "function") {
        onUpdatePlot(updatedPlot);
      }
      setShowPhotoModal(false);
      toast.success(data.message || "Photo updated successfully");
    } catch (err) {
      console.error(err);
      setPhotoError(err.message || "Failed to save photo");
      toast.error(err.message || "Failed to save photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const copyGpsToClipboard = () => {
    if (plot?.gpsLat == null || plot?.gpsLng == null) return;
    try {
      const pending = navigator.clipboard?.writeText(`${plot.gpsLat}, ${plot.gpsLng}`);
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — ignore.
    }
    setCopiedGps(true);
    clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedGps(false), 2000);
  };

  // Clear the copy-feedback timer if the drawer unmounts mid-timeout.
  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  const occupiedTiersCount = tiers.filter((t) => t.status === "occupied").length;
  const totalTiersCount = tiers.length;

  return (
    <div
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        bottom: 0,
        width: isCollapsed ? 0 : "min(410px, 94vw)",
        zIndex: 500,
        pointerEvents: !isOpen ? "none" : "auto",
        transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), width 0.28s ease",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        display: "flex",
      }}
    >
      {/* Main Drawer Panel */}
      <div
        aria-hidden={isCollapsed ? true : undefined}
        inert={isCollapsed ? true : undefined}
        style={{
          width: "100%",
          height: "100%",
          background: isLight ? "#ffffff" : "rgba(15, 23, 42, 0.98)",
          borderRight: isCollapsed ? "none" : isLight ? "1px solid #e5e7eb" : "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: isCollapsed ? "none" : isLight ? "8px 0 28px rgba(0, 0, 0, 0.08)" : "8px 0 32px rgba(0, 0, 0, 0.55)",
          display: "flex",
          flexDirection: "column",
          color: isLight ? "#111827" : "#f8fafc",
          overflow: "hidden",
          pointerEvents: isCollapsed ? "none" : "auto",
        }}
      >
        {/* Top Header: Always Consistent Search Bar */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255, 255, 255, 0.08)",
            background: isLight ? "#ffffff" : "rgba(30, 41, 59, 0.75)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              background: isLight ? "#f9fafb" : "rgba(255, 255, 255, 0.05)",
              border: isLight ? "1.5px solid #cbd5e1" : "1.5px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 8,
              padding: "6px 10px",
              boxShadow: isLight ? "0 1px 2px rgba(0, 0, 0, 0.04)" : "none",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            {activePlot && !searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  if (typeof onSelectPlot === "function") {
                    onSelectPlot(null);
                  }
                  setSearchQuery("");
                }}
                title="Back to cemetery overview"
                aria-label="Back to cemetery overview"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isLight ? "#0284c7" : "#38bdf8",
                  padding: 2,
                  marginRight: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <Search
                size={16}
                style={{
                  color: isLight ? "#64748b" : "#94a3b8",
                  marginRight: 8,
                  flexShrink: 0,
                }}
              />
            )}

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deceased or plot #..."
              aria-label="Search deceased or plot number"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "0.88rem",
                color: isLight ? "#111827" : "#f8fafc",
                padding: 0,
                minWidth: 0,
              }}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                aria-label="Clear search"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: isLight ? "#9ca3af" : "#94a3b8",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close drawer"
            aria-label="Close drawer"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: isLight ? "#9ca3af" : "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              marginLeft: 4,
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {activePlot && !searchQuery.trim() ? (
            <>
              {/* Photo: Cemetery Memorial Headstone / Monument */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 195,
                  background: isLight ? "#f3f4f6" : "#1e293b",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerPhoto}
                  alt={currentTier?.deceasedName || "Memorial plot"}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Never leave a broken image; fall back to the bundled
                    // memorial headstone once (guard against a loop if the
                    // fallback itself fails to load).
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/images/memorial_headstone.jpg";
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />

                {/* Admin/Staff Photo Change Button Overlay */}
                {(isAdmin || authenticated) && (
                  <button
                    type="button"
                    onClick={handleOpenPhotoModal}
                    title="Change Grave / Crypt Photo"
                    aria-label="Change Grave Photo"
                    style={{
                      position: "absolute",
                      bottom: 10,
                      right: 10,
                      background: isLight ? "rgba(255, 255, 255, 0.92)" : "rgba(15, 23, 42, 0.88)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      color: isLight ? "#1e293b" : "#f8fafc",
                      border: isLight ? "1px solid rgba(0, 0, 0, 0.15)" : "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: 20,
                      padding: "5px 12px",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
                      transition: "all 0.15s ease",
                      zIndex: 10,
                    }}
                  >
                    <Camera size={13} style={{ color: isLight ? "#0284c7" : "#38bdf8" }} />
                    <span>Change Photo</span>
                  </button>
                )}
              </div>

              {/* Multi-Grave / Plot Row Switcher Tabs */}
              {tiers.length > 1 && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: isLight ? "#f9fafb" : "rgba(30, 41, 59, 0.45)",
                    borderBottom: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: isLight ? "#6b7280" : "#94a3b8",
                      }}
                    >
                      Graves in Plot Row ({occupiedTiersCount}/{totalTiersCount} Occupied)
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: isLight ? "#0284c7" : "#38bdf8",
                        fontWeight: 600,
                      }}
                    >
                      4-Tier Crypt Stack
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${tiers.length}, 1fr)`,
                      gap: 6,
                    }}
                  >
                    {tiers.map((tier, idx) => {
                      const isSelected = selectedTierIndex === idx;
                      const isOccupied = tier.status === "occupied";
                      return (
                        <button
                          key={tier.tier}
                          type="button"
                          onClick={() => setSelectedTierIndex(idx)}
                          style={{
                            padding: "6px 4px",
                            borderRadius: 6,
                            border: isSelected
                              ? isLight
                                ? "1.5px solid #0284c7"
                                : "1.5px solid #38bdf8"
                              : isLight
                              ? "1px solid #e5e7eb"
                              : "1px solid rgba(255, 255, 255, 0.1)",
                            background: isSelected
                              ? isLight
                                ? "#e0f2fe"
                                : "rgba(56, 189, 248, 0.2)"
                              : isLight
                              ? "#ffffff"
                              : "rgba(255, 255, 255, 0.04)",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: isOccupied
                                  ? "#ef4444"
                                  : tier.status === "available"
                                  ? "#22c55e"
                                  : "#f59e0b",
                              }}
                            />
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                color: isSelected
                                  ? isLight
                                    ? "#0369a1"
                                    : "#38bdf8"
                                  : isLight
                                  ? "#374151"
                                  : "#cbd5e1",
                              }}
                            >
                              T{tier.tier}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: isLight ? "#4b5563" : "#94a3b8",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "100%",
                              fontWeight: isOccupied ? 600 : 400,
                            }}
                            title={tier.deceasedName || "Vacant"}
                          >
                            {tier.deceasedName ? tier.deceasedName.split(" ")[0] : "Vacant"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Occupy This Tier button — shown when current tier is vacant */}
              {(isAdmin || authenticated) && currentTier?.status === "available" && (
                <div style={{ padding: "0 18px", marginBottom: 14, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGraveId("");
                      setOccupyError("");
                      setShowOccupyModal(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: isLight ? "#dcfce7" : "rgba(34, 197, 94, 0.15)",
                      color: isLight ? "#15803d" : "#86efac",
                      border: isLight ? "1px solid #86efac" : "1px solid rgba(34, 197, 94, 0.3)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Occupy {currentTier?.label || `Tier ${currentTier?.tier}`}</span>
                  </button>
                </div>
              )}

              {/* Centered Burial Identity Block */}
              <div style={{ textAlign: "center", padding: "18px 18px 12px 18px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: isLight ? "#4b5563" : "#94a3b8",
                    marginBottom: 4,
                  }}
                >
                  <User size={14} />
                  <span>Burial</span>
                  {currentTier?.status && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 6px",
                        borderRadius: 9999,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        marginLeft: 4,
                        background: isLight
                          ? currentTier.status === "occupied"
                            ? "#fef2f2"
                            : currentTier.status === "available"
                            ? "#f0fdf4"
                            : "#fffbeb"
                          : currentTier.status === "occupied"
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(34, 197, 94, 0.2)",
                        color: isLight
                          ? currentTier.status === "occupied"
                            ? "#dc2626"
                            : currentTier.status === "available"
                            ? "#16a34a"
                            : "#b45309"
                          : currentTier.status === "occupied"
                            ? "#fca5a5"
                            : "#86efac",
                      }}
                    >
                      {currentTier.status}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    margin: "4px 0 6px 0",
                    fontSize: "1.45rem",
                    fontWeight: 700,
                    color: isLight ? "#111827" : "#ffffff",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {currentTier?.deceasedName || "Unoccupied Crypt Niche"}
                </h2>

                <div
                  style={{
                    fontSize: "0.85rem",
                    color: isLight ? "#4b5563" : "#94a3b8",
                    marginBottom: 6,
                  }}
                >
                  {plot.locationDetail?.location?.name || "City Memorial Park"} / {plot.plotNumber} / {currentTier?.label || `Grave ${currentTier?.tier}`}
                </div>

                {plot.gpsLat && plot.gpsLng && (
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: "0.78rem",
                      color: isLight ? "#6b7280" : "#94a3b8",
                      fontFamily: "monospace",
                      fontStyle: "italic",
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                    }}
                    onClick={copyGpsToClipboard}
                    title="Click to copy GPS"
                    aria-label="Copy GPS coordinates"
                  >
                    <span>
                      {Number(plot.gpsLat).toFixed(8)}, {Number(plot.gpsLng).toFixed(8)}
                    </span>
                    {copiedGps ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    <span className="sr-only" aria-live="polite">
                      {copiedGps ? "Coordinates copied" : ""}
                    </span>
                  </button>
                )}
              </div>

              {/* Thin Divider */}
              <div
                style={{
                  height: 1,
                  background: isLight ? "#e5e7eb" : "rgba(255, 255, 255, 0.08)",
                  margin: "4px 18px 16px 18px",
                }}
              />

              {/* Deceased Section */}
              <div style={{ padding: "0 18px", marginBottom: 16 }}>
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    margin: "0 0 10px 0",
                    color: isLight ? "#111827" : "#f8fafc",
                  }}
                >
                  Deceased
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "8px 12px", fontSize: "0.84rem" }}>
                  <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Date of Birth:</span>
                  <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                    {(currentTier?.birthDate || currentTier?.dateOfBirth) ? formatPlotDate(currentTier.birthDate || currentTier.dateOfBirth) : "—"}
                  </span>

                  <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Date of Death:</span>
                  <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                    {(currentTier?.deathDate || currentTier?.dateOfDeath) ? formatPlotDate(currentTier.deathDate || currentTier.dateOfDeath) : "—"}
                  </span>

                  <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Date of Burial:</span>
                  <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                    {currentTier?.burialDate ? formatPlotDate(currentTier.burialDate) : "—"}
                  </span>

                  {currentTier?.causeOfDeath && (
                    <>
                      <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Cause of Death:</span>
                      <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                        {currentTier.causeOfDeath}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Additional Information Section */}
              <div style={{ padding: "0 18px", marginBottom: 16 }}>
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    margin: "0 0 10px 0",
                    color: isLight ? "#111827" : "#f8fafc",
                  }}
                >
                  Additional Information
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 12px", fontSize: "0.84rem" }}>
                  <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Crypt Niche Tier:</span>
                  <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                    {currentTier?.label || `Tier ${currentTier?.tier}`}
                  </span>

                  <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Plot Status:</span>
                  <span
                    style={{
                      color: isLight
                        ? currentTier?.status === "occupied"
                          ? "#dc2626"
                          : "#16a34a"
                        : "#38bdf8",
                      textAlign: "right",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {currentTier?.status || plot.status}
                  </span>

                  {currentTier?.contactPerson && (
                    <>
                      <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Contact Person:</span>
                      <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                        {currentTier.contactPerson}
                      </span>
                    </>
                  )}

                  {currentTier?.contactPhone && (
                    <>
                      <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Contact Phone:</span>
                      <span style={{ color: isLight ? "#111827" : "#e2e8f0", textAlign: "right" }}>
                        {currentTier.contactPhone}
                      </span>
                    </>
                  )}

                  {currentTier?.notes && (
                    <>
                      <span style={{ color: isLight ? "#6b7280" : "#94a3b8" }}>Memorial Inscription:</span>
                      <span
                        style={{
                          color: isLight ? "#374151" : "#cbd5e1",
                          textAlign: "right",
                          fontStyle: "italic",
                        }}
                      >
                        “{currentTier.notes}”
                      </span>
                    </>
                  )}
                </div>
              </div>


              {/* Walking Directions & Actions */}
              {plot.gpsLat && plot.gpsLng && (
                <div style={{ padding: "0 18px", marginBottom: 14 }}>
                  <div
                    style={{
                      background: isLight ? "#f9fafb" : "rgba(15, 23, 42, 0.65)",
                      border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: isLight ? "#0284c7" : "#38bdf8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Navigation size={13} />
                      <span>Walking Directions to Plot</span>
                    </div>
                    <NavigationOverlay
                      key={plot.id}
                      destination={{ lat: Number(plot.gpsLat), lng: Number(plot.gpsLng) }}
                      onRouteChange={onRouteChange}
                      plotId={plot.id}
                      channel="dashboard"
                      authenticated={authenticated}
                      hideTitle
                      flat
                    />
                  </div>
                </div>
              )}

              {isAdmin && (
                <div style={{ padding: "0 18px", marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof onRelocatePlot === "function") {
                        onRelocatePlot(plot);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      borderRadius: 8,
                      background: isLight ? "#f3f4f6" : "rgba(255, 255, 255, 0.08)",
                      color: isLight ? "#374151" : "#cbd5e1",
                      border: isLight ? "1px solid #d1d5db" : "1px solid rgba(255, 255, 255, 0.12)",
                      fontWeight: 500,
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Crosshair size={14} />
                    <span>Relocate Pin on Map (Admin)</span>
                  </button>
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  padding: "14px 18px",
                  borderTop: isLight ? "1px solid #f3f4f6" : "1px solid rgba(255, 255, 255, 0.06)",
                  textAlign: "center",
                  fontSize: "0.72rem",
                  color: isLight ? "#9ca3af" : "#64748b",
                  marginTop: "auto",
                }}
              >
                City Memorial Park • Smart Cemetery System
              </div>
            </>
          ) : searchQuery.trim() !== "" ? (
            /* Search results list */
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: isLight ? "#6b7280" : "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {searchResults.length} {searchResults.length === 1 ? "Result" : "Results"} Found
              </div>

              {searchResults.length === 0 ? (
                <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: isLight ? "#64748b" : "#94a3b8" }}>
                  <Search size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", color: isLight ? "#111827" : "#f8fafc", marginBottom: 6 }}>
                    No results found
                  </div>
                  <p style={{ fontSize: "0.82rem", margin: 0 }}>
                    No records matching “{searchQuery}”. Try searching by last name, first name, or plot code.
                  </p>
                </div>
              ) : (
                searchResults.map((resultPlot) => {
                  const names = getPlotSummaryNames(resultPlot);
                  const isOccupied = resultPlot.status === "occupied";
                  const isAvailable = resultPlot.status === "available";

                  return (
                    <button
                      type="button"
                      key={resultPlot.id ?? resultPlot.plotNumber}
                      onClick={() => {
                        if (typeof onSelectPlot === "function") {
                          onSelectPlot(resultPlot);
                        }
                        setSearchQuery("");
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: isLight ? "#f9fafb" : "rgba(255, 255, 255, 0.03)",
                        border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255, 255, 255, 0.08)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.15s ease",
                        width: "100%",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isLight ? "#0284c7" : "#38bdf8";
                        e.currentTarget.style.background = isLight ? "#f0f9ff" : "rgba(56, 189, 248, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isLight ? "#e5e7eb" : "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.background = isLight ? "#f9fafb" : "rgba(255, 255, 255, 0.03)";
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: isLight ? "#111827" : "#f8fafc",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {names[0] || `Plot ${resultPlot.plotNumber}`}
                        </div>
                        {names[1] && (
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: isLight ? "#4b5563" : "#cbd5e1",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {names[1]}
                          </div>
                        )}
                        <div style={{ fontSize: "0.72rem", color: isLight ? "#6b7280" : "#94a3b8", marginTop: 2 }}>
                          Plot {resultPlot.plotNumber}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "3px 7px",
                          borderRadius: 4,
                          flexShrink: 0,
                          background: isLight
                            ? (isOccupied ? "#fef2f2" : isAvailable ? "#f0fdf4" : "#fffbeb")
                            : (isOccupied ? "rgba(239, 68, 68, 0.25)" : isAvailable ? "rgba(34, 197, 94, 0.25)" : "rgba(245, 158, 11, 0.25)"),
                          color: isLight
                            ? (isOccupied ? "#b91c1c" : isAvailable ? "#15803d" : "#b45309")
                            : (isOccupied ? "#fca5a5" : isAvailable ? "#86efac" : "#fde047"),
                        }}
                      >
                        {resultPlot.status}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* Empty state when no plot is selected and search is empty */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "2.5rem 1.5rem",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: isLight ? "#e0f2fe" : "rgba(56, 189, 248, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isLight ? "#0284c7" : "#38bdf8",
                }}
              >
                <Search size={26} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: isLight ? "#111827" : "#ffffff", fontSize: "1.05rem", marginBottom: 6 }}>
                  Search Cemetery Records
                </div>
                <p style={{ fontSize: "0.82rem", lineHeight: 1.5, color: isLight ? "#64748b" : "#94a3b8", margin: 0, maxWidth: 290 }}>
                  Type a name or plot number in the search bar above, or click on any plot marker on the map to inspect its details.
                </p>
              </div>

              {/* Quick cemetery summary card */}
              <div
                style={{
                  width: "100%",
                  background: isLight ? "#f9fafb" : "rgba(255, 255, 255, 0.03)",
                  border: isLight ? "1px solid #e5e7eb" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: isLight ? "#111827" : "#f8fafc" }}>
                    {summaryCounts.total}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: isLight ? "#6b7280" : "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                    Total Plots
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ef4444" }}>
                    {summaryCounts.occupied}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: isLight ? "#6b7280" : "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                    Occupied
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#22c55e" }}>
                    {summaryCounts.available}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: isLight ? "#6b7280" : "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                    Available
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapse / Expand Toggle Button Tab (< / >) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (typeof onToggleCollapse === "function") {
            onToggleCollapse();
          }
        }}
        title={isCollapsed ? "Expand Details Drawer" : "Collapse Drawer"}
        aria-label={isCollapsed ? "Expand Details Drawer" : "Collapse Drawer"}
        style={{
          position: "absolute",
          top: "50%",
          right: -28,
          transform: "translateY(-50%)",
          width: 28,
          height: 56,
          background: isLight ? "#ffffff" : "rgba(15, 23, 42, 0.95)",
          borderTop: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
          borderRight: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
          borderBottom: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
          borderLeft: "none",
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
          color: isLight ? "#0f172a" : "#ffffff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isLight ? "4px 0 16px rgba(0,0,0,0.12)" : "4px 0 16px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
          zIndex: 520,
          transition: "background 0.2s ease, transform 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = isLight ? "#f1f5f9" : "#1e293b")}
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.95)")
        }
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* ─── Change Photo Modal ─── */}
      {showPhotoModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !uploadingPhoto && setShowPhotoModal(false)}
        >
          <div
            style={{
              background: isLight ? "#ffffff" : "#0f172a",
              color: isLight ? "#0f172a" : "#f8fafc",
              border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 12,
              padding: 20,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: isLight ? "#e0f2fe" : "rgba(56, 189, 248, 0.15)",
                    color: isLight ? "#0284c7" : "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
                    Change Profile Photo
                  </h3>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: isLight ? "#64748b" : "#94a3b8" }}>
                    {activePlot?.plotNumber} {currentTier?.label ? `• ${currentTier.label}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                disabled={uploadingPhoto}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: isLight ? "#94a3b8" : "#64748b",
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Scope if multi-tier */}
            {tiers.length > 1 && (
              <div
                style={{
                  background: isLight ? "#f8fafc" : "rgba(255, 255, 255, 0.04)",
                  border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ fontWeight: 600, color: isLight ? "#475569" : "#cbd5e1" }}>
                  Photo Assignment Scope:
                </span>
                <div style={{ display: "flex", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="photoScope"
                      checked={!photoModalApplyToAll}
                      onChange={() => setPhotoModalApplyToAll(false)}
                    />
                    <span>This Tier ({currentTier?.label || `Tier ${photoModalTier}`})</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="photoScope"
                      checked={photoModalApplyToAll}
                      onChange={() => setPhotoModalApplyToAll(true)}
                    />
                    <span>All Tiers / Entire Crypt</span>
                  </label>
                </div>
              </div>
            )}

            {/* Preview Box */}
            <div
              style={{
                width: "100%",
                height: 160,
                borderRadius: 8,
                overflow: "hidden",
                border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                background: isLight ? "#f1f5f9" : "#020617",
                position: "relative",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview || "/images/memorial_headstone.jpg"}
                alt="Photo preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.currentTarget.src = "/images/memorial_headstone.jpg";
                }}
              />
              {photoPreview && photoPreview !== "/images/memorial_headstone.jpg" && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(0, 0, 0, 0.7)",
                    color: "#ffffff",
                    fontSize: "0.65rem",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                >
                  Custom Photo Preview
                </div>
              )}
            </div>

            {/* File Upload Input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: isLight ? "#475569" : "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                Upload from Device:
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={uploadingPhoto}
                style={{
                  fontSize: "0.75rem",
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  background: isLight ? "#f8fafc" : "#1e293b",
                  color: isLight ? "#1e293b" : "#f8fafc",
                }}
              />
              <span style={{ fontSize: "0.67rem", color: isLight ? "#94a3b8" : "#64748b" }}>
                Supports JPG, PNG, WebP up to 5MB
              </span>
            </div>

            {/* Direct URL Input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: isLight ? "#475569" : "#cbd5e1",
                  marginBottom: 6,
                }}
              >
                Or Paste Image URL:
              </label>
              <input
                type="text"
                placeholder="https://example.com/photo.jpg or /images/..."
                value={photoUrlInput}
                onChange={(e) => {
                  setPhotoFile(null);
                  setPhotoUrlInput(e.target.value);
                  setPhotoPreview(e.target.value);
                }}
                disabled={uploadingPhoto}
                style={{
                  fontSize: "0.78rem",
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  background: isLight ? "#f8fafc" : "#1e293b",
                  color: isLight ? "#1e293b" : "#f8fafc",
                }}
              />
            </div>

            {photoError && (
              <div style={{ color: "#ef4444", fontSize: "0.72rem", fontWeight: 600 }}>
                {photoError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoUrlInput("");
                  setPhotoPreview("/images/memorial_headstone.jpg");
                }}
                disabled={uploadingPhoto}
                style={{
                  padding: "7px 12px",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  borderRadius: 6,
                  border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  background: "transparent",
                  color: isLight ? "#64748b" : "#94a3b8",
                  cursor: "pointer",
                }}
              >
                Reset Default
              </button>

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                disabled={uploadingPhoto}
                style={{
                  padding: "7px 14px",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  borderRadius: 6,
                  border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                  background: isLight ? "#f1f5f9" : "#1e293b",
                  color: isLight ? "#1e293b" : "#f8fafc",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSavePhoto}
                disabled={uploadingPhoto}
                style={{
                  padding: "7px 16px",
                  fontSize: "0.74rem",
                  fontWeight: 700,
                  borderRadius: 6,
                  border: "none",
                  background: "#0284c7",
                  color: "#ffffff",
                  cursor: uploadingPhoto ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.4)",
                  opacity: uploadingPhoto ? 0.7 : 1,
                }}
              >
                <Check size={14} />
                <span>{uploadingPhoto ? "Saving..." : "Save Photo"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Occupy Tier Modal ─── */}
      {showOccupyModal && (() => {
        const allGraves = [];
        const seenGraveIds = new Set();
        for (const p of allPlots) {
          for (const g of p.graves || []) {
            // Skip archived graves — they cannot be updated or transferred
            if (!g || !g.id || g.status === "archived") continue;
            if (seenGraveIds.has(g.id)) continue;
            seenGraveIds.add(g.id);
            allGraves.push({
              id: g.id,
              deceasedName: g.deceasedName,
              plotNumber: p.plotNumber,
              tier: g.tier || 1,
              status: g.status,
              burialDate: g.burialDate,
            });
          }
        }
        // Sort: vacant first, then by name
        allGraves.sort((a, b) => {
          const aOcc = a.status === "active" ? 1 : 0;
          const bOcc = b.status === "active" ? 1 : 0;
          if (aOcc !== bOcc) return aOcc - bOcc;
          return a.deceasedName.localeCompare(b.deceasedName);
        });

        const selectedGrave = allGraves.find((g) => g.id === Number(selectedGraveId));

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(5px)",
              WebkitBackdropFilter: "blur(5px)",
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
            onClick={() => !occupying && setShowOccupyModal(false)}
          >
            <div
              style={{
                background: isLight ? "#ffffff" : "#0f172a",
                color: isLight ? "#0f172a" : "#f8fafc",
                border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 12,
                padding: "18px 20px",
                maxWidth: 440,
                width: "100%",
                maxHeight: "calc(100vh - 32px)",
                overflowY: "auto",
                boxSizing: "border-box",
                boxShadow: "0 20px 45px rgba(0, 0, 0, 0.5)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: isLight ? "#dcfce7" : "rgba(34, 197, 94, 0.15)",
                      color: isLight ? "#15803d" : "#86efac",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
                      Occupy {currentTier?.label || `Tier ${currentTier?.tier}`}
                    </h3>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: isLight ? "#64748b" : "#94a3b8" }}>
                      {activePlot?.plotNumber} • Select a grave to assign
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOccupyModal(false)}
                  disabled={occupying}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: isLight ? "#94a3b8" : "#64748b",
                    padding: 4,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Searchable Dropdown */}
              <div style={{ position: "relative" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    color: isLight ? "#475569" : "#cbd5e1",
                    marginBottom: 4,
                  }}
                >
                  Select Grave <span style={{ color: "#ef4444" }}>*</span>
                </label>

                {/* Trigger input */}
                <div
                  onClick={() => !occupying && setOccupyDropdownOpen(!occupyDropdownOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                    background: isLight ? "#f8fafc" : "#1e293b",
                    cursor: occupying ? "default" : "pointer",
                    opacity: occupying ? 0.7 : 1,
                  }}
                >
                  <Search size={14} style={{ color: isLight ? "#94a3b8" : "#64748b", flexShrink: 0 }} />
                  <input
                    type="text"
                    value={occupyDropdownOpen ? occupySearchQuery : (selectedGrave ? `${selectedGrave.deceasedName} — Plot ${selectedGrave.plotNumber}, Tier ${selectedGrave.tier}` : "")}
                    onChange={(e) => {
                      setOccupySearchQuery(e.target.value);
                      setOccupyDropdownOpen(true);
                      setSelectedGraveId("");
                    }}
                    onFocus={() => setOccupyDropdownOpen(true)}
                    placeholder="Search by name or plot..."
                    disabled={occupying}
                    style={{
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      fontSize: "0.82rem",
                      color: isLight ? "#1e293b" : "#f8fafc",
                      padding: 0,
                      minWidth: 0,
                    }}
                  />
                  {occupyDropdownOpen && occupySearchQuery && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOccupySearchQuery("");
                        setSelectedGraveId("");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: isLight ? "#94a3b8" : "#64748b",
                        padding: 2,
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {occupyDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: isLight ? "#ffffff" : "#1e293b",
                      border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: 8,
                      boxShadow: isLight ? "0 8px 24px rgba(0,0,0,0.12)" : "0 8px 24px rgba(0,0,0,0.5)",
                      zIndex: 100,
                      maxHeight: 240,
                      overflowY: "auto",
                    }}
                  >
                    {(() => {
                      const q = occupySearchQuery.trim().toLowerCase();
                      const filtered = q
                        ? allGraves.filter(
                            (g) =>
                              g.deceasedName.toLowerCase().includes(q) ||
                              g.plotNumber.toLowerCase().includes(q)
                          )
                        : allGraves;

                      if (filtered.length === 0) {
                        return (
                          <div
                            style={{
                              padding: "16px 12px",
                              textAlign: "center",
                              color: isLight ? "#94a3b8" : "#64748b",
                              fontSize: "0.78rem",
                            }}
                          >
                            No graves found
                          </div>
                        );
                      }

                      return filtered.map((g) => {
                        const isSelected = g.id === Number(selectedGraveId);
                        const isOccupied = g.status === "active";
                        return (
                          <button
                            key={`occupy-grave-${g.id}`}
                            type="button"
                            onClick={() => {
                              setSelectedGraveId(String(g.id));
                              setOccupyDropdownOpen(false);
                              setOccupySearchQuery("");
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "8px 12px",
                              border: "none",
                              background: isSelected
                                ? isLight
                                  ? "#e0f2fe"
                                  : "rgba(56, 189, 248, 0.15)"
                                : "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                              gap: 8,
                              transition: "background 0.1s ease",
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = isLight ? "#f1f5f9" : "rgba(255,255,255,0.05)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = "transparent";
                              }
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  fontWeight: 600,
                                  color: isLight ? "#1e293b" : "#f8fafc",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {g.deceasedName}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  color: isLight ? "#64748b" : "#94a3b8",
                                  marginTop: 1,
                                }}
                              >
                                Plot {g.plotNumber} • Tier {g.tier}
                              </div>
                            </div>
                            {isOccupied && (
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: isLight ? "#fef3c7" : "rgba(245, 158, 11, 0.2)",
                                  color: isLight ? "#92400e" : "#fbbf24",
                                  flexShrink: 0,
                                }}
                              >
                                Transfer
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                <p style={{ margin: "4px 0 0", fontSize: "0.68rem", color: isLight ? "#94a3b8" : "#64748b" }}>
                  Selecting an occupied grave will transfer it to this tier.
                </p>
              </div>

              {/* Selected grave preview */}
              {selectedGrave && (
                <div
                  style={{
                    background: isLight ? "#f8fafc" : "rgba(255, 255, 255, 0.04)",
                    border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: "0.78rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 700, color: isLight ? "#1e293b" : "#f8fafc" }}>
                    {selectedGrave.deceasedName}
                  </div>
                  <div style={{ color: isLight ? "#64748b" : "#94a3b8" }}>
                    Currently: Plot {selectedGrave.plotNumber}, Tier {selectedGrave.tier}
                  </div>
                  <div style={{ color: isLight ? "#64748b" : "#94a3b8" }}>
                    Will move to: Plot {activePlot?.plotNumber}, Tier {currentTier?.tier}
                  </div>
                  {selectedGrave.status === "active" && (
                    <div style={{ color: "#f59e0b", fontWeight: 600, fontSize: "0.72rem" }}>
                      This grave is currently occupied and will be transferred.
                    </div>
                  )}
                </div>
              )}

              {occupyError && (
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    padding: "8px 10px",
                    background: isLight ? "#fef2f2" : "rgba(239, 68, 68, 0.1)",
                    borderRadius: 6,
                    border: isLight ? "1px solid #fecaca" : "1px solid rgba(239, 68, 68, 0.2)",
                  }}
                >
                  {occupyError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => setShowOccupyModal(false)}
                  disabled={occupying}
                  style={{
                    padding: "7px 14px",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    borderRadius: 6,
                    border: isLight ? "1px solid #cbd5e1" : "1px solid rgba(255, 255, 255, 0.15)",
                    background: isLight ? "#f1f5f9" : "#1e293b",
                    color: isLight ? "#1e293b" : "#f8fafc",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedGraveId) {
                      setOccupyError("Please select a grave");
                      return;
                    }
                    setOccupying(true);
                    setOccupyError("");
                    try {
                      const res = await fetch(`/api/graves/${selectedGraveId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          plotId: activePlot.id,
                          tier: currentTier?.tier || 1,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        throw new Error(data.error?.message || data.error || "Failed to transfer grave");
                      }
                      // Update local plot state
                      const updatedPlot = JSON.parse(JSON.stringify(activePlot));
                      if (!updatedPlot.graves) updatedPlot.graves = [];
                      const tierNum = Number(data.tier) || Number(currentTier?.tier) || 1;
                      updatedPlot.graves = updatedPlot.graves.filter(
                        (g) => (Number(g.tier) || 1) !== tierNum && g.id !== data.id
                      );
                      updatedPlot.graves.push({ ...data, tier: tierNum });
                      updatedPlot.graves.sort((a, b) => (Number(a.tier) || 1) - (Number(b.tier) || 1));
                      if (updatedPlot.status === "available") {
                        updatedPlot.status = "occupied";
                      }
                      if (typeof onUpdatePlot === "function") {
                        onUpdatePlot(updatedPlot);
                      }
                      setShowOccupyModal(false);
                      toast.success(`${currentTier?.label || "Tier"} occupied successfully`);
                    } catch (err) {
                      console.error(err);
                      setOccupyError(err.message || "Failed to occupy tier");
                      toast.error(err.message || "Failed to occupy tier");
                    } finally {
                      setOccupying(false);
                    }
                  }}
                  disabled={occupying || !selectedGraveId}
                  style={{
                    padding: "7px 16px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    borderRadius: 6,
                    border: "none",
                    background: "#16a34a",
                    color: "#ffffff",
                    cursor: occupying || !selectedGraveId ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 2px 6px rgba(22, 163, 74, 0.4)",
                    opacity: occupying || !selectedGraveId ? 0.7 : 1,
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>{occupying ? "Transferring..." : "Occupy Tier"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
