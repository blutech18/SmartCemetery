"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, MarkerF, PolylineF, InfoWindowF, useJsApiLoader } from "@react-google-maps/api";
import { Check } from "lucide-react";
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
      <div style={{ 
        position: "absolute", 
        top: 24, 
        left: 24, 
        zIndex: 10, 
        display: "flex", 
        background: "rgba(15, 23, 42, 0.7)", 
        backdropFilter: "blur(12px)",
        borderRadius: "var(--radius-md)", 
        border: "1px solid rgba(255,255,255,0.05)", 
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        padding: "4px"
      }}>
        <div style={{ position: "relative" }} onMouseLeave={() => setShowMapMenu(false)}>
          <button 
            onMouseEnter={() => setShowMapMenu(true)}
            onClick={() => setMapTypeId(mapTypeId === "terrain" ? "terrain" : "roadmap")} 
            style={{ 
              padding: "6px 14px", 
              background: (mapTypeId === "roadmap" || mapTypeId === "terrain") ? "rgba(255,255,255,0.1)" : "transparent", 
              color: (mapTypeId === "roadmap" || mapTypeId === "terrain") ? "#ffffff" : "var(--text-muted)", 
              border: "none", 
              borderRadius: "var(--radius-sm)",
              cursor: "pointer", 
              fontWeight: 500, 
              fontSize: "0.85rem", 
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            Map <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>▼</span>
          </button>
          
          {showMapMenu && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              paddingTop: 8,
              zIndex: 20
            }}>
              <div style={{
                background: "rgba(15, 23, 42, 0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                minWidth: "120px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
              }}>
                <div 
                  onClick={() => setMapTypeId(mapTypeId === "terrain" ? "roadmap" : "terrain")}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", cursor: "pointer", color: "#e2e8f0" }}
                >
                  <div style={{ 
                    width: 18, 
                    height: 18, 
                    borderRadius: 4, 
                    border: mapTypeId === "terrain" ? "none" : "1px solid rgba(255,255,255,0.3)",
                    background: mapTypeId === "terrain" ? "var(--primary)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}>
                    {mapTypeId === "terrain" && <Check size={14} color="#0f172a" strokeWidth={3} />}
                  </div>
                  Terrain
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div style={{ position: "relative" }} onMouseLeave={() => setShowSatelliteMenu(false)}>
          <button 
            onMouseEnter={() => setShowSatelliteMenu(true)}
            onClick={() => setMapTypeId(mapTypeId === "satellite" ? "satellite" : "hybrid")} 
            style={{ 
              padding: "6px 14px", 
              background: (mapTypeId === "hybrid" || mapTypeId === "satellite") ? "rgba(255,255,255,0.1)" : "transparent", 
              color: (mapTypeId === "hybrid" || mapTypeId === "satellite") ? "#ffffff" : "var(--text-muted)", 
              border: "none", 
              borderRadius: "var(--radius-sm)",
              cursor: "pointer", 
              fontWeight: 500, 
              fontSize: "0.85rem", 
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 4 
            }}
          >
            Satellite <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>▼</span>
          </button>

          {showSatelliteMenu && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              paddingTop: 8,
              zIndex: 20
            }}>
              <div style={{
                background: "rgba(15, 23, 42, 0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                minWidth: "120px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
              }}>
                <div 
                  onClick={() => setMapTypeId(mapTypeId === "hybrid" ? "satellite" : "hybrid")}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", cursor: "pointer", color: "#e2e8f0" }}
                >
                  <div style={{ 
                    width: 18, 
                    height: 18, 
                    borderRadius: 4, 
                    border: mapTypeId === "hybrid" ? "none" : "1px solid rgba(255,255,255,0.3)",
                    background: mapTypeId === "hybrid" ? "var(--primary)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s"
                  }}>
                    {mapTypeId === "hybrid" && <Check size={14} color="#0f172a" strokeWidth={3} />}
                  </div>
                  Labels
                </div>
              </div>
            </div>
          )}
        </div>
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
              setInfoPlot(plot);
              if (typeof onSelectPlot === "function") onSelectPlot(plot);
            }}
          >
            {infoPlot?.id === plot.id && (
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
