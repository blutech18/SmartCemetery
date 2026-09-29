"use client";

import { useCallback, useEffect, useMemo, useState, useRef, Fragment } from "react";
import {
  GoogleMap,
  MarkerF,
  PolylineF,
  PolygonF,
  InfoWindowF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { ChevronDown, AlertTriangle, Check } from "lucide-react";
import { getClientMapCenter, getClientGoogleMapsApiKey } from "../lib/config";
import { getPlotsBoundingBox, translatePlots, rotatePlots, M_TO_LAT } from "@/lib/geo";
import {
  localOffsetToLatLng,
  latLngToLocalOffset,
  getBuildingCorners,
  getSubdividedBuildingCells,
  snapBuildingToPlots,
  getRowKey,
} from "../lib/building-grid";

// Plot Status Color Palette (matches reference plot-map design)
export function getPlotStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "occupied":
      return "#E15B52"; // Salmon Red (Occupied)
    case "available":
      return "#7CC47F"; // Soft Green (Available)
    case "reserved":
    case "hold":
      return "#C9CDDC"; // Light Gray-Lavender (Hold)
    case "sold":
      return "#CDB553"; // Khaki Yellow (Sold)
    default:
      return "#6674D7"; // Periwinkle Blue (Unavailable)
  }
}

// Building Block Generator Handle Icons
function getBuildingMoveAnchorIcon() {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="26" viewBox="0 0 104 26">
    <defs>
      <filter id="b-mv-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="100" height="22" rx="11" fill="#0f172a" stroke="#00E5FF" stroke-width="1.8" filter="url(#b-mv-sh)"/>
    <g transform="translate(14, 13)" stroke="#00E5FF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M-4 0 L4 0 M0 -4 L0 4"/>
      <path d="M-2 -1.5 L-4 0 L-2 1.5"/>
      <path d="M2 -1.5 L4 0 L2 1.5"/>
      <path d="M-1.5 -2 L0 -4 L1.5 -2"/>
      <path d="M-1.5 2 L0 4 L1.5 2"/>
    </g>
    <text x="27" y="16.5" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="700" letter-spacing="0.4">MOVE BLOCK</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(104, 26),
    anchor: new window.google.maps.Point(52, 13),
  };
}

function getBuildingLengthHandleIcon(lengthMeters = 26.5) {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const text = `${Number(lengthMeters).toFixed(1)}m`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="86" height="26" viewBox="0 0 86 26">
    <defs>
      <filter id="b-len-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="82" height="22" rx="11" fill="#064e3b" stroke="#10b981" stroke-width="1.8" filter="url(#b-len-sh)"/>
    <g transform="translate(14, 13)" stroke="#34d399" stroke-width="1.6" stroke-linecap="round" fill="none">
      <path d="M-4.5 0 L4.5 0"/>
      <path d="M-2.5 -2 L-4.5 0 L-2.5 2"/>
      <path d="M2.5 -2 L4.5 0 L2.5 2"/>
    </g>
    <text x="26" y="16.5" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="700">${text}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(86, 26),
    anchor: new window.google.maps.Point(43, 13),
  };
}

function getBuildingWidthHandleIcon(widthMeters = 2.8) {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const text = `${Number(widthMeters).toFixed(1)}m`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="82" height="26" viewBox="0 0 82 26">
    <defs>
      <filter id="b-wid-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="78" height="22" rx="11" fill="#3b0764" stroke="#a855f7" stroke-width="1.8" filter="url(#b-wid-sh)"/>
    <g transform="translate(13, 13)" stroke="#c084fc" stroke-width="1.6" stroke-linecap="round" fill="none">
      <path d="M0 -4.5 L0 4.5"/>
      <path d="M-2 -2.5 L0 -4.5 L2 -2.5"/>
      <path d="M-2 2.5 L0 4.5 L2 2.5"/>
    </g>
    <text x="25" y="16.5" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="700">${text}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(82, 26),
    anchor: new window.google.maps.Point(41, 13),
  };
}

function getBuildingRotateHandleIcon(angleDeg = 37.7) {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const text = `${Number(angleDeg).toFixed(1)}°`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="26" viewBox="0 0 84 26">
    <defs>
      <filter id="b-rot-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="80" height="22" rx="11" fill="#78350f" stroke="#f59e0b" stroke-width="1.8" filter="url(#b-rot-sh)"/>
    <g transform="translate(13, 13)">
      <path d="M-3 -1.5 A 4 4 0 1 1 -3 2.5" fill="none" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round"/>
      <polygon points="-4.5,-2 -0.5,-1.5 -2,-5" fill="#fbbf24"/>
    </g>
    <text x="25" y="16.5" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="700">${text}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(84, 26),
    anchor: new window.google.maps.Point(42, 13),
  };
}

function getBuildingApplyHandleIcon() {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="26" viewBox="0 0 112 26">
    <defs>
      <filter id="b-app-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#000000" flood-opacity="0.55"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="108" height="22" rx="11" fill="#064e3b" stroke="#10b981" stroke-width="1.8" filter="url(#b-app-sh)"/>
    <g transform="translate(14, 13)" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M-4 0 L-1 3.5 L5 -3"/>
    </g>
    <text x="27" y="16.5" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" letter-spacing="0.3">APPLY &amp; SAVE</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(112, 26),
    anchor: new window.google.maps.Point(56, 13),
  };
}


function getBlockTitleBadgeIcon(title, angleDeg = 37.7) {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const cleanTitle = (title || "").replace("ROW-", "Row ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32">
    <g transform="rotate(${-angleDeg}, 60, 16)">
      <rect x="4" y="4" width="112" height="24" rx="12" fill="rgba(15, 23, 42, 0.88)" stroke="#ffffff" stroke-width="1.5"/>
      <text x="60" y="20" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-size="11.5" font-weight="700">${cleanTitle}</text>
    </g>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(120, 32),
    anchor: new window.google.maps.Point(60, 16),
  };
}

/**
 * Extracts deceased names for a plot (returns empty array if none).
 */
export function getPlotDeceasedNames(plot) {
  if (!plot) return [];

  // Occupants are always derived from the plot's grave records — never
  // hardcoded — so a plot number alone can never fabricate personal data.

  // 1. Check if grave details notes has apartment niche stack JSON with occupied tiers
  const grave = plot.graves?.[0];
  if (grave?.details?.notes) {
    try {
      const parsed = JSON.parse(grave.details.notes);
      if (Array.isArray(parsed.tiers)) {
        const occupied = parsed.tiers
          .filter((t) => t.deceasedName && t.status === "occupied")
          .map((t) => t.deceasedName.trim());
        if (occupied.length > 0) {
          return occupied;
        }
      }
    } catch {
      // not JSON, continue
    }
  }

  // 2. Check if multiple graves are attached to plot
  if (Array.isArray(plot.graves) && plot.graves.length > 1) {
    const names = plot.graves
      .map((g) => g.deceasedName?.trim())
      .filter(Boolean);
    if (names.length > 0) return names;
  }

  // 3. Check primary grave deceasedName string for separators like ' & ', ' / ', ' and '
  const rawName = (grave?.deceasedName || "").trim();
  if (rawName) {
    if (rawName.includes(" & ")) {
      return rawName.split(/\s*&\s*/).filter(Boolean);
    }
    if (rawName.includes(" / ")) {
      return rawName.split(/\s*\/\s*/).filter(Boolean);
    }
    if (rawName.toLowerCase().includes(" and ")) {
      return rawName.split(/\s+and\s+/i).filter(Boolean);
    }
    return [rawName];
  }

  return [];
}

/**
 * Extracts deceased names for a plot callout on the map.
 * Falls back to plot number if no occupants exist.
 */
export function getPlotCalloutNames(plot) {
  const names = getPlotDeceasedNames(plot);
  if (names.length > 0) return names;
  return [plot?.plotNumber ? `Plot ${plot.plotNumber}` : "Plot Details"];
}

