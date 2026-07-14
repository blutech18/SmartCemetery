"use client";

import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, useMapEvents, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getClientMapCenter, getClientTileConfig } from "../lib/config";

function statusColor(status) {
  return status === "available" ? "#2ECC71"
    : status === "occupied" ? "#FF6B6B"
    : status === "reserved" ? "#FFB547"
    : "#4ECDC4";
}

// Asset-free draggable pin (HTML divIcon) for the plot being placed.
function makeDraftPinIcon() {
  return L.divIcon({
    className: "",
    html:
      '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#2D6CDF;border:2px solid #111;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:move;"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Status-colored draggable dot used in Edit-locations mode.
function makeStatusIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #111;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,0.4);cursor:move;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// Captures map clicks and reports the coordinate — only while placing.
function MapClickHandler({ active, onMapClick }) {
  useMapEvents({
    click(e) {
      if (active && typeof onMapClick === "function") {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Smoothly recenters the map when `focusPoint` changes.
function RecenterMap({ focusPoint }) {
  const map = useMap();
  useEffect(() => {
    if (focusPoint && Number.isFinite(focusPoint.lat) && Number.isFinite(focusPoint.lng)) {
      map.flyTo([focusPoint.lat, focusPoint.lng], Math.max(map.getZoom(), 19), { duration: 0.6 });
    }
  }, [focusPoint, map]);
  return null;
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
  const tile = getClientTileConfig();
  const center = [lat, lng];

  const draftIcon = useMemo(() => makeDraftPinIcon(), []);

  return (
    <MapContainer
      center={center}
      zoom={18}
      maxZoom={24}
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "var(--radius-md)",
        zIndex: 0,
        cursor: placingMode ? "crosshair" : "grab",
      }}
    >
      {tile.url && (
        <TileLayer
          attribution={tile.attribution}
          url={tile.url}
          maxZoom={24}
          maxNativeZoom={19}
        />
      )}

      <MapClickHandler active={placingMode} onMapClick={onMapClick} />
      <RecenterMap focusPoint={focusPoint} />

      {/* Navigation route polyline (Req 12.1). */}
      {Array.isArray(routeCoords) && routeCoords.length > 1 && (
        <Polyline positions={routeCoords} pathOptions={{ color: "#2D6CDF", weight: 5, opacity: 0.85 }} />
      )}

      {plots.map((plot) => {
        if (!plot.gpsLat || !plot.gpsLng) return null;
        const color = statusColor(plot.status);
        const position = [Number(plot.gpsLat), Number(plot.gpsLng)];

        // Edit-locations mode: draggable status dot (drag & drop to relocate).
        if (editable) {
          return (
            <Marker
              key={plot.id}
              position={position}
              draggable
              icon={makeStatusIcon(color)}
              eventHandlers={{
                dragend: (e) => {
                  const { lat: dLat, lng: dLng } = e.target.getLatLng();
                  if (typeof onPlotDragEnd === "function") onPlotDragEnd(plot, dLat, dLng);
                },
              }}
            >
              <Popup>
                <strong>Plot {plot.plotNumber}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>Drag to relocate</div>
              </Popup>
            </Marker>
          );
        }

        // View mode: static circle marker; click opens the details modal.
        const isSelected = selectedPlot?.id === plot.id;
        return (
          <CircleMarker
            key={plot.id}
            center={position}
            pathOptions={{
              color: isSelected ? "#111" : "white",
              weight: isSelected ? 3 : 1.5,
              fillColor: color,
              fillOpacity: 0.9,
            }}
            radius={isSelected ? 10 : 8}
            eventHandlers={{
              click: () => onSelectPlot && onSelectPlot(plot),
            }}
          >
            <Popup>
              <div style={{ padding: "4px" }}>
                <strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>
                  Plot {plot.plotNumber}
                </strong>
                <div style={{ color: "#666", fontSize: "12px", textTransform: "capitalize" }}>
                  {plot.status}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* Draggable draft pin for the plot being placed (Add / Set / Edit one). */}
      {draftMarker && Number.isFinite(draftMarker.lat) && Number.isFinite(draftMarker.lng) && (
        <Marker
          position={[draftMarker.lat, draftMarker.lng]}
          draggable
          icon={draftIcon}
          eventHandlers={{
            dragend: (e) => {
              const { lat: dLat, lng: dLng } = e.target.getLatLng();
              if (typeof onMapClick === "function") onMapClick(dLat, dLng);
            },
          }}
        >
          <Popup>Drag to reposition — then Save</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
