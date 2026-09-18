"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, MarkerF, PolylineF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
import { Check, Compass, ChevronDown } from "lucide-react";
import { getClientMapCenter, getClientGoogleMapsApiKey } from "../lib/config";

function statusColor(status) {
  return status === "available" ? "#2ECC71"
    : status === "occupied" ? "#FF6B6B"
    : status === "reserved" ? "#FFB547"
    : "#4ECDC4";
}

const WRAPPER_STYLE = { position: "relative", width: "100%", height: "100%", borderRadius: "var(--radius-md)", overflow: "hidden" };
const CONTAINER_STYLE = { width: "100%", height: "100%" };

// Base map options. Satellite/hybrid imagery mirrors the manuscript's visual
// map guide while keeping the standard zoom control available for touch.
const BASE_OPTIONS = {
  mapTypeId: "hybrid",
  disableDefaultUI: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  zoomControl: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  maxZoom: 24,
};

// Colored circle symbol equivalent to the previous CircleMarker. Requires the
// Google Maps script to be loaded (callers only render markers when isLoaded).
function circleSymbol(color, selected) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: selected ? "#111111" : "#ffffff",
    strokeWeight: selected ? 3 : 1.5,
    scale: selected ? 9 : 7,
  };
}

// Draggable teardrop pin used for the plot being placed / relocated.
function draftSymbol() {
  return {
    path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
    fillColor: "#2D6CDF",
    fillOpacity: 1,
    strokeColor: "#111111",
    strokeWeight: 2,
    scale: 6,
  };
}

