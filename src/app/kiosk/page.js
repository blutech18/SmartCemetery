"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Archive, Landmark, MapPin, Search } from "lucide-react";
import NavigationOverlay from "@/components/NavigationOverlay";

const CemeteryMap = dynamic(() => import("@/components/CemeteryMap"), {
  ssr: false,
  loading: () => <div className="spinner spinner-lg" aria-label="Loading cemetery map" />,
});

function inactivityMilliseconds() {
  const configured = Number(process.env.NEXT_PUBLIC_KIOSK_INACTIVITY_SECONDS);
  const seconds = Number.isFinite(configured) && configured >= 10 && configured <= 3600
    ? configured
    : 120;
  return seconds * 1000;
}

function hasGps(plot) {
  return plot?.gpsLat != null && plot?.gpsLng != null &&
    Number.isFinite(Number(plot.gpsLat)) && Number.isFinite(Number(plot.gpsLng));
}

function uniqueResults(results) {
  const rows = [
    ...(results?.exact || []),
    ...(results?.suggestions || []),
    ...(results?.nearby || []),
  ];
  return rows.filter((grave, index) => rows.findIndex((item) => item.id === grave.id) === index);
}

function KioskContent() {
  const searchParams = useSearchParams();
  const initialGrave = searchParams.get("grave");
  const loadedGrave = useRef(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedGrave, setSelectedGrave] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);

  const allResults = useMemo(() => uniqueResults(results), [results]);
  const plots = useMemo(
    () => allResults
      .filter((grave) => grave.plot)
      .map((grave) => ({ ...grave.plot, status: grave.plot.status || "occupied", graves: [grave] }))
      .filter((plot, index, rows) => rows.findIndex((item) => item.id === plot.id) === index),
    [allResults]
  );
  const selectedPlot = selectedGrave?.plot || null;
  const destination = selectedPlot
    ? hasGps(selectedPlot)
      ? { lat: Number(selectedPlot.gpsLat), lng: Number(selectedPlot.gpsLng) }
      : { lat: Number.NaN, lng: Number.NaN }
    : null;

  const resetKiosk = useCallback(() => {
    setQuery("");
    setResults(null);
    setSelectedGrave(null);
    setRouteCoords(null);
    setError("");
    loadedGrave.current = null;
    // A full replacement destroys all in-memory state and removes the grave
    // identifier from browser history, which is the safest kiosk reset.
    window.location.replace("/kiosk");
  }, []);

  useEffect(() => {
    let timer;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(resetKiosk, inactivityMilliseconds());
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, restart, { passive: true }));
    restart();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, restart));
    };
  }, [resetKiosk]);

  const runSearch = useCallback(async (searchTerm, graveId = null) => {
    const trimmed = String(searchTerm || "").trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setRouteCoords(null);
    if (!graveId) setSelectedGrave(null);
    try {
      const response = await fetch(`/api/graves?q=${encodeURIComponent(trimmed)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Search is temporarily unavailable.");
      setResults(data);
      const rows = uniqueResults(data);
      if (graveId != null) {
        setSelectedGrave(rows.find((grave) => String(grave.id) === String(graveId)) || null);
      }
    } catch (searchError) {
      setResults(null);
      setError(searchError.message || "Search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialGrave || loadedGrave.current === initialGrave) return;
    loadedGrave.current = initialGrave;
    setQuery(initialGrave);
    void runSearch(initialGrave, initialGrave);
  }, [initialGrave, runSearch]);

  function selectGrave(grave) {
    setSelectedGrave(grave);
    setRouteCoords(null);
  }

  function handleSearch(event) {
    event.preventDefault();
    void runSearch(query);
  }

  return (
    <main className="kiosk-mode" style={{ minHeight: "100vh", padding: "clamp(1rem, 3vw, 2.5rem)", background: "var(--bg-base)" }}>
      <header className="text-center" style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--primary)", display: "grid", placeItems: "center", margin: "0 auto 0.75rem", color: "white" }}>
          <Landmark size={34} aria-hidden="true" />
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: 900 }}>Cemetery Navigation Kiosk</h1>
        <p className="text-secondary">Search for a burial record, select it, then request walking directions.</p>
      </header>

      <form onSubmit={handleSearch} className="landing-search-input-wrapper" style={{ maxWidth: 760, margin: "0 auto var(--space-xl)" }}>
        <Search className="landing-search-icon-left" size={24} aria-hidden="true" />
        <label htmlFor="kiosk-search-input" className="sr-only">Search by name, grave ID, or burial year</label>
        <input
          id="kiosk-search-input"
          type="text"
          className="form-input landing-search-input"
          placeholder="Search by name, grave ID, or burial year…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
          style={{ fontSize: "1.1rem", padding: "1rem 1rem 1rem 3.5rem", minWidth: 0 }}
        />
        <button id="kiosk-search-btn" type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <div role="alert" className="alert alert-danger" style={{ maxWidth: 900, margin: "0 auto 1rem" }}>{error}</div>}

      <section style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "var(--space-lg)" }}>
        <div aria-label="Search results" className="flex flex-col gap-sm">
          {results?.suggestions?.length > 0 && results?.exact?.length === 0 && (
            <div className="alert alert-info"><Search size={16} aria-hidden="true" /> Showing closest matches and nearby sections.</div>
          )}
          {allResults.map((grave) => (
            <button
              key={grave.id}
              type="button"
              className="search-result"
              onClick={() => selectGrave(grave)}
              aria-pressed={selectedGrave?.id === grave.id}
              style={{ textAlign: "left", border: selectedGrave?.id === grave.id ? "2px solid var(--primary)" : undefined }}
            >
              <div className="search-result-icon"><Archive size={22} aria-hidden="true" /></div>
              <div className="search-result-info">
                <div className="search-result-name">{grave.deceasedName}</div>
                <div className="search-result-meta">
                  Plot {grave.plot?.plotNumber || "—"} · {grave.plot?.locationDetail?.location?.name || "Unknown"}
                </div>
              </div>
            </button>
          ))}
          {!loading && results && allResults.length === 0 && (
            <div className="empty-state"><Search size={42} /><h2 className="empty-state-title">No results found</h2><p>Try another name, grave ID, or year.</p></div>
          )}
          {!loading && !results && !error && (
            <div className="empty-state"><Search size={42} /><h2 className="empty-state-title">Find a grave</h2><p>Your search and route will clear automatically after inactivity.</p></div>
          )}
        </div>

        <div>
          <div className="card" style={{ height: "clamp(360px, 58vh, 620px)", padding: 0, overflow: "hidden" }} data-testid="kiosk-map">
            <CemeteryMap
              plots={plots}
              selectedPlot={selectedPlot}
              onSelectPlot={(plot) => {
                const grave = allResults.find((item) => item.plot?.id === plot.id);
                if (grave) selectGrave(grave);
              }}
              routeCoords={routeCoords}
              focusPoint={hasGps(selectedPlot) ? destination : null}
            />
          </div>

          {selectedGrave && (
            <div className="card" style={{ marginTop: "var(--space-md)" }} data-testid="kiosk-selection">
              <div className="flex items-center gap-sm">
                <MapPin size={20} aria-hidden="true" />
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.25rem" }}>{selectedGrave.deceasedName}</h2>
                  <p className="text-sm text-muted" style={{ margin: 0 }}>
                    Plot {selectedPlot?.plotNumber || "—"} · {selectedPlot?.locationDetail?.subsection || "Section unavailable"}
                  </p>
                </div>
              </div>
              <NavigationOverlay
                key={selectedGrave.id}
                destination={destination}
                onRouteChange={setRouteCoords}
                plotId={selectedPlot?.id}
                channel="kiosk"
              />
            </div>
          )}
        </div>
      </section>

      <footer className="text-center text-xs text-muted" style={{ marginTop: "var(--space-xl)" }}>
        For privacy, this kiosk resets after {Math.round(inactivityMilliseconds() / 1000)} seconds of inactivity.
      </footer>
    </main>
  );
}

export default function KioskPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><div className="spinner spinner-lg" /></div>}>
      <KioskContent />
    </Suspense>
  );
}