const WRAPPER_STYLE = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: "var(--radius-md, 10px)",
  overflow: "hidden",
};
const CONTAINER_STYLE = { width: "100%", height: "100%" };

const BASE_OPTIONS = {
  mapTypeId: "hybrid",
  zoom: 20,
  disableDefaultUI: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  zoomControl: true,
  gestureHandling: "greedy",
  clickableIcons: false,
  maxZoom: 24,
};

// Compute rotated rectangular footprint for a plot cell
function getPlotCorners({
  lat,
  lng,
  widthMeters = 2.65,
  depthMeters = 1.6,
  angleDeg = 37.7,
}) {
  const mToLat = 1 / 110574;
  const mToLng = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const hw = widthMeters / 2;
  const hd = depthMeters / 2;

  const corners = [
    { dx: -hw, dy: -hd },
    { dx: hw, dy: -hd },
    { dx: hw, dy: hd },
    { dx: -hw, dy: hd },
  ];

  return corners.map(({ dx, dy }) => ({
    lat: lat + (dx * sin + dy * cos) * mToLat,
    lng: lng + (dx * cos - dy * sin) * mToLng,
  }));
}

// Blue teardrop map pin for selected plot
const BLUE_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <defs>
    <filter id="pinShadow" x="-20%" y="-10%" width="140%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>
  <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z" fill="#0284c7" stroke="#ffffff" stroke-width="2" filter="url(#pinShadow)"/>
  <circle cx="14" cy="13" r="4.5" fill="#ffffff"/>
</svg>`;
const BLUE_PIN_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(BLUE_PIN_SVG)}`;

/**
 * Generates an SVG data URL for in-plot text labels, rotated to match the
 * plot angle. Vacant cells show just the cell number; occupied cells show
 * numbered deceased names ("1. Jane Peters") like the reference plot map.
 * Returns { url, width, height } so the caller can anchor the icon precisely.
 */