export default function CemeteryMap({
  plots,
  selectedPlot,
  onSelectPlot,
  routeCoords,
  placingMode = false,
  draftMarker = null,
  onMapClick,
  focusPoint = null,
  editable = false,
  onPlotDragEnd,
}) {
  // Map center is sourced from configuration, not hardcoded (Req 13.4).
  const { lat, lng } = getClientMapCenter();
  const center = useMemo(() => ({ lat, lng }), [lat, lng]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "cemetery-google-maps",
    googleMapsApiKey: getClientGoogleMapsApiKey(),
  });

  const [map, setMap] = useState(null);
  const [infoPlot, setInfoPlot] = useState(null);
  const [mapTypeId, setMapTypeId] = useState("hybrid");
  const [showMapMenu, setShowMapMenu] = useState(false);
  const [showSatelliteMenu, setShowSatelliteMenu] = useState(false);

  const onLoad = useCallback((instance) => setMap(instance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  // Smoothly recenter when focusPoint changes (Req 12/13 map focus).
  useEffect(() => {
    if (!map || !focusPoint) return;
    if (Number.isFinite(focusPoint.lat) && Number.isFinite(focusPoint.lng)) {
      map.panTo({ lat: focusPoint.lat, lng: focusPoint.lng });
      map.setZoom(Math.max(map.getZoom() || 0, 20));
    }
  }, [focusPoint, map]);

  // Route polyline: parent supplies [lat, lng] pairs; Google expects objects.
  const routePath = useMemo(
    () =>
      Array.isArray(routeCoords)
        ? routeCoords
            .filter((c) => Array.isArray(c) && c.length === 2)
            .map(([cLat, cLng]) => ({ lat: Number(cLat), lng: Number(cLng) }))
        : [],
    [routeCoords]
  );

  // Smoothly fit bounds when navigation route coords are provided
  useEffect(() => {
    if (!map || !window.google?.maps || routePath.length < 2) return;
    try {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { top: 70, right: 60, bottom: 80, left: 60 });
    } catch {
      // ignore
    }
  }, [map, routePath]);

  const handleMapClick = useCallback(
    (event) => {
      if (placingMode && typeof onMapClick === "function" && event.latLng) {
        onMapClick(event.latLng.lat(), event.latLng.lng());
      }
    },
    [placingMode, onMapClick]
  );

  const options = useMemo(
    () => ({ ...BASE_OPTIONS, mapTypeId, draggableCursor: placingMode ? "crosshair" : undefined }),
    [placingMode, mapTypeId]
  );

  if (loadError) {
    return (
      <div className="alert alert-danger" role="alert" style={{ margin: "1rem" }}>
        The map could not be loaded. Verify the Google Maps API key configuration.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="spinner spinner-lg" aria-label="Loading cemetery map" />;
  }

  return (
    <div style={WRAPPER_STYLE}>
      {/* Custom Clean Map Type Controls */}
      <div style={{ 
        position: "absolute", 
        top: 20, 
        left: 20, 
        zIndex: 10, 
        display: "flex", 
        gap: 4,
        background: "rgba(15, 23, 42, 0.82)", 
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "var(--radius-md, 10px)", 
        border: "1px solid rgba(255, 255, 255, 0.1)", 
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
        padding: "4px"
      }}>
        {/* Map Button & Dropdown */}
        <div 
          style={{ position: "relative", width: 110 }} 
          onMouseLeave={() => setShowMapMenu(false)}
        >
          <button 
            type="button"
            onMouseEnter={() => setShowMapMenu(true)}
            onClick={() => setMapTypeId(mapTypeId === "terrain" ? "terrain" : "roadmap")} 
            style={{ 
              width: "100%",
              padding: "7px 12px", 
              background: (mapTypeId === "roadmap" || mapTypeId === "terrain") ? "rgba(255, 255, 255, 0.14)" : "transparent", 
              color: (mapTypeId === "roadmap" || mapTypeId === "terrain") ? "#ffffff" : "#94a3b8", 
              border: "none", 
              borderRadius: "var(--radius-sm, 6px)",
              cursor: "pointer", 
              fontWeight: (mapTypeId === "roadmap" || mapTypeId === "terrain") ? 600 : 500, 
              fontSize: "0.85rem", 
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxSizing: "border-box"
            }}
          >
            <span>Map</span>
            <ChevronDown size={13} style={{ opacity: 0.75, transition: "transform 0.2s ease", transform: showMapMenu ? "rotate(180deg)" : "none" }} />
          </button>
          
          {showMapMenu && (
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                width: "100%",
                paddingTop: 6,
                zIndex: 20
              }}
            >
              <div style={{
                width: "100%",
                boxSizing: "border-box",
                background: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "var(--radius-md, 8px)",
                padding: "8px 10px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)"
              }}>
                <div 
                  onClick={() => setMapTypeId(mapTypeId === "terrain" ? "roadmap" : "terrain")}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 8, 
                    fontSize: "0.85rem", 
                    cursor: "pointer", 
                    color: "#f1f5f9",
                    userSelect: "none"
                  }}
                >
                  <div style={{ 
                    width: 16, 
                    height: 16, 
                    borderRadius: 3, 
                    border: mapTypeId === "terrain" ? "none" : "1px solid rgba(255, 255, 255, 0.35)",
                    background: mapTypeId === "terrain" ? "var(--primary, #3b82f6)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s ease"
                  }}>
                    {mapTypeId === "terrain" && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <span>Terrain</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Satellite Button & Dropdown */}
        <div 
          style={{ position: "relative", width: 110 }} 
          onMouseLeave={() => setShowSatelliteMenu(false)}
        >
          <button 
            type="button"
            onMouseEnter={() => setShowSatelliteMenu(true)}
            onClick={() => setMapTypeId(mapTypeId === "satellite" ? "satellite" : "hybrid")} 
            style={{ 
              width: "100%",
              padding: "7px 12px", 
              background: (mapTypeId === "hybrid" || mapTypeId === "satellite") ? "rgba(255, 255, 255, 0.14)" : "transparent", 
              color: (mapTypeId === "hybrid" || mapTypeId === "satellite") ? "#ffffff" : "#94a3b8", 
              border: "none", 
              borderRadius: "var(--radius-sm, 6px)",
              cursor: "pointer", 
              fontWeight: (mapTypeId === "hybrid" || mapTypeId === "satellite") ? 600 : 500, 
              fontSize: "0.85rem", 
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxSizing: "border-box"
            }}
          >
            <span>Satellite</span>
            <ChevronDown size={13} style={{ opacity: 0.75, transition: "transform 0.2s ease", transform: showSatelliteMenu ? "rotate(180deg)" : "none" }} />
          </button>

          {showSatelliteMenu && (
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                width: "100%",
                paddingTop: 6,
                zIndex: 20
              }}
            >
              <div style={{
                width: "100%",
                boxSizing: "border-box",
                background: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "var(--radius-md, 8px)",
                padding: "8px 10px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)"
              }}>
                <div 
                  onClick={() => setMapTypeId(mapTypeId === "hybrid" ? "satellite" : "hybrid")}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 8, 
                    fontSize: "0.85rem", 
                    cursor: "pointer", 
                    color: "#f1f5f9",
                    userSelect: "none"
                  }}
                >
                  <div style={{ 
                    width: 16, 
                    height: 16, 
                    borderRadius: 3, 
                    border: mapTypeId === "hybrid" ? "none" : "1px solid rgba(255, 255, 255, 0.35)",
                    background: mapTypeId === "hybrid" ? "var(--primary, #3b82f6)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s ease"
                  }}>
                    {mapTypeId === "hybrid" && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <span>Labels</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-Right: Locate Bolonsiri Floating Action Button */}
      <div style={{
        position: "absolute",
        top: 20,
        right: 20,
        zIndex: 10
      }}>
        <button
          type="button"
          onClick={() => {
            if (map) {
              map.panTo(center);
              map.setZoom(19);
            }
          }}
          title="Center on Bolonsiri Public Cemetery"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "8px 16px",
            background: "rgba(15, 23, 42, 0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            color: "var(--primary-light, #60a5fa)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "var(--radius-md, 10px)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.85rem",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(30, 41, 59, 0.95)";
            e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.4)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 24px rgba(0, 0, 0, 0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(15, 23, 42, 0.82)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.35)";
          }}
        >
          <Compass size={15} />
          <span>Locate Bolonsiri</span>
        </button>
      </div>

      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={center}
        zoom={18}
        options={options}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
      >
      {/* Navigation route polyline (Req 12.1). */}
      {routePath.length > 1 && (
        <PolylineF
          path={routePath}
          options={{ strokeColor: "#2D6CDF", strokeWeight: 5, strokeOpacity: 0.85 }}
        />
      )}

      {plots.map((plot) => {
        if (!plot.gpsLat || !plot.gpsLng) return null;
        const position = { lat: Number(plot.gpsLat), lng: Number(plot.gpsLng) };
        const color = statusColor(plot.status);

        // Edit-locations mode: draggable status dot (drag & drop to relocate).
        if (editable) {
          return (
            <MarkerF
              key={plot.id}
              position={position}
              draggable
              icon={circleSymbol(color, false)}
              onDragEnd={(e) => {
                if (typeof onPlotDragEnd === "function" && e.latLng) {
                  onPlotDragEnd(plot, e.latLng.lat(), e.latLng.lng());
                }
              }}
            />
          );
        }

        // View mode: static colored marker; click selects and opens the popup.
        const isSelected = selectedPlot?.id === plot.id;
        return (
          <MarkerF
            key={plot.id}
            position={position}
            icon={circleSymbol(color, isSelected)}
            onClick={() => {
              if (typeof onSelectPlot === "function") {
                onSelectPlot(plot);
              } else {
                setInfoPlot(plot);
              }
            }}
          >
            {!onSelectPlot && infoPlot?.id === plot.id && (
              <InfoWindowF position={position} onCloseClick={() => setInfoPlot(null)}>
                <div style={{ padding: "2px 4px" }}>
                  <strong style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                    Plot {plot.plotNumber}
                  </strong>
                  <div style={{ color: "#666", fontSize: 12, textTransform: "capitalize" }}>
                    {plot.status}
                  </div>
                </div>
              </InfoWindowF>
            )}
          </MarkerF>
        );
      })}

      {/* Draggable draft pin for the plot being placed (Add / Set / Edit one). */}
      {draftMarker && Number.isFinite(draftMarker.lat) && Number.isFinite(draftMarker.lng) && (
        <MarkerF
          position={{ lat: draftMarker.lat, lng: draftMarker.lng }}
          draggable
          icon={draftSymbol()}
          onDragEnd={(e) => {
            if (typeof onMapClick === "function" && e.latLng) {
              onMapClick(e.latLng.lat(), e.latLng.lng());
            }
          }}
        />
      )}
    </GoogleMap>
    </div>
  );
}
