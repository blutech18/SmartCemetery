"use client";

import { useMemo, useState } from "react";
import { Navigation, LocateFixed, AlertTriangle, Loader2 } from "lucide-react";
import { getClientRoutingConfig } from "../lib/config";
import {
  evaluateNavigationGate,
  formatRouteSteps,
  hasValidCoordinates,
} from "../lib/navigation";

/**
 * NavigationOverlay (Requirement 12)
 *
 * Control panel + routing logic for the step-by-step navigation experience.
 * It is intentionally decoupled from the Leaflet map: the route geometry is
 * lifted up via `onRouteChange` so the parent can render the polyline inside
 * the MapContainer (CemeteryMap), keeping map rendering in the map component.
 *
 * Contract:
 *   - The Client selects a plot; `destination` is its GPS ({ lat, lng }).
 *   - The Client supplies an origin (browser geolocation, "Use my location").
 *   - Gate BEFORE routing/logging via `evaluateNavigationGate` (Req 12.4).
 *   - Missing/invalid destination GPS -> "directions unavailable", no route,
 *     no Navigation_Log (Req 12.4).
 *   - Successful route -> render polyline + numbered steps (Req 12.1, 12.2)
 *     then POST /api/navigation to persist origin/destination/timestamp
 *     (Req 12.3).
 *   - Routing failure -> error message, retain current map view, no log
 *     (Req 12.5).
 *
 * @param {{
 *   destination: { lat: number, lng: number } | null,
 *   onRouteChange: (coords: Array<[number, number]> | null) => void,
 * }} props
 */
export default function NavigationOverlay({ destination, onRouteChange }) {
  const [origin, setOrigin] = useState(null);
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | locating | routing | ready | error
  const [message, setMessage] = useState("");

  // Destination validity gate (Req 12.4). The parent remounts this component
  // (via a `key` keyed on the selected plot) when the selection changes, so
  // routing state resets naturally without a state-resetting effect.
  const destinationValid = useMemo(
    () => hasValidCoordinates(destination),
    [destination]
  );

  function requestGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setMessage("Location services are not available in this browser.");
      return;
    }
    setStatus("locating");
    setMessage("Getting your current location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextOrigin = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setOrigin(nextOrigin);
        generateRoute(nextOrigin);
      },
      () => {
        setStatus("error");
        setMessage(
          "Could not determine your location. Please allow location access and try again."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function generateRoute(originCoords) {
    // Gate BEFORE routing/logging (Req 12.4). Never route or log when the
    // destination GPS is missing/invalid.
    const gate = evaluateNavigationGate({ origin: originCoords, destination });
    if (!gate.ok) {
      setStatus("error");
      setMessage(
        gate.reason === "unavailable"
          ? "Directions unavailable — this plot has no GPS coordinates."
          : "A valid starting location is required to generate a route."
      );
      onRouteChange(null);
      return;
    }

    setStatus("routing");
    setMessage("Generating directions…");

    try {
      const { baseUrl, profile } = getClientRoutingConfig();
      if (!baseUrl || !profile) {
        throw new Error("Pedestrian routing service is not configured");
      }
      const url =
        `${baseUrl}/route/v1/${profile}/` +
        `${originCoords.lng},${originCoords.lat};${destination.lng},${destination.lat}` +
        `?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Routing request failed (${res.status})`);

      const data = await res.json();
      const route = data?.routes?.[0];
      if (data?.code !== "Ok" || !route?.geometry?.coordinates?.length) {
        throw new Error("No route found");
      }

      // GeoJSON coordinates are [lng, lat]; Leaflet expects [lat, lng].
      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

      // Flatten legs -> steps (in leg order, then step order) before formatting.
      const rawSteps = Array.isArray(route.legs)
        ? route.legs.flatMap((leg) => (Array.isArray(leg.steps) ? leg.steps : []))
        : [];

      setSteps(formatRouteSteps(rawSteps));
      onRouteChange(coords);
      setStatus("ready");
      setMessage("");

      // On successful route generation, persist the Navigation_Log with origin,
      // destination and timestamp (createdAt is set server-side) (Req 12.3).
      persistLog(originCoords, destination);
    } catch (err) {
      // Routing failure -> error message, retain current map view, no log
      // (Req 12.5). We deliberately do NOT clear an already-rendered route so
      // the Client's current map view is retained.
      console.error("Navigation route generation failed:", err);
      setStatus("error");
      setMessage("The route could not be generated. Please try again.");
    }
  }

  function persistLog(originCoords, destinationCoords) {
    // Fire-and-forget; a logging failure must not affect the rendered route.
    fetch("/api/navigation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: `${originCoords.lat},${originCoords.lng}`,
        destination: `${destinationCoords.lat},${destinationCoords.lng}`,
      }),
    }).catch((err) => {
      console.error("Failed to persist navigation log:", err);
    });
  }

  if (!destination) return null;

  const isBusy = status === "locating" || status === "routing";

  return (
    <div className="card" style={{ marginTop: "var(--space-md)" }}>
      <div className="flex items-center gap-xs" style={{ marginBottom: 12 }}>
        <Navigation size={16} />
        <h4 style={{ margin: 0 }}>Directions</h4>
      </div>

      {!destinationValid ? (
        // Missing/invalid destination GPS -> directions unavailable, no route,
        // no Navigation_Log (Req 12.4).
        <div
          role="status"
          className="flex items-center gap-xs text-sm"
          style={{ color: "var(--color-danger, #c0392b)" }}
        >
          <AlertTriangle size={16} />
          <span>Directions unavailable — this plot has no GPS coordinates.</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={requestGeolocation}
            disabled={isBusy}
            aria-busy={isBusy}
            style={{ width: "100%" }}
          >
            {isBusy ? (
              <Loader2 size={16} className="spin" aria-hidden="true" />
            ) : (
              <LocateFixed size={16} aria-hidden="true" />
            )}
            {status === "ready" ? "Recalculate from my location" : "Use my location"}
          </button>

          {message && status !== "ready" && (
            <p
              role={status === "error" ? "alert" : "status"}
              className="text-sm"
              style={{
                marginTop: 8,
                color:
                  status === "error"
                    ? "var(--color-danger, #c0392b)"
                    : "var(--text-muted, #666)",
              }}
            >
              {message}
            </p>
          )}

          {origin && status === "ready" && (
            <p className="text-sm" style={{ marginTop: 8, color: "var(--text-muted, #666)" }}>
              Route from your location to the selected plot.
            </p>
          )}

          {steps.length > 0 && (
            <ol
              aria-label="Step-by-step directions"
              style={{ marginTop: 12, paddingLeft: 20, display: "grid", gap: 6 }}
            >
              {steps.map((s) => (
                <li key={s.step} className="text-sm">
                  {s.instruction}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