export function createPlotLabelIcon({
  plotNumber,
  deceasedNames = [],
  angleDeg = 37.7,
  hasStar = false,
  showName = false,
}) {
  let cellNumber = plotNumber;
  const colMatch = plotNumber?.match(/(?:-C0*|^Plot\s*|^0*)(\d+)$/i);
  if (colMatch) {
    cellNumber = colMatch[1];
  } else if (plotNumber === "WALAG-001") {
    cellNumber = "1";
  }

  const escapeXml = (str) =>
    (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const truncate = (str, max = 16) => {
    const s = (str || "").trim();
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  };

  const SERIF = "Georgia, 'Times New Roman', Times, serif";
  const names = showName
    ? deceasedNames.map((n) => truncate(n)).filter(Boolean).slice(0, 2)
    : [];

  const width = names.length > 0 ? 120 : 48;
  const lineHeight = 13;
  const lineCount = Math.max(1, names.length);
  const height = names.length > 0 ? lineCount * lineHeight + 8 : 24;
  const cx = width / 2;
  const cy = height / 2;

  let textSvg = "";
  if (names.length === 0) {
    // Vacant cell or number-only mode: clean centered cell number
    textSvg = `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="11.5" font-weight="700" fill="#111827" stroke="#ffffff" stroke-width="2.4" paint-order="stroke fill">${escapeXml(cellNumber)}</text>`;
  } else {
    const firstY = cy - ((lineCount - 1) * lineHeight) / 2 + 4;
    const starTspan = hasStar ? `<tspan fill="#D97706">&#9733; </tspan>` : "";
    textSvg += `<text x="${cx}" y="${firstY}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="10.5" font-weight="700" fill="#111827" stroke="#ffffff" stroke-width="2.2" paint-order="stroke fill">${starTspan}${escapeXml(cellNumber)}. ${escapeXml(names[0])}</text>`;
    for (let i = 1; i < names.length; i++) {
      textSvg += `<text x="${cx}" y="${firstY + i * lineHeight}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="10" font-weight="600" fill="#111827" stroke="#ffffff" stroke-width="2.2" paint-order="stroke fill">${escapeXml(names[i])}</text>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g transform="rotate(${-angleDeg}, ${cx}, ${cy})">${textSvg}</g></svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    width,
    height,
  };
}

// Fallback circle marker for zoomed out view / edit mode
function circleSymbol(color, selected) {
  return {
    path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
    fillColor: color,
    fillOpacity: 0.95,
    strokeColor: selected ? "#00E5FF" : "#ffffff",
    strokeWeight: selected ? 3 : 1.5,
    scale: selected ? 8 : 6,
  };
}

function draftSymbol() {
  return {
    path: window.google?.maps?.SymbolPath?.BACKWARD_CLOSED_ARROW ?? 3,
    fillColor: "#2D6CDF",
    fillOpacity: 1,
    strokeColor: "#111111",
    strokeWeight: 2,
    scale: 6,
  };
}

// Formal CAD-style Move Anchor badge for Adjust Mode
function getMoveAnchorIcon() {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="32" viewBox="0 0 96 32">
    <defs>
      <filter id="m-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="92" height="28" rx="14" fill="#0f172a" stroke="#00E5FF" stroke-width="2" filter="url(#m-sh)"/>
    <g transform="translate(18, 16)" stroke="#00E5FF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M-6 0 L6 0 M0 -6 L0 6"/>
      <path d="M-4 -2.5 L-6.5 0 L-4 2.5"/>
      <path d="M4 -2.5 L6.5 0 L4 2.5"/>
      <path d="M-2.5 -4 L0 -6.5 L2.5 -4"/>
      <path d="M-2.5 4 L0 6.5 L2.5 4"/>
    </g>
    <text x="35" y="20" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">MOVE</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(96, 32),
    anchor: new window.google.maps.Point(48, 16),
  };
}

// Formal CAD-style Rotate Handle badge for Adjust Mode
function getRotateHandleIcon() {
  if (typeof window === "undefined" || typeof window.google?.maps?.Size !== "function") return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="32" viewBox="0 0 104 32">
    <defs>
      <filter id="r-sh" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect x="2" y="2" width="100" height="28" rx="14" fill="#0f172a" stroke="#A855F7" stroke-width="2" filter="url(#r-sh)"/>
    <g transform="translate(18, 16)">
      <path d="M-5 -2 A 6 6 0 1 1 -5 4" fill="none" stroke="#C084FC" stroke-width="2" stroke-linecap="round"/>
      <polygon points="-7,-4 -1,-2 -4,-8" fill="#C084FC"/>
    </g>
    <text x="35" y="20" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">ROTATE</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(104, 32),
    anchor: new window.google.maps.Point(52, 16),
  };
}

// Helper to check if a plot belongs to City Memorial Park (CMP)
export function isCmpPlot(p) {
  if (!p || p._deleted) return false;
  return Boolean(
    p.plotNumber?.startsWith("ROW-") ||
    p.plotNumber === "WALAG-001" ||
    p.locationDetail?.subsection?.startsWith("ROW-") ||
    p.locationDetail?.locationId === 4
  );
}

// Relative boundary vertices in meters [dx = East, dy = North] from the center of CMP apartment crypts
// Encloses the 15 concrete apartment rows, the Walag niche, and admin boundary
export const CMP_BOUNDARY_OFFSETS_METERS = [
  { dx: -49.9, dy: 48.0 },  // NW corner (driveway curve)
  { dx: 57.6,  dy: 40.9 },  // NE corner (along admin road to Bolonsiri Rd)
  { dx: 45.8,  dy: -0.3 },  // Mid East (along Bolonsiri Rd)
  { dx: 22.4,  dy: -35.5 }, // SE corner (past Row E07)
  { dx: -31.4, dy: -35.5 }, // South Mid (above Mendez Store)
  { dx: -56.6, dy: -10.4 }, // SW corner (below Walag niche)
  { dx: -49.9, dy: 29.9 },  // West Mid (along curved access road)
];

export function getCmpBoundaryCoords(
  centerLat = 8.46584789,
  centerLng = 124.65701478,
  angle = 37.7,
  offsets = CMP_BOUNDARY_OFFSETS_METERS
) {
  const rad = (((angle ?? 37.7) - 37.7) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const latScale = 110574;
  const lngScale = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const activeOffsets = offsets && offsets.length >= 3 ? offsets : CMP_BOUNDARY_OFFSETS_METERS;

  return activeOffsets.map(({ dx, dy }) => {
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return {
      lat: Number((centerLat + ry / latScale).toFixed(8)),
      lng: Number((centerLng + rx / lngScale).toFixed(8)),
    };
  });
}

export function coordsToBoundaryOffsets(coords, centerLat, centerLng, angle = 37.7) {
  const latScale = 110574;
  const lngScale = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const rad = (((angle ?? 37.7) - 37.7) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return coords.map(({ lat, lng }) => {
    const ry = (lat - centerLat) * latScale;
    const rx = (lng - centerLng) * lngScale;
    const dx = rx * cos + ry * sin;
    const dy = -rx * sin + ry * cos;
    return { dx: Number(dx.toFixed(2)), dy: Number(dy.toFixed(2)) };
  });
}

function GoogleMapLoadedView({
  apiKey,
  plots = [],
  selectedPlot,
  onSelectPlot,
  routeCoords,
  placingMode = false,
  draftMarker = null,
  onMapClick,
  focusPoint = null,
  editable = false,
  onPlotDragEnd,
  statusFilter = "all",
  onStatusFilterChange,
  adjustMode = false,
  onToggleAdjustMode,
  selectedScope = "all",
  onSelectScope,
  onUpdatePlots,
  gridAngle = 37.7,
  onChangeGridAngle,
  onSinglePlotDrag,
  onLandmarkDragEnd,
  boundaryOffsets = CMP_BOUNDARY_OFFSETS_METERS,
  onUpdateBoundaryOffsets,
  editBoundaryLines = false,
  buildingConfig = null,
  onUpdateBuildingConfig,
  onApplyBuildingConfig,
}) {
  const { lat, lng } = getClientMapCenter();
  const center = useMemo(() => ({ lat, lng }), [lat, lng]);

  // NOTE: with the async bootstrap loader, `window.google.maps` exists as a
  // stub (only `importLibrary`) before the Maps library is ready. Checking a
  // real constructor avoids rendering <GoogleMap> before `google.maps.Map`
  // exists, which crashed with "google.maps.Map is not a constructor".
  const isGoogleAlreadyLoaded =
    typeof window !== "undefined" && typeof window.google?.maps?.Map === "function";
  const { isLoaded: scriptLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });
  const isLoaded = isGoogleAlreadyLoaded || scriptLoaded;

  const [map, setMap] = useState(null);
  // Becomes true only when the Google "maps" library is fully constructed
  // (google.maps.Point / Size / SymbolPath available). Building marker icons
  // before this crashes with "window.google.maps.Point is not a constructor".
  const [mapsReady, setMapsReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(20);
  const [hoveredPlot, setHoveredPlot] = useState(null);
  const [mapTypeId, setMapTypeId] = useState("hybrid");
  const [showMapMenu, setShowMapMenu] = useState(false);
  const [showSatelliteMenu, setShowSatelliteMenu] = useState(false);
  const mapMenuRef = useRef(null);
  const satelliteMenuRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const effectiveFilter = statusFilter !== "all" ? statusFilter : activeFilter;

  // Scope filter for adjust / crop mode
  const scopeFilter = useCallback(
    (p) => {
      const isCmp =
        p.plotNumber?.startsWith("ROW-") ||
        p.plotNumber === "WALAG-001" ||
        p.locationDetail?.subsection?.startsWith("ROW-");
      if (!isCmp) return false;

      if (selectedScope === "all") return true;
      if (selectedScope === "east") return p.plotNumber?.startsWith("ROW-E");
      if (selectedScope === "west") return p.plotNumber?.startsWith("ROW-W") || p.plotNumber === "WALAG-001";
      if (selectedScope === "walag") return p.plotNumber === "WALAG-001" || p.plotNumber?.startsWith("ROW-W07");
      return p.plotNumber?.startsWith(selectedScope) || (selectedScope === "ROW-W07" && p.plotNumber === "WALAG-001");
    },
    [selectedScope]
  );

  // Bounding box of the plots currently in scope
  const adjustBbox = useMemo(() => {
    if (!adjustMode) return null;
    return getPlotsBoundingBox(plots, scopeFilter);
  }, [adjustMode, plots, scopeFilter]);

  // Center anchor tracking for live dragging
  const anchorPos = useMemo(() => {
    if (!adjustBbox) return null;
    return { lat: adjustBbox.centerLat, lng: adjustBbox.centerLng };
  }, [adjustBbox]);

  const lastAnchorPosRef = useRef(null);

  useEffect(() => {
    lastAnchorPosRef.current = anchorPos;
  }, [anchorPos]);

  const handleAnchorDrag = useCallback(
    (e) => {
      if (!e.latLng || !lastAnchorPosRef.current || !onUpdatePlots) return;
      const curLat = e.latLng.lat();
      const curLng = e.latLng.lng();
      const dLat = curLat - lastAnchorPosRef.current.lat;
      const dLng = curLng - lastAnchorPosRef.current.lng;
      lastAnchorPosRef.current = { lat: curLat, lng: curLng };
      const updated = translatePlots(plots, dLat, dLng, scopeFilter);
      onUpdatePlots(updated);
    },
    [plots, scopeFilter, onUpdatePlots]
  );

  const handleAnchorDragEnd = useCallback(
    (e) => {
      if (!e.latLng || !lastAnchorPosRef.current || !onUpdatePlots) return;
      const curLat = e.latLng.lat();
      const curLng = e.latLng.lng();
      const dLat = curLat - lastAnchorPosRef.current.lat;
      const dLng = curLng - lastAnchorPosRef.current.lng;
      lastAnchorPosRef.current = { lat: curLat, lng: curLng };
      const updated = translatePlots(plots, dLat, dLng, scopeFilter);
      onUpdatePlots(updated);
    },
    [plots, scopeFilter, onUpdatePlots]
  );

  // Rotate handle dragging
  const handleRotateDrag = useCallback(
    (e) => {
      if (!e.latLng || !adjustBbox || !onUpdatePlots) return;
      const curLat = e.latLng.lat();
      const curLng = e.latLng.lng();
      const cLat = adjustBbox.centerLat;
      const cLng = adjustBbox.centerLng;

      const dy = (curLat - cLat) * 110574;
      const dx = (curLng - cLng) * 111320 * Math.cos((cLat * Math.PI) / 180);
      const angleRad = Math.atan2(dx, dy);
      const angleDegDelta = (angleRad * 180) / Math.PI;

      if (Math.abs(angleDegDelta) > 0.3) {
        const step = angleDegDelta > 0 ? 0.3 : -0.3;
        const updated = rotatePlots(plots, cLat, cLng, step, scopeFilter);
        onUpdatePlots(updated);
        if (typeof onChangeGridAngle === "function") {
          onChangeGridAngle((prev) => Number((prev + step).toFixed(1)));
        }
      }
    },
    [adjustBbox, plots, scopeFilter, onUpdatePlots, onChangeGridAngle]
  );

  // ─── Group all row plots into building blocks ───
  const rowPlotMap = useMemo(() => {
    const map = new Map();
    for (const p of plots) {
      if (!p.gpsLat || !p.gpsLng || p._deleted) continue;
      const r = getRowKey(p);
      if (r) {
        if (!map.has(r)) map.set(r, []);
        map.get(r).push(p);
      }
    }
    return map;
  }, [plots]);

  const allBuildingBlocks = useMemo(() => {
    const blocks = [];
    const rowKeys = Array.from(rowPlotMap.keys()).sort();

    for (const r of rowKeys) {
      const rowPlots = rowPlotMap.get(r).slice().sort((a, b) => {
        if (a.plotNumber === "WALAG-001") return -1;
        if (b.plotNumber === "WALAG-001") return 1;
        return (a.plotNumber || "").localeCompare(b.plotNumber || "", undefined, { numeric: true });
      });

      const isTargetActive = Boolean(
        buildingConfig?.active &&
        buildingConfig.targetRow === r
      );

      let cfg;
      if (isTargetActive) {
        cfg = {
          centerLat: buildingConfig.centerLat,
          centerLng: buildingConfig.centerLng,
          lengthMeters: buildingConfig.lengthMeters,
          widthMeters: buildingConfig.widthMeters,
          angleDeg: buildingConfig.angleDeg,
          numCols: buildingConfig.numCols,
          numRows: buildingConfig.numRows,
          invertCols: buildingConfig.invertCols,
        };
      } else {
        const snapped = snapBuildingToPlots(rowPlots, gridAngle ?? 37.7);
        if (!snapped) continue;
        cfg = {
          centerLat: snapped.centerLat,
          centerLng: snapped.centerLng,
          lengthMeters: snapped.lengthMeters,
          widthMeters: snapped.widthMeters,
          angleDeg: snapped.angleDeg,
          numCols: rowPlots.length,
          numRows: 1,
          invertCols: false,
        };
      }

      const corners = getBuildingCorners(cfg);
      const cells = getSubdividedBuildingCells({
        ...cfg,
        targetPlots: rowPlots,
        targetRow: r,
      });

      blocks.push({
        rowKey: r,
        isTargetActive,
        cfg,
        corners,
        cells,
        plots: rowPlots,
      });
    }

    // Custom freeform block support if active
    if (buildingConfig?.active && buildingConfig.targetRow === "custom") {
      const corners = getBuildingCorners(buildingConfig);
      const cells = getSubdividedBuildingCells({
        ...buildingConfig,
        targetPlots: [],
      });
      blocks.push({
        rowKey: "custom",
        isTargetActive: true,
        cfg: buildingConfig,
        corners,
        cells,
        plots: [],
      });
    }

    return blocks;
  }, [rowPlotMap, buildingConfig, gridAngle]);

  // Edge anchor points on the building perimeter
  const buildingTopEdgePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      0,
      buildingConfig.widthMeters / 2,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const buildingBottomEdgePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      0,
      -buildingConfig.widthMeters / 2,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const buildingRightEdgePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      buildingConfig.lengthMeters / 2,
      0,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  // Extended handle positions (cleanly separated in 4 cardinal directions)
  const buildingRotateHandlePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      0,
      buildingConfig.widthMeters / 2 + 7.5,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const buildingWidthHandlePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      0,
      -(buildingConfig.widthMeters / 2 + 4.5),
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const buildingLengthHandlePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      buildingConfig.lengthMeters / 2 + 4.5,
      0,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const buildingLeftEdgePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      -buildingConfig.lengthMeters / 2,
      0,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const buildingApplyHandlePos = useMemo(() => {
    if (!buildingConfig?.active) return null;
    return localOffsetToLatLng(
      -(buildingConfig.lengthMeters / 2 + 5.0),
      0,
      buildingConfig.centerLat,
      buildingConfig.centerLng,
      buildingConfig.angleDeg
    );
  }, [buildingConfig]);

  const handleBuildingAnchorDrag = useCallback(
    (e) => {
      if (!e.latLng || !onUpdateBuildingConfig) return;
      const lat = Number(e.latLng.lat().toFixed(8));
      const lng = Number(e.latLng.lng().toFixed(8));
      onUpdateBuildingConfig((prev) => ({
        ...prev,
        centerLat: lat,
        centerLng: lng,
      }));
    },
    [onUpdateBuildingConfig]
  );

  const handleBuildingLengthDrag = useCallback(
    (e) => {
      if (!e.latLng || !buildingConfig || !onUpdateBuildingConfig) return;
      const { centerLat, centerLng, angleDeg } = buildingConfig;
      const { dx } = latLngToLocalOffset(e.latLng.lat(), e.latLng.lng(), centerLat, centerLng, angleDeg);
      const rawHalf = Math.max(1.5, Math.abs(dx) - 4.5);
      const newLen = Math.max(3.0, Math.min(120.0, Number((rawHalf * 2).toFixed(1))));
      onUpdateBuildingConfig((prev) => ({
        ...prev,
        lengthMeters: newLen,
      }));
    },
    [buildingConfig, onUpdateBuildingConfig]
  );

  const handleBuildingWidthDrag = useCallback(
    (e) => {
      if (!e.latLng || !buildingConfig || !onUpdateBuildingConfig) return;
      const { centerLat, centerLng, angleDeg } = buildingConfig;
      const { dy } = latLngToLocalOffset(e.latLng.lat(), e.latLng.lng(), centerLat, centerLng, angleDeg);
      const rawHalf = Math.max(0.5, Math.abs(dy) - 4.5);
      const newWid = Math.max(1.0, Math.min(30.0, Number((rawHalf * 2).toFixed(1))));
      onUpdateBuildingConfig((prev) => ({
        ...prev,
        widthMeters: newWid,
      }));
    },
    [buildingConfig, onUpdateBuildingConfig]
  );

  const handleBuildingRotateDrag = useCallback(
    (e) => {
      if (!e.latLng || !buildingConfig || !onUpdateBuildingConfig) return;
      const { centerLat, centerLng } = buildingConfig;
      const dLatMeters = (e.latLng.lat() - centerLat) * 110574;
      const dLngMeters = (e.latLng.lng() - centerLng) * 111320 * Math.cos((centerLat * Math.PI) / 180);
      const angleRad = -Math.atan2(dLngMeters, dLatMeters);
      let newAngle = (angleRad * 180) / Math.PI;
      if (newAngle < 0) newAngle += 360;
      onUpdateBuildingConfig((prev) => ({
        ...prev,
        angleDeg: Number(newAngle.toFixed(1)),
      }));
    },
    [buildingConfig, onUpdateBuildingConfig]
  );
  const onLoad = useCallback((instance) => {
    setMap(instance);
    setZoomLevel(instance.getZoom() || 20);
    setMapsReady(true);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    setMapsReady(false);
  }, []);

  // Update zoom level state on zoom_changed (only on meaningful change to avoid render loops)
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("zoom_changed", () => {
      const z = map.getZoom();
      if (typeof z === "number") {
        setZoomLevel((prev) => (Math.abs(prev - z) >= 0.2 ? z : prev));
      }
    });
    return () => {
      if (window.google?.maps?.event) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [map]);

  const lastFocusPosRef = useRef(null);

  // Smoothly recenter when focusPoint changes
  useEffect(() => {
    if (!map || !focusPoint) return;
    if (Number.isFinite(focusPoint.lat) && Number.isFinite(focusPoint.lng)) {
      const prev = lastFocusPosRef.current;
      if (prev && Math.abs(prev.lat - focusPoint.lat) < 1e-6 && Math.abs(prev.lng - focusPoint.lng) < 1e-6) {
        return;
      }
      lastFocusPosRef.current = { lat: focusPoint.lat, lng: focusPoint.lng };
      map.panTo({ lat: focusPoint.lat, lng: focusPoint.lng });
      const currentZoom = map.getZoom() || 0;
      if (currentZoom < 20) {
        map.setZoom(20);
      }
    }
  }, [focusPoint, map]);

  // Sync mapTypeId directly to the Google Map instance
  useEffect(() => {
    if (map && mapTypeId) {
      try {
        map.setMapTypeId(mapTypeId);
      } catch {
        // ignore
      }
    }
  }, [map, mapTypeId]);

  // Close map/satellite dropdowns on outside click or touch
  useEffect(() => {
    function handleClickOutside(e) {
      if (mapMenuRef.current && !mapMenuRef.current.contains(e.target)) {
        setShowMapMenu(false);
      }
      if (satelliteMenuRef.current && !satelliteMenuRef.current.contains(e.target)) {
        setShowSatelliteMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Route polyline
  const routePath = useMemo(
    () =>
      Array.isArray(routeCoords)
        ? routeCoords
            .filter((c) => Array.isArray(c) && c.length === 2)
            .map(([cLat, cLng]) => ({ lat: Number(cLat), lng: Number(cLng) }))
        : [],
    [routeCoords]
  );

  useEffect(() => {
    if (!map || !window.google?.maps || routePath.length < 2) return;
    try {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { top: 70, right: 60, bottom: 80, left: 380 });
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
    () => ({
      ...BASE_OPTIONS,
      mapTypeId,
      draggableCursor: placingMode ? "crosshair" : undefined,
    }),
    [placingMode, mapTypeId]
  );

  // CMP Apartment plots
  const cmpPlots = useMemo(() => {
    return plots.filter((p) => p.gpsLat && p.gpsLng && isCmpPlot(p));
  }, [plots]);

  // Center of CMP apartment complex
  const cmpCenter = useMemo(() => {
    if (cmpPlots.length === 0) return { lat: 8.46584789, lng: 124.65701478 };
    let sumLat = 0;
    let sumLng = 0;
    for (const p of cmpPlots) {
      sumLat += Number(p.gpsLat);
      sumLng += Number(p.gpsLng);
    }
    return {
      lat: sumLat / cmpPlots.length,
      lng: sumLng / cmpPlots.length,
    };
  }, [cmpPlots]);

  // Dynamic boundary coordinates that move & rotate in lockstep with the plots
  const boundaryPaths = useMemo(() => {
    return getCmpBoundaryCoords(cmpCenter.lat, cmpCenter.lng, gridAngle ?? 37.7, boundaryOffsets);
  }, [cmpCenter.lat, cmpCenter.lng, gridAngle, boundaryOffsets]);

  const polygonRef = useRef(null);

  // Sync edits from the map to state — only when user is actively editing boundary lines
  const handlePolygonPathChange = useCallback(() => {
    if (!polygonRef.current || !onUpdateBoundaryOffsets || !editBoundaryLines) return;
    const path = polygonRef.current.getPath();
    if (!path || path.getLength() === 0) return;
    const newCoords = [];
    for (let i = 0; i < path.getLength(); i++) {
      const pt = path.getAt(i);
      newCoords.push({ lat: pt.lat(), lng: pt.lng() });
    }
    const newOffsets = coordsToBoundaryOffsets(newCoords, cmpCenter.lat, cmpCenter.lng, gridAngle ?? 37.7);

    // Guard against recursive state update loops: only update if offsets actually changed significantly (> 5cm)
    const currentOffsets = Array.isArray(boundaryOffsets) && boundaryOffsets.length >= 3 ? boundaryOffsets : CMP_BOUNDARY_OFFSETS_METERS;
    const hasMeaningfulChange =
      newOffsets.length !== currentOffsets.length ||
      newOffsets.some((o, idx) => {
        const prev = currentOffsets[idx];
        return !prev || Math.abs(o.dx - prev.dx) > 0.05 || Math.abs(o.dy - prev.dy) > 0.05;
      });

    if (!hasMeaningfulChange) return;
    onUpdateBoundaryOffsets(newOffsets);
  }, [cmpCenter.lat, cmpCenter.lng, gridAngle, onUpdateBoundaryOffsets, editBoundaryLines, boundaryOffsets]);

  const handlePolygonLoad = useCallback((poly) => {
    polygonRef.current = poly;
  }, []);

  // Attach vertex listeners ONLY when editBoundaryLines is actively enabled by the user
  useEffect(() => {
    if (!editBoundaryLines || !polygonRef.current) return;
    const path = polygonRef.current.getPath();
    if (!path) return;

    const l1 = path.addListener("set_at", handlePolygonPathChange);
    const l2 = path.addListener("insert_at", handlePolygonPathChange);
    const l3 = path.addListener("remove_at", handlePolygonPathChange);

    return () => {
      if (window.google?.maps?.event) {
        window.google.maps.event.removeListener(l1);
        window.google.maps.event.removeListener(l2);
        window.google.maps.event.removeListener(l3);
      }
    };
  }, [editBoundaryLines, handlePolygonPathChange]);

  // Dragging the blue boundary polygon directly also moves the plots inside it
  const handlePolygonDragEnd = useCallback(() => {
    if (!polygonRef.current || !onUpdatePlots) return;
    const path = polygonRef.current.getPath();
    if (!path || path.getLength() === 0) return;
    let newSumLat = 0;
    let newSumLng = 0;
    const len = path.getLength();
    for (let i = 0; i < len; i++) {
      const pt = path.getAt(i);
      newSumLat += pt.lat();
      newSumLng += pt.lng();
    }
    const newCLat = newSumLat / len;
    const newCLng = newSumLng / len;

    let oldSumLat = 0;
    let oldSumLng = 0;
    for (const pt of boundaryPaths) {
      oldSumLat += pt.lat;
      oldSumLng += pt.lng;
    }
    const oldCLat = oldSumLat / boundaryPaths.length;
    const oldCLng = oldSumLng / boundaryPaths.length;

    const dLat = newCLat - oldCLat;
    const dLng = newCLng - oldCLng;
    if (Math.abs(dLat) > 1e-7 || Math.abs(dLng) > 1e-7) {
      const updated = translatePlots(plots, dLat, dLng, scopeFilter);
      onUpdatePlots(updated);
    }
  }, [boundaryPaths, plots, scopeFilter, onUpdatePlots]);

  // Filter plots according to selected legend status — CMP plots only
  const visiblePlots = useMemo(() => {
    return plots.filter((p) => {
      if (p._deleted) return false;
      if (!p.gpsLat || !p.gpsLng) return false;
      if (!isCmpPlot(p)) return false;
      if (effectiveFilter === "all") return true;
      return p.status?.toLowerCase() === effectiveFilter.toLowerCase();
    });
  }, [plots, effectiveFilter]);

  // Plots that do not belong to an apartment row building (standalone plots)
  const standalonePlots = useMemo(() => {
    return visiblePlots.filter((p) => !getRowKey(p));
  }, [visiblePlots]);

  if (loadError && !isGoogleAlreadyLoaded) {
    return (
      <div className="alert alert-danger" role="alert" style={{ margin: "1rem" }}>
        The map could not be loaded. Verify the Google Maps API key configuration.
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="spinner spinner-lg" aria-label="Loading cemetery map" />;
  }

  const isMapActive = mapTypeId === "roadmap" || mapTypeId === "terrain";
  const isSatelliteActive = mapTypeId === "hybrid" || mapTypeId === "satellite";

  return (
    <div style={WRAPPER_STYLE}>
      {/* ─── Top-Left Controls: Map / Satellite dropdowns ─── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 20,
          display: "flex",
          gap: 4,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "var(--radius-md, 8px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
          padding: "4px",
        }}
      >
        {/* Map Type Dropdown */}
        <div
          ref={mapMenuRef}
          style={{ position: "relative", width: 95 }}
          onMouseEnter={() => setShowMapMenu(true)}
          onMouseLeave={() => setShowMapMenu(false)}
        >
          <button
            type="button"
            onClick={() => {
              if (!isMapActive) {
                setMapTypeId("roadmap");
              }
              setShowMapMenu((prev) => !prev);
              setShowSatelliteMenu(false);
            }}
            style={{
              width: "100%",
              padding: "6px 10px",
              background: isMapActive ? "rgba(255, 255, 255, 0.16)" : "transparent",
              color: isMapActive ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "var(--radius-sm, 6px)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
            }}
          >
            <span>Map</span>
            <ChevronDown
              size={12}
              style={{
                transform: showMapMenu ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                opacity: 0.8,
              }}
            />
          </button>

          {showMapMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                paddingTop: 6,
                zIndex: 30,
                minWidth: 125,
              }}
            >
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.95)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "var(--radius-md, 8px)",
                  padding: "6px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {/* Default roadmap */}
                <button
                  type="button"
                  onClick={() => {
                    setMapTypeId("roadmap");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    background: mapTypeId === "roadmap" ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm, 5px)",
                    color: mapTypeId === "roadmap" ? "#ffffff" : "#cbd5e1",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: mapTypeId === "roadmap" ? 600 : 400,
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (mapTypeId !== "roadmap") e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (mapTypeId !== "roadmap") e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      border: mapTypeId === "roadmap" ? "none" : "1px solid rgba(255, 255, 255, 0.35)",
                      background: mapTypeId === "roadmap" ? "var(--primary, #3b82f6)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {mapTypeId === "roadmap" && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <span>Default</span>
                </button>

                {/* Terrain */}
                <button
                  type="button"
                  onClick={() => {
                    setMapTypeId("terrain");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    background: mapTypeId === "terrain" ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm, 5px)",
                    color: mapTypeId === "terrain" ? "#ffffff" : "#cbd5e1",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: mapTypeId === "terrain" ? 600 : 400,
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (mapTypeId !== "terrain") e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (mapTypeId !== "terrain") e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      border: mapTypeId === "terrain" ? "none" : "1px solid rgba(255, 255, 255, 0.35)",
                      background: mapTypeId === "terrain" ? "var(--primary, #3b82f6)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {mapTypeId === "terrain" && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <span>Terrain</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Satellite Dropdown */}
        <div
          ref={satelliteMenuRef}
          style={{ position: "relative", width: 105 }}
          onMouseEnter={() => setShowSatelliteMenu(true)}
          onMouseLeave={() => setShowSatelliteMenu(false)}
        >
          <button
            type="button"
            onClick={() => {
              if (!isSatelliteActive) {
                setMapTypeId("hybrid");
              }
              setShowSatelliteMenu((prev) => !prev);
              setShowMapMenu(false);
            }}
            style={{
              width: "100%",
              padding: "6px 10px",
              background: isSatelliteActive ? "rgba(255, 255, 255, 0.16)" : "transparent",
              color: isSatelliteActive ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "var(--radius-sm, 6px)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
            }}
          >
            <span>Satellite</span>
            <ChevronDown
              size={12}
              style={{
                transform: showSatelliteMenu ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                opacity: 0.8,
              }}
            />
          </button>

          {showSatelliteMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                paddingTop: 6,
                zIndex: 30,
                minWidth: 125,
              }}
            >
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.95)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "var(--radius-md, 8px)",
                  padding: "6px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {/* Labels toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setMapTypeId((prev) => (prev === "satellite" ? "hybrid" : "satellite"));
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    background: mapTypeId === "hybrid" ? "rgba(255, 255, 255, 0.1)" : "transparent",
                    border: "none",
                    borderRadius: "var(--radius-sm, 5px)",
                    color: mapTypeId === "hybrid" ? "#ffffff" : "#cbd5e1",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontWeight: mapTypeId === "hybrid" ? 600 : 400,
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (mapTypeId !== "hybrid") e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (mapTypeId !== "hybrid") e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      border: mapTypeId === "hybrid" ? "none" : "1px solid rgba(255, 255, 255, 0.35)",
                      background: mapTypeId === "hybrid" ? "var(--primary, #3b82f6)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {mapTypeId === "hybrid" && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                  <span>Labels</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Top-Right: Plot Legend Overlay (reference-style light panel) ─── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: "var(--radius-md, 8px)",
          border: "1px solid rgba(15, 23, 42, 0.14)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.28)",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
          minWidth: 128,
        }}
      >
        {[
          { key: "sold", label: "Sold" },
          { key: "hold", label: "Hold" },
          { key: "occupied", label: "Occupied" },
          { key: "available", label: "Available" },
          { key: "unavailable", label: "Unavailable" },
        ].map((item) => {
          const isActive = effectiveFilter === item.key;
          return (
            <div
              key={item.key}
              onClick={() => {
                const next = isActive ? "all" : item.key;
                setActiveFilter(next);
                if (typeof onStatusFilterChange === "function") onStatusFilterChange(next);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.8rem",
                cursor: "pointer",
                padding: "2px 4px",
                margin: "0 -4px",
                borderRadius: 4,
                background: isActive ? "rgba(15, 23, 42, 0.08)" : "transparent",
                transition: "background 0.15s ease",
              }}
              title={`Click to filter by ${item.label}`}
            >
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: getPlotStatusColor(item.key),
                  border: "1px solid rgba(0, 0, 0, 0.4)",
                }}
              />
              <span style={{ color: "#1f2937", fontWeight: isActive ? 700 : 500 }}>
                {item.label}
              </span>
            </div>
          );
        })}

        {effectiveFilter !== "all" && (
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              if (typeof onStatusFilterChange === "function") onStatusFilterChange("all");
            }}
            style={{
              background: "transparent",
              border: "none",
              borderTop: "1px solid rgba(15, 23, 42, 0.12)",
              color: "#0369a1",
              fontSize: "0.7rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "5px 4px 1px",
              margin: "2px -4px 0",
              textAlign: "left",
            }}
          >
            Reset filter
          </button>
        )}
      </div>

      {/* ─── Google Map Instance ─── */}
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={center}
        mapTypeId={mapTypeId}
        options={options}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
      >
        {/* Navigation Polyline */}
        {routePath.length > 1 && (
          <PolylineF
            path={routePath}
            options={{ strokeColor: "#00E5FF", strokeWeight: 5, strokeOpacity: 0.9 }}
          />
        )}

        {/* Cemetery Section Boundary Polygon (Blue outline — customizable length/size by lines) */}
        <PolygonF
          paths={boundaryPaths}
          editable={editBoundaryLines}
          draggable={adjustMode && !editBoundaryLines}
          onLoad={handlePolygonLoad}
          onDragEnd={handlePolygonDragEnd}
          options={{
            strokeColor: editBoundaryLines ? "#00E5FF" : "#00A3FF",
            strokeOpacity: 0.9,
            strokeWeight: editBoundaryLines ? 3.5 : 2.5,
            fillColor: "#00A3FF",
            fillOpacity: editBoundaryLines ? 0.08 : 0.04,
            clickable: adjustMode,
            draggable: adjustMode && !editBoundaryLines,
            editable: editBoundaryLines,
            cursor: editBoundaryLines ? "crosshair" : adjustMode ? "move" : "default",
            zIndex: 10,
          }}
        />


        {/* ─── Adjust / Crop Tool: Center Move Anchor & Rotation Handle ─── */}
        {adjustMode && !buildingConfig?.active && adjustBbox && (
          <>
            {/* Top stem line connecting bounding box to rotation handle */}
            <PolylineF
              path={[
                { lat: adjustBbox.maxLat, lng: adjustBbox.centerLng },
                { lat: adjustBbox.maxLat + 2.0 * M_TO_LAT, lng: adjustBbox.centerLng },
              ]}
              options={{
                strokeColor: "#A855F7",
                strokeOpacity: 0.85,
                strokeWeight: 2,
                zIndex: 490,
              }}
            />

            {/* Joint node on top boundary edge */}
            <MarkerF
              position={{
                lat: adjustBbox.maxLat,
                lng: adjustBbox.centerLng,
              }}
              icon={{
                path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                scale: 3.5,
                fillColor: "#A855F7",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
              }}
              zIndex={495}
            />

            {/* Central Move Anchor Marker */}
            {anchorPos && (
              <MarkerF
                position={anchorPos}
                draggable
                icon={getMoveAnchorIcon()}
                title="Drag this anchor to slide the plot grid across the map"
                onDrag={handleAnchorDrag}
                onDragEnd={handleAnchorDragEnd}
                zIndex={500}
              />
            )}

            {/* Top Rotation Handle Marker */}
            <MarkerF
              position={{
                lat: adjustBbox.maxLat + 2.0 * M_TO_LAT,
                lng: adjustBbox.centerLng,
              }}
              draggable
              icon={getRotateHandleIcon()}
              title="Drag horizontally to rotate plots around the center"
              onDrag={handleRotateDrag}
              zIndex={500}
            />
          </>
        )}

        {/* ─── Building Type Blocks (All 15 Rows in Bolonsori CMP) ─── */}
        {allBuildingBlocks.map((block) => {
          const isTargetActive = block.isTargetActive;
          return (
            <Fragment key={`building-block-${block.rowKey}`}>
              {/* Outer Building Block Boundary (Dark Slate Outline / Cyan Accent when active) */}
              <PolygonF
                paths={block.corners}
                options={{
                  fillColor: "#0f172a",
                  fillOpacity: isTargetActive ? 0.16 : 0.08,
                  strokeColor: isTargetActive ? "#00E5FF" : "#0f172a",
                  strokeWeight: isTargetActive ? 4 : 3,
                  strokeOpacity: 0.95,
                  zIndex: isTargetActive ? 345 : 340,
                  cursor: adjustMode ? "pointer" : "default",
                }}
                onClick={() => {
                  if (adjustMode && onUpdateBuildingConfig && !isTargetActive && block.plots.length > 0) {
                    const snapped = snapBuildingToPlots(block.plots, gridAngle ?? 37.7);
                    if (snapped) {
                      onUpdateBuildingConfig((prev) => ({
                        ...prev,
                        ...snapped,
                        targetRow: block.rowKey,
                        active: true,
                      }));
                    }
                  }
                }}
              />

              {/* Subdivided Plot Cells with Crisp White Dividers & Status Colors */}
              {block.cells.map((cell) => {
                const color = getPlotStatusColor(cell.status);
                const isSelected = selectedPlot?.id === cell.plot?.id;
                const isHovered = hoveredPlot?.id === cell.plot?.id;
                const matchesFilter =
                  effectiveFilter === "all" ||
                  cell.status?.toLowerCase() === effectiveFilter.toLowerCase();
                const cellOpacity = isSelected
                  ? 0.95
                  : isHovered
                  ? 0.9
                  : matchesFilter
                  ? 0.85
                  : 0.2;

                return (
                  <Fragment key={`b-cell-${block.rowKey}-${cell.index}`}>
                    <PolygonF
                      paths={cell.corners}
                      options={{
                        fillColor: color,
                        fillOpacity: cellOpacity,
                        strokeColor: isSelected
                          ? "#00E5FF"
                          : cell.plot?._modified
                          ? "#F59E0B"
                          : "#ffffff",
                        strokeWeight: isSelected ? 2.5 : cell.plot?._modified ? 2 : 1.5,
                        strokeOpacity: 1,
                        zIndex: isSelected ? 365 : isHovered ? 360 : 350,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        if (
                          adjustMode &&
                          buildingConfig?.active &&
                          onUpdateBuildingConfig &&
                          !isTargetActive &&
                          block.plots.length > 0
                        ) {
                          const snapped = snapBuildingToPlots(block.plots, gridAngle ?? 37.7);
                          if (snapped) {
                            onUpdateBuildingConfig((prev) => ({
                              ...prev,
                              ...snapped,
                              targetRow: block.rowKey,
                              active: true,
                            }));
                          }
                          return;
                        }
                        if (cell.plot && typeof onSelectPlot === "function") {
                          onSelectPlot(cell.plot);
                        }
                      }}
                      onMouseOver={() => {
                        if (cell.plot) setHoveredPlot(cell.plot);
                      }}
                      onMouseOut={() => setHoveredPlot(null)}
                    />

                    {/* Rotated Cell Number Marker */}
                    {zoomLevel >= 18.5 && (
                      <MarkerF
                        position={cell.center}
                        clickable={false}
                        icon={
                          mapsReady
                            ? {
                                url: createPlotLabelIcon({
                                  plotNumber: cell.label,
                                  deceasedNames: cell.plot ? getPlotDeceasedNames(cell.plot) : [],
                                  angleDeg: block.cfg.angleDeg,
                                  hasStar:
                                    cell.plot?.plotNumber === "WALAG-001" ||
                                    cell.plot?.plotNumber === "ROW-E01-C01",
                                  showName: false,
                                }).url,
                                anchor: new window.google.maps.Point(24, 12),
                                scaledSize: new window.google.maps.Size(48, 24),
                              }
                            : undefined
                        }
                        zIndex={370}
                      />
                    )}

                    {/* Blue Map Pin planted on Selected Plot */}
                    {isSelected && !adjustMode && (
                      <MarkerF
                        position={cell.center}
                        clickable={false}
                        icon={
                          mapsReady
                            ? {
                                url: BLUE_PIN_ICON,
                                anchor: new window.google.maps.Point(14, 36),
                                scaledSize: new window.google.maps.Size(28, 36),
                              }
                            : undefined
                        }
                        zIndex={530}
                      />
                    )}

                    {/* Pinpoint Drag Handle: ONLY in Plot Coordinates adjust tab (NOT when buildingConfig is active) */}
                    {adjustMode && !buildingConfig?.active && cell.plot && scopeFilter(cell.plot) && (
                      <MarkerF
                        position={cell.center}
                        draggable
                        icon={{
                          path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                          fillColor: cell.plot._modified
                            ? "#F59E0B"
                            : isSelected
                            ? "#00E5FF"
                            : "#ffffff",
                          fillOpacity: 0.95,
                          strokeColor: "#0f172a",
                          strokeWeight: 1.5,
                          scale: 5,
                        }}
                        title={`Drag to pinpoint ${cell.label}`}
                        onDragEnd={(e) => {
                          if (e.latLng && typeof onSinglePlotDrag === "function") {
                            onSinglePlotDrag(cell.plot, e.latLng.lat(), e.latLng.lng());
                          }
                        }}
                        zIndex={isSelected ? 400 : 300}
                      />
                    )}
                  </Fragment>
                );
              })}

              {/* Building Row Title Badge at intermediate zoom levels */}
              {zoomLevel >= 16.5 && zoomLevel < 18.5 && (
                <MarkerF
                  position={{ lat: block.cfg.centerLat, lng: block.cfg.centerLng }}
                  clickable={false}
                  icon={getBlockTitleBadgeIcon(block.rowKey, block.cfg.angleDeg)}
                  zIndex={330}
                />
              )}
            </Fragment>
          );
        })}

        {/* ─── Interactive Handles for Currently Active Building Block ─── */}
        {buildingConfig?.active && (
          <>
            {/* Rotate Stem Line & Joint (North Edge) */}
            {buildingTopEdgePos && buildingRotateHandlePos && (
              <>
                <PolylineF
                  path={[buildingTopEdgePos, buildingRotateHandlePos]}
                  options={{
                    strokeColor: "#F59E0B",
                    strokeWeight: 2,
                    strokeOpacity: 0.85,
                    zIndex: 480,
                  }}
                />
                <MarkerF
                  position={buildingTopEdgePos}
                  clickable={false}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 3,
                    fillColor: "#F59E0B",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                  }}
                  zIndex={485}
                />
              </>
            )}

            {/* Width Stem Line & Joint (South Edge) */}
            {buildingBottomEdgePos && buildingWidthHandlePos && (
              <>
                <PolylineF
                  path={[buildingBottomEdgePos, buildingWidthHandlePos]}
                  options={{
                    strokeColor: "#A855F7",
                    strokeWeight: 2,
                    strokeOpacity: 0.85,
                    zIndex: 480,
                  }}
                />
                <MarkerF
                  position={buildingBottomEdgePos}
                  clickable={false}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 3,
                    fillColor: "#A855F7",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                  }}
                  zIndex={485}
                />
              </>
            )}

            {/* Length Stem Line & Joint (East Edge) */}
            {buildingRightEdgePos && buildingLengthHandlePos && (
              <>
                <PolylineF
                  path={[buildingRightEdgePos, buildingLengthHandlePos]}
                  options={{
                    strokeColor: "#10B981",
                    strokeWeight: 2,
                    strokeOpacity: 0.85,
                    zIndex: 480,
                  }}
                />
                <MarkerF
                  position={buildingRightEdgePos}
                  clickable={false}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 3,
                    fillColor: "#10B981",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                  }}
                  zIndex={485}
                />
              </>
            )}

            {/* Apply & Save Stem Line & Joint (West Edge) */}
            {buildingLeftEdgePos && buildingApplyHandlePos && (
              <>
                <PolylineF
                  path={[buildingLeftEdgePos, buildingApplyHandlePos]}
                  options={{
                    strokeColor: "#10B981",
                    strokeWeight: 2,
                    strokeOpacity: 0.85,
                    zIndex: 480,
                  }}
                />
                <MarkerF
                  position={buildingLeftEdgePos}
                  clickable={false}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 3,
                    fillColor: "#10B981",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 1.5,
                  }}
                  zIndex={485}
                />
              </>
            )}

            {/* Apply & Save Button (West Edge) */}
            {buildingApplyHandlePos && (
              <MarkerF
                position={buildingApplyHandlePos}
                clickable
                icon={getBuildingApplyHandleIcon()}
                title="Click to apply rotated coordinates to plots and save to database"
                onClick={() => {
                  if (typeof onApplyBuildingConfig === "function") {
                    onApplyBuildingConfig();
                  }
                }}
                zIndex={540}
              />
            )}

            {/* Center Move Anchor */}
            <MarkerF
              position={{ lat: buildingConfig.centerLat, lng: buildingConfig.centerLng }}
              draggable
              icon={getBuildingMoveAnchorIcon()}
              title="Drag this anchor to position the building over the satellite roof"
              onDrag={handleBuildingAnchorDrag}
              onDragEnd={handleBuildingAnchorDrag}
              zIndex={530}
            />

            {/* Rotation Handle (North) */}
            {buildingRotateHandlePos && (
              <MarkerF
                position={buildingRotateHandlePos}
                draggable
                icon={getBuildingRotateHandleIcon(buildingConfig.angleDeg)}
                title="Drag to rotate building alignment to match the roof line"
                onDrag={handleBuildingRotateDrag}
                onDragEnd={handleBuildingRotateDrag}
                zIndex={520}
              />
            )}

            {/* Length Resize Handle (East) */}
            {buildingLengthHandlePos && (
              <MarkerF
                position={buildingLengthHandlePos}
                draggable
                icon={getBuildingLengthHandleIcon(buildingConfig.lengthMeters)}
                title="Drag horizontally to adjust building length"
                onDrag={handleBuildingLengthDrag}
                onDragEnd={handleBuildingLengthDrag}
                zIndex={510}
              />
            )}

            {/* Width Resize Handle (South) */}
            {buildingWidthHandlePos && (
              <MarkerF
                position={buildingWidthHandlePos}
                draggable
                icon={getBuildingWidthHandleIcon(buildingConfig.widthMeters)}
                title="Drag vertically to adjust building width / depth"
                onDrag={handleBuildingWidthDrag}
                onDragEnd={handleBuildingWidthDrag}
                zIndex={510}
              />
            )}
          </>
        )}

        {/* ─── Standalone Plots (Sections A, B, C, Lawn Plots) ─── */}
        {standalonePlots.map((plot) => {
          if (!plot.gpsLat || !plot.gpsLng) return null;
          const pos = { lat: Number(plot.gpsLat), lng: Number(plot.gpsLng) };
          const color = getPlotStatusColor(plot.status);
          const isSelected = selectedPlot?.id === plot.id;
          const isHovered = hoveredPlot?.id === plot.id;

          // In editable mode, render draggable markers for standalone plots
          if (editable) {
            return (
              <MarkerF
                key={plot.id}
                position={pos}
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

          // Calculate rectangular footprint for standalone plots
          const corners = getPlotCorners({
            lat: pos.lat,
            lng: pos.lng,
            widthMeters: 2.65,
            depthMeters: 1.6,
            angleDeg: 0,
          });

          return (
            <Fragment key={`plot-frag-${plot.id}`}>
              <PolygonF
                key={`poly-${plot.id}`}
                paths={corners}
                options={{
                  fillColor: color,
                  fillOpacity: isSelected ? 0.95 : isHovered ? 0.9 : 0.85,
                  strokeColor: plot._modified
                    ? "#F59E0B"
                    : isSelected
                    ? "#00E5FF"
                    : "rgba(17, 24, 39, 0.65)",
                  strokeWeight: plot._modified ? 3 : isSelected ? 3.5 : 1,
                  strokeOpacity: 1,
                  zIndex: isSelected ? 200 : isHovered ? 150 : 20,
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (typeof onSelectPlot === "function") {
                    onSelectPlot(plot);
                  }
                }}
                onMouseOver={() => setHoveredPlot(plot)}
                onMouseOut={() => setHoveredPlot(null)}
              />

              {/* Blue Map Pin planted on Selected Standalone Plot */}
              {isSelected && !adjustMode && (
                <MarkerF
                  key={`selected-pin-${plot.id}`}
                  position={pos}
                  clickable={false}
                  icon={
                    mapsReady
                      ? {
                          url: BLUE_PIN_ICON,
                          anchor: new window.google.maps.Point(14, 36),
                          scaledSize: new window.google.maps.Size(28, 36),
                        }
                      : undefined
                  }
                  zIndex={500}
                />
              )}

              {/* Pinpoint Drag Handle for standalone plot in adjustMode */}
              {adjustMode && !buildingConfig?.active && scopeFilter(plot) && (
                <MarkerF
                  position={pos}
                  draggable
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    fillColor: plot._modified ? "#F59E0B" : isSelected ? "#00E5FF" : "#ffffff",
                    fillOpacity: 0.95,
                    strokeColor: "#0f172a",
                    strokeWeight: 1.5,
                    scale: 5,
                  }}
                  title={`Drag to pinpoint ${plot.plotNumber}`}
                  onDragEnd={(e) => {
                    if (e.latLng && typeof onSinglePlotDrag === "function") {
                      onSinglePlotDrag(plot, e.latLng.lat(), e.latLng.lng());
                    }
                  }}
                  zIndex={isSelected ? 400 : 300}
                />
              )}
            </Fragment>
          );
        })}

        {/* Selected Plot Callout Bubble on Map */}
        {selectedPlot?.gpsLat && selectedPlot?.gpsLng && !adjustMode && (() => {
          const calloutNames = getPlotCalloutNames(selectedPlot);
          return (
            <InfoWindowF
              position={{ lat: Number(selectedPlot.gpsLat), lng: Number(selectedPlot.gpsLng) }}
              options={{
                disableAutoPan: true,
                headerDisabled: true,
                pixelOffset: mapsReady ? new window.google.maps.Size(0, -36) : undefined,
              }}
              onCloseClick={() => {
                if (typeof onSelectPlot === "function") {
                  onSelectPlot(null);
                }
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "2px 2px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#111827",
                    whiteSpace: "nowrap",
                    lineHeight: 1.25,
                  }}
                >
                  {calloutNames.map((name, idx) => (
                    <span key={idx}>{name}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof onSelectPlot === "function") {
                      onSelectPlot(null);
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "0 2px",
                    margin: 0,
                    cursor: "pointer",
                    color: "#6b7280",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    lineHeight: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    alignSelf: "center",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
                  aria-label="Close callout"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </InfoWindowF>
          );
        })()}

        {/* Draggable draft marker for placing / adding new plot */}
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

export default function CemeteryMap(props) {
  const apiKey = getClientGoogleMapsApiKey();

  if (!apiKey) {
    return (
      <div
        style={{
          ...WRAPPER_STYLE,
          minHeight: 480,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-card, #0f172a)",
          color: "var(--text-main, #f8fafc)",
          padding: "2rem",
          textAlign: "center",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
            color: "var(--danger, #ef4444)",
          }}
        >
          <AlertTriangle size={26} />
        </div>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.15rem", fontWeight: 600 }}>
          Google Maps API Key Missing
        </h3>
        <p
          style={{
            margin: "0 0 1rem 0",
            color: "var(--text-muted, #94a3b8)",
            maxWidth: 420,
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          The interactive cemetery map requires a valid Google Maps API key.
        </p>
      </div>
    );
  }

  return <GoogleMapLoadedView {...props} apiKey={apiKey} />;
}
